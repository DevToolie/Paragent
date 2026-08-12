/**
 * The one carrier of the `program_id` naming convention (ADR-0013, issue #120).
 *
 * `src/runner/program.ts` has synthesized `prog-<source_trajectory_id>` since
 * #52, with a comment saying it is "a naming convention, not a contract". #120
 * makes the compiler write that same identity onto every cache row, which turns
 * one convention held in one file into a value two packages have to agree on:
 * a program resolved from the cache and the same program adapted from its
 * bundle must carry the **same** `program_id`, or the two paths describe
 * different things and nothing downstream can join them.
 *
 * Two copies of a string that must match is the #74 failure mode — the same one
 * `VISIBILITY_PREDICATE_JS` was extracted to close. So this lives in `shared/`,
 * which both the compiler and the runner may import without either depending on
 * the other, and `tests/unit/program-id.test.ts` asserts a single carrier.
 *
 * This is deliberately **not** promoted to a contract. `program_id` names a
 * program; the thing a resolver actually trusts is `steps_total` plus the rows
 * it can prove it holds (ADR-0013), and no consumer parses this string. Making
 * the format load-bearing would invite exactly that.
 */

/** Prefix distinguishing a program id from the trajectory id it derives from. */
export const PROGRAM_ID_PREFIX = "prog-";

/**
 * The program id for a trajectory.
 *
 * A compiled bundle's `source_trajectory_id` *is* the trajectory's
 * `trajectory_id`, so the compiler and `bundleToProgram` reach the same value
 * from opposite ends of the pipeline. That equality is the point of this
 * function existing rather than two template literals.
 */
export function programIdFor(trajectoryId: string): string {
  return `${PROGRAM_ID_PREFIX}${trajectoryId}`;
}

/**
 * The program a cache row belongs to (ADR-0013, issue #120).
 *
 * Lives here, next to the id convention, because `CacheRow` is declared **twice**
 * — once in `src/cache/types.ts` and once in `src/compiler/types.ts`, which
 * keeps the compiler independent of the cache package. That duplication predates
 * #120 and is not this change's to undo, but adding a *third* copy of a new
 * shape to it would be the #74 failure mode with extra steps. Both files import
 * this one instead.
 *
 * Denormalized onto every row rather than stored as a second record type: the
 * store is a flat append-only JSONL of one shape, and a resolver has to reach
 * the answer from `list()` alone.
 *
 * `steps_total` is the field that makes a **complete** task distinguishable from
 * a truncated one — without it a resolver holding rows 0-3 of an 8-step flow
 * cannot tell it is holding a prefix, and every individual row is valid either
 * way. There is deliberately no `required_params` here; ADR-0013 derives it from
 * the rows so a stale declaration cannot disagree with the steps it describes.
 */
export interface ProgramRef {
  /** `prog-<trajectory_id>` — see `programIdFor`. */
  program_id: string;
  /** How many steps the complete program has. Rows are 0..steps_total-1. */
  steps_total: number;
  /** When the compiler produced this program. Breaks ties between versions. */
  compiled_at: string;
}
