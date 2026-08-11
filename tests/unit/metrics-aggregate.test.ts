import { describe, it, expect } from "vitest";
import {
  buildGateReport,
  stepReplayValidity,
  taskSuccessLe2Repairs,
  amortizedTokensOverN,
  repairCostVsFresh,
  selfHealRate,
} from "../../src/metrics/aggregate.js";
import { zeroCost } from "../../src/metrics/cost.js";
import {
  METRICS_SCHEMA_VERSION,
  type Cost,
  type MetricRow,
  type RunMetric,
} from "../../src/metrics/types.js";

describe("metrics aggregate", () => {
  it("returns no_data (null) for empty rows — never invents rates", () => {
    const report = buildGateReport([]);
    expect(report.row_counts).toEqual({ step: 0, run: 0 });
    for (const m of report.metrics) {
      expect(m.status).toBe("no_data");
      expect(m.value).toBeNull();
    }
    expect(report.amortized_points).toEqual([]);
  });

  it("computes step replay-validity from measured rows only", () => {
    const rows: MetricRow[] = [
      {
        schema_version: METRICS_SCHEMA_VERSION,
        metric_kind: "step",
        run_id: "r1",
        site_key: "local-demo",
        task_key: "t",
        step_index: 0,
        testbed_version: "pending-b1@placeholder",
        outcome: "PASS",
        replay_valid: true,
        mode: "replay",
        cost: zeroCost(),
        recorded_at: "2026-07-24T00:00:00.000Z",
      },
      {
        schema_version: METRICS_SCHEMA_VERSION,
        metric_kind: "step",
        run_id: "r1",
        site_key: "local-demo",
        task_key: "t",
        step_index: 1,
        testbed_version: "pending-b1@placeholder",
        outcome: "ASSERTION_FAILED",
        replay_valid: false,
        mode: "replay",
        cost: zeroCost(),
        recorded_at: "2026-07-24T00:00:01.000Z",
      },
    ];
    const section = stepReplayValidity(rows);
    expect(section.status).toBe("computed");
    expect(section.numerator).toBe(1);
    expect(section.denominator).toBe(2);
    expect(section.value).toBe(0.5);
  });

  it("computes task success ≤2 repairs from run rows", () => {
    const rows: MetricRow[] = [
      {
        schema_version: METRICS_SCHEMA_VERSION,
        metric_kind: "run",
        run_id: "r1",
        site_key: "local-demo",
        task_key: "t",
        testbed_version: "pending-b1@placeholder",
        task_success: true,
        repair_count: 1,
        success_with_le_2_repairs: true,
        steps_total: 2,
        steps_replay_valid: 1,
        self_healed: true,
        cost_fresh: zeroCost(),
        cost_replay: zeroCost(),
        cost_repair: { tokens_in: 0, tokens_out: 0, wall_clock_ms: 10 },
        wall_clock_total_ms: 20,
        recorded_at: "2026-07-24T00:00:02.000Z",
      },
    ];
    expect(taskSuccessLe2Repairs(rows).value).toBe(1);
    expect(selfHealRate(rows).value).toBe(1);
    // Amortization is deliberately no_data here, not 0: this run carries no
    // measured cost_program_build, so there is no one-time cost to spread. It
    // used to report `computed` with a flat zero curve (#123).
    const amortized = amortizedTokensOverN(rows);
    expect(amortized.section.status).toBe("no_data");
    expect(amortized.section.value).toBeNull();
    expect(amortized.points).toEqual([]);
  });
});

/**
 * #123 — `cost_fresh` was a per-run field consumed as a one-time cost.
 *
 * These pin the split, and the first one fails on `main`: ten runs each
 * carrying a fresh cost produced a flat curve *and* `status: "computed"`, which
 * is the demo curve reading as "the thesis failed" because a field was
 * misconfigured.
 */
describe("amortization cost model (#123 / ADR-0010)", () => {
  const runRow = (
    i: number,
    extra: Partial<RunMetric> = {},
  ): RunMetric => ({
    schema_version: METRICS_SCHEMA_VERSION,
    metric_kind: "run",
    run_id: `r${i}`,
    site_key: "local-demo",
    task_key: "t",
    testbed_version: "pending-b1@placeholder",
    task_success: true,
    repair_count: 0,
    success_with_le_2_repairs: true,
    steps_total: 2,
    steps_replay_valid: 2,
    self_healed: false,
    cost_fresh: { tokens_in: 12000, tokens_out: 800, wall_clock_ms: 45000 },
    cost_replay: { tokens_in: 0, tokens_out: 0, wall_clock_ms: 180 },
    cost_repair: zeroCost(),
    wall_clock_total_ms: 180,
    // Zero-padded so the lexicographic sort in the aggregate matches run order.
    recorded_at: `2026-07-24T00:${String(i).padStart(2, "0")}:00.000Z`,
    ...extra,
  });

  it("does not flatten when every run carries a per-run fresh baseline", () => {
    const build: Cost = { tokens_in: 12000, tokens_out: 800, wall_clock_ms: 45000 };
    const rows: MetricRow[] = Array.from({ length: 10 }, (_, i) =>
      i === 0
        ? runRow(i, { cost_program_build: build, program_build_id: "build-1" })
        : runRow(i),
    );

    const { points, section, builds_paid } = amortizedTokensOverN(rows);
    expect(section.status).toBe("computed");
    expect(builds_paid).toEqual(["build-1"]);

    // The whole point: strictly decreasing, and by an order of magnitude across
    // ten runs. Summing cost_fresh instead would hold it at 12800 throughout.
    expect(points).toHaveLength(10);
    expect(points[0]!.amortized_tokens).toBe(12800);
    expect(points[9]!.amortized_tokens).toBe(1280);
    for (let i = 1; i < points.length; i++) {
      expect(points[i]!.amortized_tokens).toBeLessThan(
        points[i - 1]!.amortized_tokens,
      );
    }
    // The per-run baseline is untouched and still answers its own question.
    expect(repairCostVsFresh(rows).tokens.denominator).toBe(12800);
  });

  it("reports no_data when no run carries a measured one-time cost", () => {
    const rows: MetricRow[] = Array.from({ length: 10 }, (_, i) => runRow(i));
    const { points, section, builds_paid } = amortizedTokensOverN(rows);
    expect(section.status).toBe("no_data");
    expect(section.value).toBeNull();
    expect(points).toEqual([]);
    expect(builds_paid).toEqual([]);
  });

  it("shows a recompile as a second payment, never as a hidden reset", () => {
    const build: Cost = { tokens_in: 1000, tokens_out: 0, wall_clock_ms: 1 };
    const rows: MetricRow[] = [
      runRow(0, { cost_program_build: build, program_build_id: "build-1" }),
      runRow(1),
      runRow(2, { cost_program_build: build, program_build_id: "build-2" }),
      runRow(3),
    ];
    const { points, builds_paid } = amortizedTokensOverN(rows);
    expect(builds_paid).toEqual(["build-1", "build-2"]);
    expect(points.map((p) => p.program_build_paid)).toEqual([
      true,
      false,
      true,
      false,
    ]);
    // 1000/1, 1000/2, 2000/3, 2000/4 — the step up at run 3 is visible.
    expect(points.map((p) => p.amortized_tokens)).toEqual([
      1000, 500, 2000 / 3, 500,
    ]);
    expect(points[2]!.amortized_tokens).toBeGreaterThan(
      points[1]!.amortized_tokens,
    );

    const report = buildGateReport(rows);
    expect(report.amortization).toEqual({
      payments: 2,
      distinct_builds: 2,
      builds_paid: ["build-1", "build-2"],
    });
  });

  it("keeps a duplicated build id visible instead of de-duplicating it", () => {
    const build: Cost = { tokens_in: 1000, tokens_out: 0, wall_clock_ms: 1 };
    const rows: MetricRow[] = [
      runRow(0, { cost_program_build: build, program_build_id: "build-1" }),
      runRow(1, { cost_program_build: build, program_build_id: "build-1" }),
    ];
    const report = buildGateReport(rows);
    expect(report.amortization.payments).toBe(2);
    expect(report.amortization.distinct_builds).toBe(1);
  });

  it("publishes a formula string that matches what is summed", () => {
    const build: Cost = { tokens_in: 7, tokens_out: 3, wall_clock_ms: 1 };
    const rows: MetricRow[] = [
      runRow(0, {
        cost_program_build: build,
        program_build_id: "build-1",
        cost_repair: { tokens_in: 5, tokens_out: 0, wall_clock_ms: 1 },
        cost_replay: { tokens_in: 1, tokens_out: 1, wall_clock_ms: 1 },
      }),
    ];
    const { section } = amortizedTokensOverN(rows);
    expect(section.formula).toContain("cost_program_build");
    expect(section.formula).not.toContain("cost_fresh");
    // 7+3 (build) + 5 (repair) + 1+1 (replay) = 17, over 1 run. cost_fresh
    // (12800 tokens on this row) is not a term.
    expect(section.numerator).toBe(17);
    expect(section.denominator).toBe(1);
    expect(section.value).toBe(17);
  });
});
