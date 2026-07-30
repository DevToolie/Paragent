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

/**
 * Per-version breakdown — the thing a pooled ratio hides.
 *
 * Every §9 aggregate above pools across the whole matrix, so a version that
 * succeeded 5/5 and one that succeeded 3/5 contribute to the same number and
 * become indistinguishable. Those are different findings: the first is a version
 * the task survives, the second is either real churn or harness flakiness, and
 * the report has to let a reader see which versions moved.
 *
 * **Spread is the flakiness signal.** Repeat runs of one version against an
 * unchanged instance should agree. If `step_validity_per_run` varies there, the
 * variation is the harness's, not the surface's — and that has to be understood
 * before any matrix number is trusted (#66).
 *
 * Counts only what the NDJSON contains, which is **attempted** runs. A version
 * that was skipped never produced a row, and inferring it here would invent a
 * denominator; the skip and its reason live in the driver's
 * `out/matrix-run.json` ledger instead.
 */
export interface VersionBreakdown {
  testbed_version: string;
  runs_attempted: number;
  runs_succeeded: number;
  /** Step-level replay-validity per run, ordered as the runs were emitted. */
  step_validity_per_run: number[];
  /** null when there are no completed runs — never 0, which would read as agreement. */
  step_validity_min: number | null;
  step_validity_max: number | null;
  /** max - min. null on no data; 0 means the repeats genuinely agreed. */
  step_validity_spread: number | null;
  status: "computed" | "no_data";
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const list = map.get(key(item));
    if (list) list.push(item);
    else map.set(key(item), [item]);
  }
  return map;
}

function summarizeVersion(
  version: string,
  versionRuns: RunMetric[],
  stepsByRun: Map<string, StepMetric[]>,
): VersionBreakdown {
  const validity = versionRuns
    .map((r) => stepsByRun.get(r.run_id) ?? [])
    // A run with no step rows has no validity to report. Scoring it 0 would be
    // indistinguishable from a run where every step genuinely failed.
    .filter((runSteps) => runSteps.length > 0)
    .map((runSteps) => runSteps.filter((s) => s.replay_valid).length / runSteps.length);

  if (validity.length === 0) {
    return {
      testbed_version: version,
      runs_attempted: versionRuns.length,
      runs_succeeded: versionRuns.filter((r) => r.task_success).length,
      step_validity_per_run: [],
      step_validity_min: null,
      step_validity_max: null,
      step_validity_spread: null,
      status: "no_data",
    };
  }

  const min = Math.min(...validity);
  const max = Math.max(...validity);
  return {
    testbed_version: version,
    runs_attempted: versionRuns.length,
    runs_succeeded: versionRuns.filter((r) => r.task_success).length,
    step_validity_per_run: validity,
    step_validity_min: min,
    step_validity_max: max,
    step_validity_spread: max - min,
    status: "computed",
  };
}

export function perVersionBreakdown(
  rows: readonly MetricRow[],
): VersionBreakdown[] {
  const stepsByRun = groupBy(dedupeLatestSteps(filterSteps(rows)), (s) => s.run_id);
  const byVersion = groupBy(filterRuns(rows), (r) => r.testbed_version);

  return [...byVersion.entries()]
    .map(([version, versionRuns]) =>
      summarizeVersion(version, versionRuns, stepsByRun),
    )
    // Stable order so two reports over the same data diff cleanly.
    .sort((a, b) => a.testbed_version.localeCompare(b.testbed_version));
}

/**
 * Whether the run count clears PRD §9's sampling floor.
 *
 * §9 specifies 3×/day for 14 days — **≥42 runs and ≥400 step-executions**. The
 * pivot swaps the calendar for the version matrix, but the statistical floor
 * survives the substitution: eight pins at one run each is 8 runs, an order of
 * magnitude short, and cannot separate churn from noise.
 *
 * Reported rather than enforced. A short sample is still worth looking at; what
 * must not happen is a short sample being read as a gate measurement, so this
 * says plainly which one you are holding.
 */
export const SECTION9_MIN_RUNS = 42;
export const SECTION9_MIN_STEP_EXECUTIONS = 400;

export function section9SampleFloor(rows: readonly MetricRow[]): {
  runs: number;
  step_executions: number;
  meets_floor: boolean;
  shortfall: string | null;
} {
  const runs = filterRuns(rows).length;
  const stepExecutions = dedupeLatestSteps(filterSteps(rows)).length;
  const meets =
    runs >= SECTION9_MIN_RUNS && stepExecutions >= SECTION9_MIN_STEP_EXECUTIONS;

  const missing: string[] = [];
  if (runs < SECTION9_MIN_RUNS) {
    missing.push(`${runs}/${SECTION9_MIN_RUNS} runs`);
  }
  if (stepExecutions < SECTION9_MIN_STEP_EXECUTIONS) {
    missing.push(`${stepExecutions}/${SECTION9_MIN_STEP_EXECUTIONS} step-executions`);
  }

  return {
    runs,
    step_executions: stepExecutions,
    meets_floor: meets,
    shortfall: missing.length > 0 ? `below PRD §9 floor: ${missing.join(", ")}` : null,
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
  sample: ReturnType<typeof section9SampleFloor>;
  metrics: GateReportSection[];
  per_version: VersionBreakdown[];
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
    // Stated before the metrics, deliberately: a reader has to know whether the
    // sample can carry them before reading the numbers.
    sample: section9SampleFloor(rows),
    metrics: [
      stepReplayValidity(rows),
      taskSuccessLe2Repairs(rows),
      repairVs.tokens,
      repairVs.wall_clock,
      selfHealRate(rows),
      meanTimeToRepair(rows),
      amortized.section,
    ],
    per_version: perVersionBreakdown(rows),
    amortized_points: amortized.points,
  };
}
