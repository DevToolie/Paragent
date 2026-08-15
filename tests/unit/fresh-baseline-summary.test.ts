/**
 * `buildBaselineSummary()` (#39) — the aggregate math behind
 * `out/fresh-baseline/baseline.json`. Pure function, no Docker, no browser,
 * no network: exactly the kind of logic that must not only be exercised by a
 * live run, because a live run is expensive and this is not.
 *
 * What these guard:
 *
 * 1. **Mean and spread are computed over MEASURED runs only.** An attempt that
 *    could not be measured at all (all-zero, non-dry-run) is a missing data
 *    point, not a free one — averaging a true zero in would understate the
 *    cost rather than honestly report less data (CONTRIBUTING rule 3).
 * 2. **`usable` is false for a dry run, always** — even if, by construction,
 *    every stub row happens to look "measured" in some other sense.
 * 3. **`usable` is false when nothing could be measured**, so `gate:matrix
 *    --cost-fresh` has a machine-checkable reason to refuse rather than wire
 *    in a zero that looks like a real baseline.
 */

import { describe, expect, it } from "vitest";
import { buildBaselineSummary } from "../../experiments/gate-v1/fresh-baseline.js";

function record(overrides: Partial<Parameters<typeof buildBaselineSummary>[0]["records"][number]> = {}) {
  return {
    run_id: "r1",
    task_success: true,
    tokens_in: 100,
    tokens_out: 50,
    wall_clock_ms: 1000,
    turns: 3,
    notes: "done on turn 3",
    unmeasured: false,
    ...overrides,
  };
}

function baseOpts(overrides: Partial<Parameters<typeof buildBaselineSummary>[0]> = {}) {
  return {
    records: [record()],
    dryRun: false,
    effort: "medium",
    siteKey: "grafana-oss@9.5.21",
    taskKey: "create-stat-dashboard-from-testdata",
    testbedVersion: "9.5.21",
    taskGoal: "build and save a dashboard",
    generatedAt: "2026-08-14T00:00:00.000Z",
    ...overrides,
  };
}

describe("mean and spread", () => {
  it("computes the mean over measured runs, per field, independently", () => {
    const summary = buildBaselineSummary(
      baseOpts({
        records: [
          record({ run_id: "r1", tokens_in: 100, tokens_out: 20, wall_clock_ms: 1000 }),
          record({ run_id: "r2", tokens_in: 300, tokens_out: 40, wall_clock_ms: 3000 }),
          record({ run_id: "r3", tokens_in: 200, tokens_out: 60, wall_clock_ms: 2000 }),
        ],
      }),
    );
    expect(summary.mean_cost_fresh.tokens_in).toBe(200);
    expect(summary.mean_cost_fresh.tokens_out).toBe(40);
    expect(summary.mean_cost_fresh.wall_clock_ms).toBe(2000);
    expect(summary.spread).toEqual({
      tokens_in: { min: 100, max: 300 },
      tokens_out: { min: 20, max: 60 },
      wall_clock_ms: { min: 1000, max: 3000 },
    });
    expect(summary.measured_runs).toBe(3);
    expect(summary.runs_attempted).toBe(3);
  });

  it("reports a zero spread honestly when every measured run agreed exactly", () => {
    const summary = buildBaselineSummary(
      baseOpts({
        records: [
          record({ run_id: "r1", tokens_in: 500, tokens_out: 100, wall_clock_ms: 4000 }),
          record({ run_id: "r2", tokens_in: 500, tokens_out: 100, wall_clock_ms: 4000 }),
        ],
      }),
    );
    expect(summary.spread!.tokens_in).toEqual({ min: 500, max: 500 });
  });

  it("excludes an unmeasured attempt from the mean and spread — a missing point, not a free one", () => {
    const summary = buildBaselineSummary(
      baseOpts({
        records: [
          record({ run_id: "r1", tokens_in: 1000, tokens_out: 200, wall_clock_ms: 5000 }),
          record({ run_id: "r2", tokens_in: 0, tokens_out: 0, wall_clock_ms: 0, unmeasured: true, task_success: false }),
        ],
      }),
    );
    // If the zero row were averaged in, tokens_in would be 500 — it must not be.
    expect(summary.mean_cost_fresh.tokens_in).toBe(1000);
    expect(summary.measured_runs).toBe(1);
    expect(summary.runs_attempted).toBe(2);
  });

  it("mean_cost_fresh is zeroCost() and spread is null when nothing could be measured", () => {
    const summary = buildBaselineSummary(
      baseOpts({
        records: [record({ tokens_in: 0, tokens_out: 0, wall_clock_ms: 0, unmeasured: true, task_success: false })],
      }),
    );
    expect(summary.mean_cost_fresh).toEqual({ tokens_in: 0, tokens_out: 0, wall_clock_ms: 0 });
    expect(summary.spread).toBeNull();
    expect(summary.measured_runs).toBe(0);
  });
});

describe("model_id", () => {
  it("takes model_id from a measured record, never invents one", () => {
    const summary = buildBaselineSummary(
      baseOpts({ records: [record({ model_id: "claude-opus-5" })] }),
    );
    expect(summary.model_id).toBe("claude-opus-5");
    expect(summary.mean_cost_fresh.model_id).toBe("claude-opus-5");
  });

  it("is null when no measured record reported one", () => {
    const summary = buildBaselineSummary(baseOpts({ records: [record()] }));
    expect(summary.model_id).toBeNull();
  });
});

describe("usable", () => {
  it("is true only when live AND at least one run was measured", () => {
    const summary = buildBaselineSummary(baseOpts());
    expect(summary.usable).toBe(true);
  });

  it("is false for a dry run, even though the stub's zeros could otherwise look like data", () => {
    const summary = buildBaselineSummary(baseOpts({ dryRun: true }));
    expect(summary.usable).toBe(false);
    expect(summary.not_a_measurement).toBeDefined();
  });

  it("is false when every attempt was unmeasured", () => {
    const summary = buildBaselineSummary(
      baseOpts({
        records: [record({ tokens_in: 0, tokens_out: 0, wall_clock_ms: 0, unmeasured: true, task_success: false })],
      }),
    );
    expect(summary.usable).toBe(false);
  });
});

describe("successes and protocol fields", () => {
  it("counts task_success independently of whether an attempt was measured", () => {
    const summary = buildBaselineSummary(
      baseOpts({
        records: [
          record({ run_id: "r1", task_success: true }),
          record({ run_id: "r2", task_success: false }),
          record({ run_id: "r3", task_success: true }),
        ],
      }),
    );
    expect(summary.successes).toBe(2);
  });

  it("carries the protocol fields through unchanged", () => {
    const summary = buildBaselineSummary(baseOpts());
    expect(summary.effort).toBe("medium");
    expect(summary.site_key).toBe("grafana-oss@9.5.21");
    expect(summary.task_key).toBe("create-stat-dashboard-from-testdata");
    expect(summary.testbed_version).toBe("9.5.21");
    expect(summary.task_goal).toBe("build and save a dashboard");
    expect(summary.generated_at).toBe("2026-08-14T00:00:00.000Z");
    expect(summary.kind).toBe("fresh_baseline_run");
  });
});
