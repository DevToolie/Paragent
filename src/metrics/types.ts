/**
 * Types aligned with contracts/metrics.schema.json (schema_version 1.0.0).
 * Source: contracts/metrics.schema.json — access_date: 2026-07-24
 */

export const METRICS_SCHEMA_VERSION = "1.0.0" as const;

export type StepOutcome =
  | "PASS"
  | "ASSERTION_FAILED"
  | "LOCATOR_NOT_FOUND"
  | "TIMEOUT"
  | "PAGE_ERROR"
  | "REPAIRED_PASS"
  | "REPAIR_EXHAUSTED";

export type StepMode = "fresh" | "replay" | "repair";
export type AssertionStrength = "strong" | "weak";

export interface Cost {
  tokens_in: number;
  tokens_out: number;
  wall_clock_ms: number;
  model_id?: string;
}

export interface StepMetric {
  schema_version: typeof METRICS_SCHEMA_VERSION;
  metric_kind: "step";
  run_id: string;
  site_key: string;
  task_key: string;
  step_index: number;
  testbed_version: string;
  outcome: StepOutcome;
  replay_valid: boolean;
  mode: StepMode;
  cost: Cost;
  repair_attempt?: number;
  time_to_repair_ms?: number;
  assertion_strength?: AssertionStrength;
  recorded_at: string;
}

export interface RunMetric {
  schema_version: typeof METRICS_SCHEMA_VERSION;
  metric_kind: "run";
  run_id: string;
  site_key: string;
  task_key: string;
  testbed_version: string;
  task_success: boolean;
  repair_count: number;
  success_with_le_2_repairs: boolean;
  steps_total: number;
  steps_replay_valid: number;
  self_healed: boolean;
  time_to_repair_total_ms?: number;
  /**
   * Per-run comparison baseline: what a fresh run of this task costs *now*.
   *
   * The denominator of `repairCostVsFresh`, which is a per-run ratio and needs a
   * value on every row. **Never summed into the amortization numerator** — see
   * `cost_program_build` and ADR-0010. Zeros mean "not measured".
   */
  cost_fresh: Cost;
  /**
   * One-time capital cost: producing the compiled program this run replays.
   *
   * Present only on the run that consumed a given build's payment; **absent**
   * means never measured, and amortization reports `no_data` rather than
   * assuming a first point. Requires `program_build_id` when present.
   */
  cost_program_build?: Cost;
  /** Which compiled build this run replays. A recompile is a new id (ADR-0010). */
  program_build_id?: string;
  cost_replay: Cost;
  cost_repair: Cost;
  wall_clock_total_ms: number;
  amortized_cost_tokens?: number;
  recorded_at: string;
}

export type MetricRow = StepMetric | RunMetric;

export interface GateReportSection {
  name: string;
  formula: string;
  value: number | null;
  status: "computed" | "no_data";
  numerator?: number;
  denominator?: number;
}
