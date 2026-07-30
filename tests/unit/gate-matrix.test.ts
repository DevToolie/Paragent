/**
 * Live matrix driver (#62) — the decisions that must hold without Docker.
 *
 * The driver itself needs a daemon and a browser, so what is unit-tested here is
 * everything that decides **what gets recorded**: the bundle→program mapping the
 * gate replays, whether a version is skipped, and what reason a skip carries.
 * Those are the parts that can silently corrupt the gate's raw data, and none of
 * them need a container to be wrong.
 */

import { describe, expect, it } from "vitest";
import {
  bundleToProgram,
  isCompiledBundle,
  PROGRAM_ID_PREFIX,
} from "../../src/runner/program.js";
import type { CompiledTrajectoryBundle } from "../../src/compiler/types.js";
import type { SeedFingerprint } from "../../src/testbed/verify.js";
import {
  composeFailureReason,
  fingerprintMismatch,
  formatRunLine,
} from "../../experiments/gate-v1/live-run.js";
import type { RunResult } from "../../src/runner/types.js";

function row(stepIndex: number, rowId: string) {
  return {
    schema_version: "1.0.0" as const,
    row_id: rowId,
    site_key: "grafana-oss@example",
    task_key: "open-dashboards-list",
    step_index: stepIndex,
    compiled_action: {
      type: "click" as const,
      locator_fallback_chain: [
        { strategy: "testid" as const, testid: "go", tenant_scoped: false },
      ],
    },
    assertion: {
      schema_version: "1.0.0" as const,
      assertion_id: `assert-${stepIndex}`,
      type: "element-visible" as const,
      strength: "strong" as const,
      target: { locator: { strategy: "testid" as const, testid: "done" } },
      expected: { visible: true },
      timeout_ms: 5000,
      failure_classification: "assertion_failed" as const,
      notes: "fixture",
    },
    // Cache bookkeeping the runner has no use for; must not leak into a step.
    confidence: 0.5,
    success_count: 3,
    failure_count: 1,
    last_verified_at: "2026-07-29T00:00:00.000Z",
    pool_eligible: true,
  };
}

function bundle(): CompiledTrajectoryBundle {
  return {
    schema_version: "1.0.0",
    bundle_kind: "compiled_trajectory",
    source_trajectory_id: "traj-live-task",
    site_key: "grafana-oss@127.0.0.1:3000",
    task_key: "create-stat-dashboard",
    compiled_at: "2026-07-29T00:00:00.000Z",
    compiler: { version: "0.1.0", notes: "fixture" },
    // Deliberately out of order — a bundle is JSON that may have been through
    // other tools, and replaying steps in file order would run the task wrong.
    rows: [row(1, "r1"), row(0, "r0")],
  } as unknown as CompiledTrajectoryBundle;
}

describe("bundleToProgram", () => {
  it("orders steps by step_index, not by position in the file", () => {
    const program = bundleToProgram(bundle(), "11.0.0");
    expect(program.steps.map((s) => s.step_index)).toEqual([0, 1]);
    expect(program.steps.map((s) => s.row_id)).toEqual(["r0", "r1"]);
  });

  it("takes testbed_version from the caller, but never site_key or task_key", () => {
    const b = bundle();
    const program = bundleToProgram(b, "13.0.3");
    // The whole point of a matrix: one program, replayed against each version.
    expect(program.testbed_version).toBe("13.0.3");
    // Relabelling these per version would make a row claim a run that never
    // happened — the exact failure #26 deleted versions.json over.
    expect(program.site_key).toBe(b.site_key);
    expect(program.task_key).toBe(b.task_key);
  });

  it("carries no cache bookkeeping into the program", () => {
    const program = bundleToProgram(bundle(), "11.0.0");
    const step = program.steps[0] as unknown as Record<string, unknown>;
    for (const leaked of [
      "confidence",
      "success_count",
      "failure_count",
      "pool_eligible",
      "last_verified_at",
    ]) {
      expect(step[leaked]).toBeUndefined();
    }
    expect(Object.keys(step).sort()).toEqual(
      ["assertion", "compiled_action", "row_id", "step_index"].sort(),
    );
  });

  it("names the program after the trajectory it came from", () => {
    const program = bundleToProgram(bundle(), "11.0.0");
    expect(program.program_id).toBe(`${PROGRAM_ID_PREFIX}traj-live-task`);
  });
});

describe("isCompiledBundle", () => {
  it("accepts a bundle and rejects an already-shaped program", () => {
    expect(isCompiledBundle(bundle())).toBe(true);
    expect(
      isCompiledBundle({ schema_version: "1.0.0", program_id: "p", steps: [] }),
    ).toBe(false);
  });

  it("rejects a document that only looks like one", () => {
    // rows[] without the discriminator is not a bundle; accepting it would let
    // a malformed file through as a program.
    expect(isCompiledBundle({ rows: [] })).toBe(false);
    expect(isCompiledBundle({ bundle_kind: "compiled_trajectory" })).toBe(false);
    expect(isCompiledBundle(null)).toBe(false);
    expect(isCompiledBundle("compiled_trajectory")).toBe(false);
  });
});

function fingerprint(overrides: Partial<SeedFingerprint> = {}): SeedFingerprint {
  return {
    dashboard: { panel_count: 2, panels: [], title: "Seed", uid: "paragent-seed" },
    datasource: { name: "paragent-testdata", queryable: true, uid: "paragent-testdata" },
    users: { operator_present: true, operator_role: "Editor" },
    ...overrides,
  } as SeedFingerprint;
}

describe("fingerprintMismatch", () => {
  const baseline = { id: "9.5.21", fingerprint: fingerprint() };

  it("passes identical seed state", () => {
    expect(fingerprintMismatch(baseline, fingerprint())).toBeNull();
  });

  it("ignores key order — the comparison is canonical, not textual", () => {
    const reordered = JSON.parse(
      JSON.stringify({
        users: { operator_role: "Editor", operator_present: true },
        datasource: { uid: "paragent-testdata", queryable: true, name: "paragent-testdata" },
        dashboard: { uid: "paragent-seed", title: "Seed", panels: [], panel_count: 2 },
      }),
    ) as SeedFingerprint;
    expect(fingerprintMismatch(baseline, reordered)).toBeNull();
  });

  it("aborts the version when the seed differs, naming the base version", () => {
    const drifted = fingerprint({
      dashboard: { panel_count: 1, panels: [], title: "Seed", uid: "paragent-seed" },
    });
    const reason = fingerprintMismatch(baseline, drifted);
    expect(reason).toContain("9.5.21");
    // A reader has to be able to reproduce the comparison.
    expect(reason).toContain("--verify");
  });

  it("catches a missing operator, not just dashboard drift", () => {
    const noOperator = fingerprint({
      users: { operator_present: false, operator_role: null },
    });
    expect(fingerprintMismatch(baseline, noOperator)).not.toBeNull();
  });
});

describe("composeFailureReason", () => {
  it("prefers stderr when docker wrote one", () => {
    const reason = composeFailureReason(
      "Error response from daemon: pull access denied\n",
      " Container paragent-tb-x-grafana-1  Creating\n",
    );
    expect(reason).toContain("pull access denied");
    expect(reason).not.toContain("Creating");
  });

  it("skips compose progress chatter to reach the real cause", () => {
    // The shape a killed container actually produced: progress lines first,
    // cause last. Reading from the front reports "Creating" as the reason.
    const stdout = [
      " Network paragent-tb-9-5-21_default  Creating",
      " Network paragent-tb-9-5-21_default  Created",
      " Container paragent-tb-9-5-21-grafana-1  Creating",
      " Container paragent-tb-9-5-21-grafana-1  Starting",
      "Error response from daemon: container is marked for removal",
    ].join("\n");
    const reason = composeFailureReason("", stdout);
    expect(reason).toContain("container is marked for removal");
  });

  it("says so plainly when there was no error line at all", () => {
    const reason = composeFailureReason(
      "",
      " Network x  Creating\n Container y  Creating\n",
    );
    // Quoting "Creating" as a reason is worse than admitting there wasn't one.
    expect(reason).toContain("no error line");
  });

  it("never returns an empty reason", () => {
    expect(composeFailureReason("", "")).not.toBe("");
  });
});

describe("formatRunLine", () => {
  const base = {
    run_id: "r",
    site_key: "s",
    task_key: "t",
    testbed_version: "11.0.0",
    repair_count: 1,
    success_with_le_2_repairs: true,
    steps_total: 4,
    steps_replay_valid: 3,
    self_healed: false,
    time_to_repair_total_ms: 0,
    step_results: [],
    wall_clock_total_ms: 2500,
  } as unknown as RunResult;

  it("says FAILED when the task did not succeed, even with valid steps", () => {
    const line = formatRunLine("11.0.0", { ...base, task_success: false });
    expect(line).toContain("FAILED");
    expect(line).toContain("steps_valid=3/4");
  });

  it("says SUCCESS only on task_success", () => {
    expect(formatRunLine("11.0.0", { ...base, task_success: true })).toContain(
      "SUCCESS",
    );
  });
});
