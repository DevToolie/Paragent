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
  runsToClearSection9,
  substituteRunIndex,
} from "../../experiments/gate-v1/live-run.js";
import { buildSection9Floor } from "../../experiments/gate-v1/run-matrix.js";
import {
  perVersionBreakdown,
  section9SampleFloor,
} from "../../src/metrics/aggregate.js";
import { zeroCost } from "../../src/metrics/cost.js";
import { METRICS_SCHEMA_VERSION, type MetricRow } from "../../src/metrics/types.js";
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

// ---------------------------------------------------------------------------
// #66 — repeat runs. What these guard is the difference between "the repeats
// agreed" and "we only ran once", which a pooled ratio cannot express.
// ---------------------------------------------------------------------------

function stepRow(runId: string, stepIndex: number, valid: boolean, version = "9.5.21"): MetricRow {
  return {
    schema_version: METRICS_SCHEMA_VERSION,
    metric_kind: "step",
    run_id: runId,
    site_key: "grafana-oss@fixture",
    task_key: "t",
    step_index: stepIndex,
    testbed_version: version,
    outcome: valid ? "PASS" : "REPAIR_EXHAUSTED",
    replay_valid: valid,
    mode: "replay",
    cost: zeroCost(),
    recorded_at: "2026-07-29T00:00:00.000Z",
  } as MetricRow;
}

function runRow(runId: string, success: boolean, version = "9.5.21"): MetricRow {
  return {
    schema_version: METRICS_SCHEMA_VERSION,
    metric_kind: "run",
    run_id: runId,
    site_key: "grafana-oss@fixture",
    task_key: "t",
    testbed_version: version,
    task_success: success,
    repair_count: 0,
    success_with_le_2_repairs: success,
    steps_total: 2,
    steps_replay_valid: success ? 2 : 1,
    self_healed: false,
    time_to_repair_total_ms: 0,
    cost_fresh: zeroCost(),
    cost_replay: zeroCost(),
    cost_repair: zeroCost(),
    recorded_at: "2026-07-29T00:00:00.000Z",
  } as MetricRow;
}

describe("perVersionBreakdown", () => {
  it("separates 3/3 from 2/3 — the thing a pooled ratio hides", () => {
    const rows: MetricRow[] = [
      // 9.5.21: three clean runs.
      runRow("a1", true), stepRow("a1", 0, true), stepRow("a1", 1, true),
      runRow("a2", true), stepRow("a2", 0, true), stepRow("a2", 1, true),
      runRow("a3", true), stepRow("a3", 0, true), stepRow("a3", 1, true),
      // 11.0.0: one run lost a step.
      runRow("b1", true, "11.0.0"), stepRow("b1", 0, true, "11.0.0"), stepRow("b1", 1, true, "11.0.0"),
      runRow("b2", false, "11.0.0"), stepRow("b2", 0, true, "11.0.0"), stepRow("b2", 1, false, "11.0.0"),
      runRow("b3", true, "11.0.0"), stepRow("b3", 0, true, "11.0.0"), stepRow("b3", 1, true, "11.0.0"),
    ];

    const [nine, eleven] = perVersionBreakdown(rows);
    expect(nine!.testbed_version).toBe("11.0.0"); // sorted lexically
    expect(eleven!.testbed_version).toBe("9.5.21");

    const v11 = nine!;
    expect(v11.runs_attempted).toBe(3);
    expect(v11.runs_succeeded).toBe(2);
    expect(v11.step_validity_per_run).toEqual([1, 0.5, 1]);
    // The signal: these repeats disagreed. Pooling would have said 5/6.
    expect(v11.step_validity_spread).toBe(0.5);

    const v9 = eleven!;
    expect(v9.runs_succeeded).toBe(3);
    // Spread 0 means the repeats genuinely agreed — not "no data".
    expect(v9.step_validity_spread).toBe(0);
    expect(v9.status).toBe("computed");
  });

  it("reports no_data rather than 0 when a run emitted no step rows", () => {
    const [only] = perVersionBreakdown([runRow("a1", false)]);
    expect(only!.runs_attempted).toBe(1);
    expect(only!.status).toBe("no_data");
    // 0 would be indistinguishable from "every step failed".
    expect(only!.step_validity_spread).toBeNull();
    expect(only!.step_validity_min).toBeNull();
  });

  it("counts only attempted runs — a skipped version has no row to infer from", () => {
    // 11.0.0 was skipped, so it never emitted anything. Inventing a denominator
    // for it here would be worse than its absence; the skip lives in the ledger.
    const versions = perVersionBreakdown([runRow("a1", true), stepRow("a1", 0, true)]);
    expect(versions.map((v) => v.testbed_version)).toEqual(["9.5.21"]);
  });
});

describe("section9SampleFloor", () => {
  it("names both shortfalls when the sample is short", () => {
    const rows = [runRow("a1", true), stepRow("a1", 0, true)];
    const floor = section9SampleFloor(rows);
    expect(floor.meets_floor).toBe(false);
    expect(floor.shortfall).toContain("1/42 runs");
    expect(floor.shortfall).toContain("1/400 step-executions");
  });

  it("clears only when both floors are met", () => {
    const rows: MetricRow[] = [];
    for (let i = 0; i < 42; i++) {
      rows.push(runRow(`r${i}`, true));
      for (let s = 0; s < 10; s++) rows.push(stepRow(`r${i}`, s, true));
    }
    const floor = section9SampleFloor(rows);
    expect(floor.runs).toBe(42);
    expect(floor.step_executions).toBe(420);
    expect(floor.meets_floor).toBe(true);
    expect(floor.shortfall).toBeNull();
  });

  it("does not clear on runs alone when step-executions are short", () => {
    // 42 one-step runs: the run floor is met, the step floor is not.
    const rows: MetricRow[] = [];
    for (let i = 0; i < 42; i++) {
      rows.push(runRow(`r${i}`, true), stepRow(`r${i}`, 0, true));
    }
    const floor = section9SampleFloor(rows);
    expect(floor.meets_floor).toBe(false);
    expect(floor.shortfall).toContain("step-executions");
    expect(floor.shortfall).not.toContain("runs");
  });
});

// ---------------------------------------------------------------------------
// #95 — matrix-run.json's section9_floor must agree with report.json's. Both
// have to read the same conclusion off the same NDJSON rows, not one of them
// off `runs.length * program.steps.length`, which assumes every run executed
// every step.
// ---------------------------------------------------------------------------

describe("buildSection9Floor", () => {
  it("agrees with section9SampleFloor's honest count when runs fail partway", () => {
    // 42 runs against a 10-step program: runs.length * steps.length = 420,
    // clearing the naive floor. But 3 of those runs broke on a hard failure
    // after 1 step each (the exact scenario run-matrix.ts's loop produces:
    // `ReplayRunner.run()` breaks out of the step loop on a non-success
    // outcome, so `stepResults` is shorter than `program.steps.length`).
    // Actual step-executions: 39 * 10 + 3 * 1 = 393 — below the 400 floor.
    const rows: MetricRow[] = [];
    for (let i = 0; i < 42; i++) {
      rows.push(runRow(`r${i}`, true));
      const stepsThisRun = i < 3 ? 1 : 10;
      for (let s = 0; s < stepsThisRun; s++) rows.push(stepRow(`r${i}`, s, true));
    }

    const floor = buildSection9Floor(rows, 8);

    // The bug this guards: `runs.length * programSteps >= 400` would read
    // `42 * 10 = 420 >= 400` as true here, disagreeing with report.json.
    expect(42 * 10).toBeGreaterThanOrEqual(400);
    expect(floor.meets_floor).toBe(false);
    // Must be the exact same verdict `section9SampleFloor` (report.json's
    // basis) would give on the identical rows — that agreement is the fix.
    expect(floor.meets_floor).toBe(section9SampleFloor(rows).meets_floor);
  });

  it("still clears when every run actually executed every step", () => {
    const rows: MetricRow[] = [];
    for (let i = 0; i < 42; i++) {
      rows.push(runRow(`r${i}`, true));
      for (let s = 0; s < 10; s++) rows.push(stepRow(`r${i}`, s, true));
    }
    const floor = buildSection9Floor(rows, 8);
    expect(floor.meets_floor).toBe(true);
    expect(floor.min_runs).toBe(42);
    expect(floor.min_step_executions).toBe(400);
  });

  it("carries runs_needed_per_version from runsToClearSection9, not a duplicate calc", () => {
    const floor = buildSection9Floor([], 8);
    expect(floor.runs_needed_per_version).toBe(runsToClearSection9(8));
  });
});

describe("runsToClearSection9", () => {
  it("needs 6 across the eight ADR-0003 pins, not 5", () => {
    // 8 x 5 = 40, two short of the 42 floor. Worth pinning: the off-by-one is
    // exactly the kind of thing that ships as "we cleared §9".
    expect(runsToClearSection9(8)).toBe(6);
    expect(8 * 5).toBeLessThan(42);
    expect(8 * runsToClearSection9(8)).toBeGreaterThanOrEqual(42);
  });

  it("handles a single version and an empty matrix", () => {
    expect(runsToClearSection9(1)).toBe(42);
    expect(runsToClearSection9(0)).toBe(0);
  });
});

describe("substituteRunIndex", () => {
  it("makes a state-mutating param unique per run", () => {
    // Without this, run 2 of the gate task collides with run 1's dashboard and
    // fails for a reason that is not churn.
    const p = substituteRunIndex({ dashboard_title: "Gate {run}" }, 2);
    expect(p["dashboard_title"]).toBe("Gate 2");
  });

  it("leaves params without the token untouched", () => {
    const p = substituteRunIndex({ username: "admin", title: "x {run} y {run}" }, 3);
    expect(p["username"]).toBe("admin");
    expect(p["title"]).toBe("x 3 y 3");
  });

  it("returns a new object, so one run cannot mutate the next run's bindings", () => {
    const original = { title: "Gate {run}" };
    const out = substituteRunIndex(original, 1);
    expect(original["title"]).toBe("Gate {run}");
    expect(out).not.toBe(original);
  });
});
