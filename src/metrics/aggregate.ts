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

/**
 * The §9 kill line: repair cost against a fresh run of the same task.
 *
 * Consumes `cost_fresh`, which is a **per-run** baseline and legitimately
 * appears on every row — this is a mean-of-ratios question, so a denominator is
 * needed on each run. That is the opposite of what `amortizedTokensOverN`
 * needs, which is why the two now read different fields (#123, ADR-0010).
 */
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

/**
 * One run's position on the amortization curve.
 *
 * `program_build_paid` marks the runs that carried a one-time payment — the
 * points where the curve steps *up*. A reader has to be able to see those: a
 * task recompiled after churn has paid full price twice, and a plot that shows
 * only the decline overstates the result (#123).
 */
export interface AmortizationPoint {
  n: number;
  amortized_tokens: number;
  program_build_paid: boolean;
}

/**
 * Published in the report, so it states exactly what is summed. `cost_fresh` is
 * deliberately **not** a term: it is a per-run comparison baseline (the
 * denominator of `repairCostVsFresh`), and summing it over N would grow the
 * numerator linearly with N and flatten the curve PRD §12 calls the demo.
 */
const AMORTIZED_FORMULA =
  "(sum(cost_program_build where present + cost_repair + cost_replay) over first N runs) / N " +
  "— no_data unless some run in the window carries a measured cost_program_build";

/**
 * The §12 curve: what one task costs per run once its one-time cost is spread
 * over N runs.
 *
 * **The numerator sums `cost_program_build`, not `cost_fresh` (#123).** The two
 * were one field, read as a one-time capital cost by this function and as a
 * per-run operating cost by `repairCostVsFresh`. Both readings are legitimate;
 * they are different quantities, and the disagreement was invisible only
 * because the field was always zeros. ADR-0010 splits them.
 *
 * **No payment measured → `no_data`, not a curve.** Replay costs no tokens, so
 * without a build cost the numerator is ~0 and the "curve" is a flat line at
 * zero — which would publish the strongest possible version of the claim on the
 * strength of a field nobody ever filled in. An unmeasured first point is
 * absent, never assumed (CONTRIBUTING rule 3).
 *
 * **A recompile stays in the same series.** A second payment appears as a step
 * up at the run that made it, rather than resetting N. Resetting would show two
 * clean declines and hide that full price was paid twice — see ADR-0010 for the
 * decision and what it costs.
 */
export function amortizedTokensOverN(
  rows: readonly MetricRow[],
  n?: number,
): {
  points: AmortizationPoint[];
  /**
   * `program_build_id` of every row that carried a payment, in run order.
   * Duplicates are **kept**: a repeated id means one build was paid for twice,
   * which is an emitter bug, and de-duplicating here would hide it behind a
   * prettier curve. Compare against `new Set(...).size`.
   */
  builds_paid: string[];
  section: GateReportSection;
} {
  const runs = [...filterRuns(rows)].sort((a, b) =>
    a.recorded_at.localeCompare(b.recorded_at),
  );
  const limit = n === undefined ? runs.length : Math.min(n, runs.length);
  const noData = (): {
    points: AmortizationPoint[];
    builds_paid: string[];
    section: GateReportSection;
  } => ({
    // Deliberately no points: an empty series renders as "no_data" in the SVG,
    // where a zero-valued series would render as a flat line labelled as the demo.
    points: [],
    builds_paid: [],
    section: {
      name: "amortized tokens/task over N runs",
      formula: AMORTIZED_FORMULA,
      value: null,
      status: "no_data",
      numerator: 0,
      denominator: 0,
    },
  });
  if (limit === 0) return noData();

  const points: AmortizationPoint[] = [];
  const buildsPaid: string[] = [];
  let cumulative = 0;
  for (let i = 0; i < limit; i++) {
    const r = runs[i]!;
    const paid = r.cost_program_build !== undefined;
    if (paid) {
      cumulative += totalTokens(r.cost_program_build!);
      // Schema `dependentRequired` guarantees the id when the cost is present;
      // the fallback names the violation rather than dropping the payment.
      buildsPaid.push(r.program_build_id ?? `<unattributed:${r.run_id}>`);
    }
    cumulative += totalTokens(r.cost_repair) + totalTokens(r.cost_replay);
    points.push({
      n: i + 1,
      amortized_tokens: cumulative / (i + 1),
      program_build_paid: paid,
    });
  }
  if (buildsPaid.length === 0) return noData();

  const last = points[points.length - 1]!;
  return {
    points,
    builds_paid: buildsPaid,
    section: {
      name: "amortized tokens/task over N runs",
      formula: AMORTIZED_FORMULA,
      value: last.amortized_tokens,
      status: "computed",
      numerator: cumulative,
      denominator: limit,
    },
  };
}

/**
 * Bucket totals across runs.
 *
 * `fresh` is a sum of per-run baselines and is **not** an amortization
 * numerator — see `amortizedTokensOverN`. `program_build` sums only the rows
 * that carried a payment, which is the quantity that is amortized.
 */
export function sumRunCosts(runs: readonly RunMetric[]): {
  fresh: Cost;
  program_build: Cost;
  replay: Cost;
  repair: Cost;
} {
  return runs.reduce(
    (acc, r) => ({
      fresh: addCost(acc.fresh, r.cost_fresh),
      program_build: r.cost_program_build
        ? addCost(acc.program_build, r.cost_program_build)
        : acc.program_build,
      replay: addCost(acc.replay, r.cost_replay),
      repair: addCost(acc.repair, r.cost_repair),
    }),
    {
      fresh: zeroCost(),
      program_build: zeroCost(),
      replay: zeroCost(),
      repair: zeroCost(),
    },
  );
}

export function buildGateReport(rows: readonly MetricRow[]): {
  prd_section: "§9";
  generated_at: string;
  row_counts: { step: number; run: number };
  sample: ReturnType<typeof section9SampleFloor>;
  metrics: GateReportSection[];
  per_version: VersionBreakdown[];
  amortized_points: AmortizationPoint[];
  /**
   * How many one-time payments the window contains, and for which builds.
   * `payments > distinct_builds` means one build id was paid for twice — kept
   * visible rather than corrected at aggregation time (#123).
   */
  amortization: {
    payments: number;
    distinct_builds: number;
    builds_paid: string[];
  };
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
    amortization: {
      payments: amortized.builds_paid.length,
      distinct_builds: new Set(amortized.builds_paid).size,
      builds_paid: amortized.builds_paid,
    },
  };
}
