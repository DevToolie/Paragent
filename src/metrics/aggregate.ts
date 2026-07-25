/**
 * PRD §9 aggregate computation from measured MetricRow[] only.
 * Sources: docs/prd/PRD-trajectory-cache-v0.2.md §9; contracts/metrics.schema.json
 * access_date: 2026-07-24 — never invents values.
 */

import type {
  Cost,
  GateReportSection,
  MetricRow,
  RunMetric,
  StepMetric,
} from "./types.js";
import { addCost, totalTokens, zeroCost } from "./cost.js";

function isStep(row: MetricRow): row is StepMetric {
  return row.metric_kind === "step";
}
function isRun(row: MetricRow): row is RunMetric {
  return row.metric_kind === "run";
}

export function filterRuns(rows: readonly MetricRow[]): RunMetric[] {
  return rows.filter(isRun);
}
export function filterSteps(rows: readonly MetricRow[]): StepMetric[] {
  return rows.filter(isStep);
}

function dedupeLatestSteps(steps: StepMetric[]): StepMetric[] {
  const map = new Map<string, StepMetric>();
  for (const s of steps) map.set(`${s.run_id}::${s.step_index}`, s);
  return [...map.values()];
}

export function stepReplayValidity(
  rows: readonly MetricRow[],
): GateReportSection {
  const steps = dedupeLatestSteps(filterSteps(rows));
  const denominator = steps.length;
  const numerator = steps.filter((s) => s.replay_valid).length;
  if (denominator === 0) {
    return {
      name: "step-level replay-validity",
      formula: "count(replay_valid=true) / count(compiled steps executed)",
      value: null,
      status: "no_data",
      numerator: 0,
      denominator: 0,
    };
  }
  return {
    name: "step-level replay-validity",
    formula: "count(replay_valid=true) / count(compiled steps executed)",
    value: numerator / denominator,
    status: "computed",
    numerator,
    denominator,
  };
}

export function taskSuccessLe2Repairs(
  rows: readonly MetricRow[],
): GateReportSection {
  const runs = filterRuns(rows);
  const denominator = runs.length;
  const numerator = runs.filter((r) => r.success_with_le_2_repairs).length;
  if (denominator === 0) {
    return {
      name: "task-level success (with ≤2 repairs/run)",
      formula: "count(success_with_le_2_repairs=true) / count(runs)",
      value: null,
      status: "no_data",
      numerator: 0,
      denominator: 0,
    };
  }
  return {
    name: "task-level success (with ≤2 repairs/run)",
    formula: "count(success_with_le_2_repairs=true) / count(runs)",
    value: numerator / denominator,
    status: "computed",
    numerator,
    denominator,
  };
}

export function repairCostVsFresh(rows: readonly MetricRow[]): {
  tokens: GateReportSection;
  wall_clock: GateReportSection;
} {
  const runs = filterRuns(rows);
  const empty = (name: string, formula: string): GateReportSection => ({
    name,
    formula,
    value: null,
    status: "no_data",
    numerator: 0,
    denominator: 0,
  });
  if (runs.length === 0) {
    return {
      tokens: empty(
        "repair cost vs fresh (tokens)",
        "mean(cost_repair.tokens) / mean(cost_fresh.tokens)",
      ),
      wall_clock: empty(
        "repair cost vs fresh (wall-clock)",
        "mean(cost_repair.wall_clock_ms) / mean(cost_fresh.wall_clock_ms)",
      ),
    };
  }
  const meanFreshTokens =
    runs.reduce((s, r) => s + totalTokens(r.cost_fresh), 0) / runs.length;
  const meanRepairTokens =
    runs.reduce((s, r) => s + totalTokens(r.cost_repair), 0) / runs.length;
  const meanFreshMs =
    runs.reduce((s, r) => s + r.cost_fresh.wall_clock_ms, 0) / runs.length;
  const meanRepairMs =
    runs.reduce((s, r) => s + r.cost_repair.wall_clock_ms, 0) / runs.length;
  return {
    tokens: {
      name: "repair cost vs fresh (tokens)",
      formula: "mean(cost_repair.tokens) / mean(cost_fresh.tokens)",
      value: meanFreshTokens > 0 ? meanRepairTokens / meanFreshTokens : null,
      status: meanFreshTokens > 0 ? "computed" : "no_data",
      numerator: meanRepairTokens,
      denominator: meanFreshTokens,
    },
    wall_clock: {
      name: "repair cost vs fresh (wall-clock)",
      formula:
        "mean(cost_repair.wall_clock_ms) / mean(cost_fresh.wall_clock_ms)",
      value: meanFreshMs > 0 ? meanRepairMs / meanFreshMs : null,
      status: meanFreshMs > 0 ? "computed" : "no_data",
      numerator: meanRepairMs,
      denominator: meanFreshMs,
    },
  };
}

export function selfHealRate(rows: readonly MetricRow[]): GateReportSection {
  const failingFirstPass = filterRuns(rows).filter(
    (r) => r.steps_total > 0 && r.steps_replay_valid < r.steps_total,
  );
  const denominator = failingFirstPass.length;
  const numerator = failingFirstPass.filter((r) => r.self_healed).length;
  if (denominator === 0) {
    return {
      name: "self-heal success rate",
      formula:
        "count(self_healed=true) / count(runs with steps_replay_valid < steps_total)",
      value: null,
      status: "no_data",
      numerator: 0,
      denominator: 0,
    };
  }
  return {
    name: "self-heal success rate",
    formula:
      "count(self_healed=true) / count(runs with steps_replay_valid < steps_total)",
    value: numerator / denominator,
    status: "computed",
    numerator,
    denominator,
  };
}

export function meanTimeToRepair(
  rows: readonly MetricRow[],
): GateReportSection {
  const withRepair = filterRuns(rows).filter(
    (r) => (r.time_to_repair_total_ms ?? 0) > 0,
  );
  const denominator = withRepair.length;
  if (denominator === 0) {
    return {
      name: "time-to-repair (mean ms)",
      formula: "mean(time_to_repair_total_ms) over runs with repairs",
      value: null,
      status: "no_data",
      numerator: 0,
      denominator: 0,
    };
  }
  const sum = withRepair.reduce(
    (s, r) => s + (r.time_to_repair_total_ms ?? 0),
    0,
  );
  return {
    name: "time-to-repair (mean ms)",
    formula: "mean(time_to_repair_total_ms) over runs with repairs",
    value: sum / denominator,
    status: "computed",
    numerator: sum,
    denominator,
  };
}

export function amortizedTokensOverN(
  rows: readonly MetricRow[],
  n?: number,
): {
  points: Array<{ n: number; amortized_tokens: number }>;
  section: GateReportSection;
} {
  const runs = [...filterRuns(rows)].sort((a, b) =>
    a.recorded_at.localeCompare(b.recorded_at),
  );
  const limit = n === undefined ? runs.length : Math.min(n, runs.length);
  const points: Array<{ n: number; amortized_tokens: number }> = [];
  if (limit === 0) {
    return {
      points: [],
      section: {
        name: "amortized tokens/task over N runs",
        formula:
          "(sum(cost_fresh + cost_repair + cost_replay) over first N runs) / N",
        value: null,
        status: "no_data",
        numerator: 0,
        denominator: 0,
      },
    };
  }
  let cumulative = 0;
  for (let i = 0; i < limit; i++) {
    const r = runs[i]!;
    cumulative +=
      totalTokens(r.cost_fresh) +
      totalTokens(r.cost_repair) +
      totalTokens(r.cost_replay);
    points.push({ n: i + 1, amortized_tokens: cumulative / (i + 1) });
  }
  const last = points[points.length - 1]!;
  return {
    points,
    section: {
      name: "amortized tokens/task over N runs",
      formula:
        "(sum(cost_fresh + cost_repair + cost_replay) over first N runs) / N",
      value: last.amortized_tokens,
      status: "computed",
      numerator: cumulative,
      denominator: limit,
    },
  };
}

export function sumRunCosts(runs: readonly RunMetric[]): {
  fresh: Cost;
  replay: Cost;
  repair: Cost;
} {
  return runs.reduce(
    (acc, r) => ({
      fresh: addCost(acc.fresh, r.cost_fresh),
      replay: addCost(acc.replay, r.cost_replay),
      repair: addCost(acc.repair, r.cost_repair),
    }),
    { fresh: zeroCost(), replay: zeroCost(), repair: zeroCost() },
  );
}

export function buildGateReport(rows: readonly MetricRow[]): {
  prd_section: "§9";
  generated_at: string;
  row_counts: { step: number; run: number };
  metrics: GateReportSection[];
  amortized_points: Array<{ n: number; amortized_tokens: number }>;
} {
  const repairVs = repairCostVsFresh(rows);
  const amortized = amortizedTokensOverN(rows);
  return {
    prd_section: "§9",
    generated_at: new Date().toISOString(),
    row_counts: {
      step: filterSteps(rows).length,
      run: filterRuns(rows).length,
    },
    metrics: [
      stepReplayValidity(rows),
      taskSuccessLe2Repairs(rows),
      repairVs.tokens,
      repairVs.wall_clock,
      selfHealRate(rows),
      meanTimeToRepair(rows),
      amortized.section,
    ],
    amortized_points: amortized.points,
  };
}
