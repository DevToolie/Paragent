/**
 * `compiled_trajectory` bundle → `CompiledProgram`.
 *
 * This adapter used to live inside `tests/integration/pipeline.test.ts`, whose
 * comment said it was local "on purpose: the runtime never needs it today".
 * Issue #62 is the day that stopped being true — the live matrix driver replays
 * a committed bundle from `artifacts/compiled/`, so something in `src/` has to
 * turn one into the shape `ReplayRunner` accepts. Keeping a second copy in the
 * experiment directory would mean the tested adapter and the one the gate
 * actually runs could drift.
 *
 * **This is a mapping, not a schema change.** No field is invented on either
 * contract: `CacheRow` already carries `step_index`, `row_id`, `compiled_action`
 * and `assertion`, which is exactly `CompiledStep`. The bundle's own fields
 * (`confidence`, `pool_eligible`, `last_verified_at`, …) are cache bookkeeping
 * the runner has no use for and are deliberately dropped rather than smuggled
 * through.
 *
 * The one value that is **synthesized** is `program_id`, because no contract
 * defines one. `prog-<source_trajectory_id>` is a naming convention, not a
 * contract, and it is the same convention the integration test has used since
 * #52. `docs/gate/runner.md` tracks whether bundle `$id` should become a
 * first-class contract; until that is answered, this stays a convention with a
 * name that says where it came from.
 */

import type { CompiledTrajectoryBundle } from "../compiler/types.js";
import type {
  Assertion,
  CompiledAction,
  CompiledProgram,
  CompiledStep,
} from "./types.js";

/** Prefix for the synthesized `program_id`. See the module note. */
export const PROGRAM_ID_PREFIX = "prog-";

/**
 * Adapt a compiled bundle for replay at `testbedVersion`.
 *
 * `testbed_version` is the caller's, not the bundle's: the bundle records the
 * version it was *compiled from*, while a matrix run replays that same program
 * against every pinned version in turn. Overriding it here is what makes one
 * bundle measurable across the matrix — and why `site_key` and `task_key` are
 * **not** overridden. Relabelling those per version would make a row claim a
 * run that never happened.
 *
 * Steps are sorted by `step_index` rather than trusted in array order; the
 * bundle is JSON that may have been through other tools.
 */
export function bundleToProgram(
  bundle: CompiledTrajectoryBundle,
  testbedVersion: string,
): CompiledProgram {
  const steps: CompiledStep[] = [...bundle.rows]
    .sort((a, b) => a.step_index - b.step_index)
    .map((row) => ({
      step_index: row.step_index,
      row_id: row.row_id,
      compiled_action: row.compiled_action as CompiledAction,
      assertion: row.assertion as Assertion,
    }));

  return {
    schema_version: "1.0.0",
    program_id: `${PROGRAM_ID_PREFIX}${bundle.source_trajectory_id}`,
    site_key: bundle.site_key,
    task_key: bundle.task_key,
    testbed_version: testbedVersion,
    steps,
  };
}

/**
 * True when a parsed JSON document is a compiled bundle rather than an
 * already-shaped `CompiledProgram`.
 *
 * Both files live under version control and either may be handed to
 * `--program`, so the driver has to tell them apart. `bundle_kind` is the
 * discriminator the compiler writes; falling back to "has rows, has no steps"
 * would accept a malformed file, so it does not.
 */
export function isCompiledBundle(doc: unknown): doc is CompiledTrajectoryBundle {
  if (doc === null || typeof doc !== "object") return false;
  const kind = (doc as { bundle_kind?: unknown }).bundle_kind;
  return kind === "compiled_trajectory" && Array.isArray((doc as { rows?: unknown }).rows);
}
