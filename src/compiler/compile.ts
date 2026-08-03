import {
  synthesizeAssertion,
  type SynthesizeAssertionOptions,
} from "./assertions.js";
import { buildLocatorFallbackChain } from "./locators.js";
import { decidePoolEligibility } from "./pool.js";
import {
  COMPILER_VERSION,
  SCHEMA_VERSION,
  type CacheRow,
  type CompiledAction,
  type CompiledTrajectoryBundle,
  type Trajectory,
  type TrajectoryStep,
} from "./types.js";

function slugPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9@._-]+/g, "-").replace(/-+/g, "-");
}

function buildCompiledAction(step: TrajectoryStep): {
  action: CompiledAction;
  topologyOnly: boolean;
} {
  const { chain, topologyOnly } = buildLocatorFallbackChain(
    step.locator_candidates,
  );
  const action: CompiledAction = {
    type: step.action.type,
    locator_fallback_chain: chain,
  };
  if (step.action.param_refs !== undefined) {
    action.param_refs = step.action.param_refs;
  }
  if (step.action.url_template !== undefined) {
    action.url_template = step.action.url_template;
  }
  if (step.action.key !== undefined) {
    action.key = step.action.key;
  }
  if (step.action.custom_op !== undefined) {
    action.custom_op = step.action.custom_op;
  }
  if (step.action.wait_ms !== undefined) {
    action.wait_ms = step.action.wait_ms;
  }
  return { action, topologyOnly };
}

function landmarkHint(step: TrajectoryStep): string | undefined {
  const post = step.post_state.visible_landmarks ?? [];
  return post[0];
}

export function compileStep(
  trajectory: Trajectory,
  step: TrajectoryStep,
  compiledAt: string,
  assertionOptions: SynthesizeAssertionOptions = {},
): CacheRow {
  const { action, topologyOnly } = buildCompiledAction(step);
  const assertion = synthesizeAssertion(
    {
      trajectory,
      step,
      locatorChain: action.locator_fallback_chain,
    },
    assertionOptions,
  );
  const pool = decidePoolEligibility({
    chain: action.locator_fallback_chain,
    assertion,
    topologyOnly,
  });

  const steps = trajectory.steps;
  const idx = step.step_index;
  const prev = steps.find((s) => s.step_index === idx - 1);
  const next = steps.find((s) => s.step_index === idx + 1);

  const flow_topology: NonNullable<CacheRow["flow_topology"]> = {};
  if (prev) flow_topology.prev_action_type = prev.action.type;
  if (next) flow_topology.next_action_type = next.action.type;
  const landmark = landmarkHint(step);
  if (landmark) flow_topology.landmark = landmark;

  const row: CacheRow = {
    schema_version: SCHEMA_VERSION,
    row_id: `cache-${slugPart(trajectory.site_key)}-${slugPart(trajectory.task_key)}-${idx}`,
    site_key: trajectory.site_key,
    task_key: trajectory.task_key,
    step_index: idx,
    compiled_action: action,
    assertion,
    confidence: 0,
    success_count: 0,
    failure_count: 0,
    last_verified_at: compiledAt,
    pool_eligible: pool.pool_eligible,
    pool_ineligible_reason: pool.pool_ineligible_reason,
  };

  if (Object.keys(flow_topology).length > 0) {
    row.flow_topology = flow_topology;
  }

  return row;
}

export interface CompileOptions {
  compiledAt?: string;
  inputPath?: string;
  notes?: string;
  /**
   * Override the `timeout_ms` written onto every synthesized assertion.
   * Defaults to `DEFAULT_ASSERTION_TIMEOUT_MS`. Read the note on that constant
   * before changing it — it is an assertion-strength knob, not a perf one.
   */
  assertionTimeoutMs?: number;
}

export function compileTrajectory(
  trajectory: Trajectory,
  options: CompileOptions = {},
): CompiledTrajectoryBundle {
  if (trajectory.schema_version !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported trajectory schema_version=${trajectory.schema_version}; expected ${SCHEMA_VERSION}`,
    );
  }
  if (!trajectory.steps?.length) {
    throw new Error("Trajectory has no steps to compile");
  }

  const compiledAt = options.compiledAt ?? new Date().toISOString();
  const assertionOptions: SynthesizeAssertionOptions =
    options.assertionTimeoutMs === undefined
      ? {}
      : { timeoutMs: options.assertionTimeoutMs };
  const rows = [...trajectory.steps]
    .sort((a, b) => a.step_index - b.step_index)
    .map((step) => compileStep(trajectory, step, compiledAt, assertionOptions));

  const bundle: CompiledTrajectoryBundle = {
    schema_version: SCHEMA_VERSION,
    bundle_kind: "compiled_trajectory",
    source_trajectory_id: trajectory.trajectory_id,
    site_key: trajectory.site_key,
    task_key: trajectory.task_key,
    compiled_at: compiledAt,
    compiler: {
      version: COMPILER_VERSION,
      notes:
        options.notes ??
        "One CacheRow per step; locator_fallback_chain in B2 preference order; assertions synthesized from post_state (+ hints). pool_eligible fail-closed.",
    },
    rows,
  };
  if (options.inputPath !== undefined) {
    bundle.compiler.input_path = options.inputPath;
  }
  return bundle;
}
