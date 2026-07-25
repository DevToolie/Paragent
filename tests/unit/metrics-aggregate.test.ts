import { describe, it, expect } from "vitest";
import {
  buildGateReport,
  stepReplayValidity,
  taskSuccessLe2Repairs,
  amortizedTokensOverN,
  selfHealRate,
} from "../../src/metrics/aggregate.js";
import { zeroCost } from "../../src/metrics/cost.js";
import { METRICS_SCHEMA_VERSION, type MetricRow } from "../../src/metrics/types.js";

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
    const amortized = amortizedTokensOverN(rows);
    expect(amortized.section.status).toBe("computed");
    expect(amortized.points[0]?.amortized_tokens).toBe(0);
  });
});
