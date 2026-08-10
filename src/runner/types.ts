/**
 * Runner types aligned with:
 * - contracts/cache-row.schema.json
 * - contracts/assertion.schema.json
 * - contracts/metrics.schema.json
 * access_date: 2026-07-24
 */

import type { Cost, StepMode, StepOutcome } from "../metrics/types.js";

export type LocatorStrategy =
  | "role_name"
  | "label"
  | "testid"
  | "structural"
  | "text"
  | "placeholder"
  | "css_vocab"
  | "topology_only";

export type ActionType =
  | "navigate"
  | "click"
  | "fill"
  | "select"
  | "check"
  | "uncheck"
  | "press"
  | "hover"
  | "wait"
  | "upload"
  | "custom";

export type AssertionType =
  | "element-visible"
  | "text-matches"
  | "url-matches"
  | "count-equals"
  | "network-idle"
  | "custom";

export type AssertionStrength = "strong" | "weak";

export type FailureClassification =
  | "assertion_failed"
  | "locator_not_found"
  | "timeout"
  | "page_error"
  | "network_error"
  | "unknown";

export type ParamType =
  | "string"
  | "email"
  | "url"
  | "integer"
  | "number"
  | "boolean"
  | "enum"
  | "secret_ref"
  | "json";

/** Runtime bindings for template holes — values are never persisted in contracts. */
export type ParamBindings = Record<string, string | number | boolean>;

export interface LocatorSpec {
  strategy: LocatorStrategy;
  role?: string;
  name?: string;
  label?: string;
  testid?: string;
  structural_path?: string;
  text?: string;
  css?: string;
  tenant_scoped?: boolean;
}

export interface CompiledAction {
  type: ActionType;
  param_refs?: string[];
  url_template?: string;
  key?: string;
  custom_op?: string;
  /** For wait actions: the recorded duration in milliseconds (ADR-0008). */
  wait_ms?: number;
  locator_fallback_chain: LocatorSpec[];
}

export interface AssertionTarget {
  locator?: LocatorSpec;
  url_template?: string;
  count_scope?: string;
}

export interface AssertionExpected {
  template?: string;
  param_types?: Record<string, ParamType>;
  regex_template?: string;
  count?: number;
  visible?: boolean;
  custom_predicate_id?: string;
}

export interface Assertion {
  schema_version: "1.0.0";
  assertion_id: string;
  type: AssertionType;
  strength: AssertionStrength;
  target?: AssertionTarget;
  expected?: AssertionExpected;
  timeout_ms: number;
  failure_classification: FailureClassification;
  notes?: string;
}

export interface CompiledStep {
  step_index: number;
  row_id?: string;
  compiled_action: CompiledAction;
  assertion: Assertion;
}

export interface CompiledProgram {
  schema_version: "1.0.0";
  program_id: string;
  site_key: string;
  task_key: string;
  testbed_version: string;
  steps: CompiledStep[];
}

/**
 * Privacy-safe page snapshot for repair context.
 * Never includes cookies, storage, or raw HTML.
 * Source posture: contracts/trajectory.schema.json fingerprint (no HTML).
 */
export interface PageStateSnapshot {
  url: string;
  title: string;
  visible_landmarks: string[];
  network_idle: boolean;
  captured_at: string;
}

export interface RepairContext {
  run_id: string;
  step: CompiledStep;
  /** Frozen copy — repair MUST NOT mutate. */
  assertion: Assertion;
  failed_outcome: StepOutcome;
  page_state: PageStateSnapshot;
  attempt: number;
  error_message?: string;
  params: ParamBindings;
}

export interface RepairProposal {
  /** Corrected action only — assertion changes are forbidden. */
  corrected_action: CompiledAction | null;
  tokens_in: number;
  tokens_out: number;
  model_id?: string;
  notes?: string;
}

export interface StepAttemptResult {
  step_index: number;
  outcome: StepOutcome;
  replay_valid: boolean;
  mode: StepMode;
  cost: Cost;
  repair_attempt?: number;
  time_to_repair_ms?: number;
  assertion_strength?: AssertionStrength;
  error_message?: string;
  /**
   * The outcome of the **first** attempt, when `outcome` was later overwritten
   * with `REPAIR_EXHAUSTED`.
   *
   * Every genuine failure exhausts repair today, because `StubRepairModelClient`
   * always proposes `null` (`architecture.md` stub 1). So the emitted metric row
   * reads `REPAIR_EXHAUSTED` whether the locator was never found, the assertion
   * was false, or the page timed out — three findings the gate needs to tell
   * apart, flattened into one.
   *
   * `contracts/metrics.schema.json` has `additionalProperties: false` and no
   * field for this, so widening the NDJSON would be a contract change (ADR, per
   * CONTRIBUTING). This field is runner-internal and **not emitted**: it lets a
   * caller such as the gate matrix driver record the real outcome in its own
   * ledger while the contract question is settled separately.
   */
  first_pass_outcome?: StepOutcome;
  /**
   * Something worth recording about a step that did **not** fail — today only
   * "the `networkidle` hint never fired, we proceeded anyway". Deliberately not
   * `error_message`: this is not an error, and a step carrying it can be `PASS`.
   *
   * In-memory only. Adding it to `metrics.schema.json` is a contract change,
   * and nothing aggregates it yet — see docs/gate/runner.md.
   */
  notes?: string;
}

/**
 * What a caller may observe after each step settles (issue #64).
 *
 * Declared structurally so the runner keeps no dependency on `src/cache/` — the
 * cache is written *to*, and a runner -> cache import would be backwards. The
 * cache supplies an implementation via `createCacheUpdateSink()`.
 *
 * Purely an observer. Nothing the sink does or returns can change an outcome,
 * skip a step, or alter a metric row: confidence is recorded during Track 1,
 * never acted on, or a low-confidence row would quietly shrink the
 * step-validity denominator. See docs/gate/cache.md.
 */
export interface StepOutcomeObservation {
  site_key: string;
  task_key: string;
  step_index: number;
  outcome: StepOutcome;
  /** Set only when the outcome was REPAIRED_PASS. */
  repair?: {
    run_id: string;
    repair_attempt: number;
    corrected_action: CompiledAction;
  };
}

export interface RunResult {
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
  time_to_repair_total_ms: number;
  step_results: StepAttemptResult[];
  wall_clock_total_ms: number;
  cost_fresh: Cost;
  cost_replay: Cost;
  cost_repair: Cost;
}
