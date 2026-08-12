/**
 * Resolving a whole program out of a per-step cache (ADR-0013, issue #120).
 *
 * The cache is keyed per step — `CacheKey = { site_key, task_key, step_index }`.
 * That is the right key for a row and it is not sufficient to describe the thing
 * a cache hit serves, which is **a whole ordered program plus a decision to
 * trust it**. Given a bag of rows, nothing in the pre-#120 schema could tell a
 * complete 5-step task from an 8-step task whose last three rows were never
 * written, because every individual row is valid in both cases.
 *
 * That gap is not a bad metric, it is a live browser executing the first four
 * steps of a twelve-step flow and stopping in the middle of a form. So this
 * module's central rule is:
 *
 * > **Never return a program that cannot be proven complete.**
 *
 * A resolver returns a program only when it holds `steps_total` rows with
 * contiguous `step_index` values `0..steps_total-1`, all agreeing on the same
 * `program_id`. Anything else is a MISS carrying a reason. There is no
 * "probably complete" — a task whose rows predate the schema resolves as
 * `no_program_ref`, not as a guess.
 *
 * ## Completeness fails closed. Confidence does not.
 *
 * These are two different questions and ADR-0013 gives them deliberately
 * opposite answers, which is the subtlety most likely to be "fixed" later:
 *
 * | Question | Kind | Behaviour |
 * | --- | --- | --- |
 * | Do I hold every step? | structural | **fails closed** — MISS |
 * | Are those steps still trustworthy? | empirical | **reported, never enforced** |
 *
 * Program-level invalidation composes as "any invalidated row invalidates the
 * program" — a flow is only as replayable as its worst step — and it is
 * returned as a **flag on a hit**, not as a miss. Nothing here may decide that a
 * step is not worth attempting. #64 pinned that invariant for a reason: skipping
 * low-confidence rows silently shrinks the step-validity denominator and
 * inflates the headline gate number. A read path is exactly where someone adds
 * `if (row.confidence < THRESHOLD) skip`, so the flag is informational and
 * `tests/unit/cache-resolve.test.ts` asserts an invalidated program still
 * resolves with all of its rows.
 *
 * ## What this module does not do
 *
 * It does not build a `CompiledProgram` and it does not consult a runner. The
 * cache is written *to* by the runner; a dependency in the other direction
 * would be backwards. Assembling rows into something replayable — and deriving
 * `required_params` from them — belongs to the caller, and is #118's job.
 */

import { isInvalidated } from "./confidence.js";
import type { CacheListFilter, CacheStore } from "./store.js";
import type { CacheRow } from "./types.js";

/** Which task to resolve. Deliberately not a `CacheKey` — that names a step. */
export interface ProgramKey {
  site_key: string;
  task_key: string;
}

/**
 * Which rows a resolution may draw on (ADR-0014, #118).
 *
 * `any` is same-tenant reuse: the caller hands over its own store, and every row
 * in it — pooled or tenant-scoped — belongs to the caller already.
 *
 * `pool_only` is the **cross-tenant** case, and it is the first time data flows
 * *out* of the pool rather than into it. Every control built so far points the
 * other way: `writeCacheRow()`, the taint rules, the allowlist and the canary
 * suite all govern what may **enter**. "Nothing tenant-scoped got in" is a
 * different claim from "nothing tenant-scoped comes back out to the wrong
 * tenant", and only the first had a merge-blocking test before #118.
 *
 * Under `pool_only` a tenant-scoped row is not merely deprioritized — it is
 * invisible, so a program that depends on one resolves as a MISS rather than
 * silently degrading to a different program. `tests/canary/pool-read-leak.test.ts`
 * asserts that from disk.
 */
export type ResolveScope = "any" | "pool_only";

export interface ResolveOptions {
  /** Defaults to `any` — same-tenant reuse. See `ResolveScope`. */
  scope?: ResolveScope;
}

/**
 * Why a task did not resolve.
 *
 * A reason rather than a bare `undefined` because "no hit" is a measurement in
 * its own right — #67 counts these — and because the three causes want
 * different responses: recompile, re-record, or nothing at all.
 */
export type ProgramMissReason =
  /** Nothing at all is cached for this `(site_key, task_key)`. */
  | "no_rows"
  /** Rows exist but carry no program identity — they predate ADR-0013. */
  | "no_program_ref"
  /** Rows carry identity but no program version is provably whole. */
  | "incomplete";

export interface ResolvedProgram {
  status: "hit";
  site_key: string;
  task_key: string;
  program_id: string;
  steps_total: number;
  compiled_at: string;
  /**
   * Every row of the program, `step_index` ascending and contiguous from 0.
   * Guaranteed `length === steps_total` — that is what "hit" means here.
   */
  rows: CacheRow[];
  /**
   * True when **any** row is invalidated (ADR-0009). Advisory: the program is
   * still returned whole, and callers must still attempt every step. See the
   * module note on why this is not a miss.
   */
  invalidated: boolean;
  /** Which steps are invalidated, so a caller can report rather than guess. */
  invalidated_step_indices: number[];
}

export interface UnresolvedProgram {
  status: "miss";
  site_key: string;
  task_key: string;
  reason: ProgramMissReason;
  /** What was actually missing. Written for a human reading a run log. */
  detail: string;
}

export type ProgramResolution = ResolvedProgram | UnresolvedProgram;

/** One program version's rows, before completeness has been decided. */
interface Candidate {
  program_id: string;
  steps_total: number;
  compiled_at: string;
  rows: CacheRow[];
  /** Set when the group's rows disagree about how long the program is. */
  inconsistent: boolean;
}

function miss(
  key: ProgramKey,
  reason: ProgramMissReason,
  detail: string,
): UnresolvedProgram {
  return { status: "miss", site_key: key.site_key, task_key: key.task_key, reason, detail };
}

/**
 * Group rows by the program version they claim to belong to.
 *
 * Grouping — rather than taking every row for the task — is what makes a
 * recompile safe. `CacheStore` is last-write-wins per
 * `(site_key, task_key, step_index)`, so recompiling a 12-step task down to 5
 * updates rows 0-4 and leaves rows 5-11 on disk under the *old* `program_id`.
 * Pooled together they look like a 12-row task with a mid-flow version change.
 * Grouped, the new version holds 0-4 and is complete, and the orphaned tail
 * holds 5-11 and is correctly unresolvable because it has no step 0.
 */
function groupByProgram(rows: CacheRow[]): Candidate[] {
  const groups = new Map<string, Candidate>();
  for (const row of rows) {
    const ref = row.program;
    if (!ref) continue;
    const existing = groups.get(ref.program_id);
    if (!existing) {
      groups.set(ref.program_id, {
        program_id: ref.program_id,
        steps_total: ref.steps_total,
        compiled_at: ref.compiled_at,
        rows: [row],
        inconsistent: false,
      });
      continue;
    }
    existing.rows.push(row);
    // Rows of one program version disagreeing about its length means something
    // wrote a version without changing its id. Recorded rather than resolved by
    // picking one: a resolver that guessed here would be guessing about exactly
    // the field it exists to trust.
    if (ref.steps_total !== existing.steps_total) existing.inconsistent = true;
    if (ref.compiled_at > existing.compiled_at) existing.compiled_at = ref.compiled_at;
  }
  return [...groups.values()];
}

/** Missing `step_index` values for a candidate, ascending. Empty when whole. */
function missingIndices(candidate: Candidate): number[] {
  const present = new Set(candidate.rows.map((r) => r.step_index));
  const missing: number[] = [];
  for (let i = 0; i < candidate.steps_total; i++) {
    if (!present.has(i)) missing.push(i);
  }
  return missing;
}

/**
 * Rows whose `step_index` falls outside `0..steps_total-1`.
 *
 * A row at index 7 of a program that claims five steps is not a harmless
 * extra — it means `steps_total` is wrong, and `steps_total` is the only thing
 * standing between a resolver and a truncated replay.
 */
function outOfRangeIndices(candidate: Candidate): number[] {
  return candidate.rows
    .map((r) => r.step_index)
    .filter((i) => i < 0 || i >= candidate.steps_total)
    .sort((a, b) => a - b);
}

function isComplete(candidate: Candidate): boolean {
  return (
    !candidate.inconsistent &&
    missingIndices(candidate).length === 0 &&
    outOfRangeIndices(candidate).length === 0
  );
}

/**
 * Newest first, by `compiled_at`, with `program_id` breaking exact ties.
 *
 * A tie is only reachable when two programs were compiled in the same
 * millisecond, which the test suite does deliberately. Sorting on the id rather
 * than leaving it to insertion order means the answer does not depend on the
 * order rows happened to land in the file.
 */
function newestFirst(a: Candidate, b: Candidate): number {
  if (a.compiled_at !== b.compiled_at) return a.compiled_at < b.compiled_at ? 1 : -1;
  return a.program_id < b.program_id ? 1 : -1;
}

/** Human-readable account of why one candidate is not whole. */
function describeIncomplete(candidate: Candidate): string {
  const parts: string[] = [];
  if (candidate.inconsistent) {
    parts.push("rows disagree about steps_total");
  }
  const missing = missingIndices(candidate);
  if (missing.length > 0) {
    parts.push(`missing step_index ${missing.join(", ")}`);
  }
  const extra = outOfRangeIndices(candidate);
  if (extra.length > 0) {
    parts.push(`step_index outside 0..${candidate.steps_total - 1}: ${extra.join(", ")}`);
  }
  return `${candidate.program_id} (${candidate.rows.length}/${candidate.steps_total} rows; ${parts.join("; ")})`;
}

/**
 * Resolve `(site_key, task_key)` to a whole program, or say why not.
 *
 * The store's `list()` already returns `(site_key, task_key, step_index)` order
 * (#121), so `rows` on a hit is ordered without re-sorting here. That is a store
 * guarantee this module depends on rather than re-implements — a second sort
 * would be a second place for the ordering rule to live.
 */
export function resolveProgram(
  store: CacheStore,
  key: ProgramKey,
  options: ResolveOptions = {},
): ProgramResolution {
  const scope = options.scope ?? "any";
  const filter: CacheListFilter = { site_key: key.site_key, task_key: key.task_key };
  // `pool_eligible: true` reads a different index, not a filtered view of the
  // default one. `writeCacheRowPair()` writes both copies of a row and the
  // merged view deliberately lets the tenant version win, so filtering the
  // default view at pool scope would return nothing for every task that has a
  // tenant counterpart — which is all of them. See `CacheListFilter`.
  //
  // The eligibility is read off the row, never recomputed here:
  // `writeCacheRow()` stays the only thing that classifies.
  const rows =
    scope === "pool_only" ? store.list({ ...filter, pool_eligible: true }) : store.list(filter);
  const all = scope === "pool_only" ? store.list(filter) : rows;

  if (rows.length === 0) {
    const detail =
      scope === "pool_only" && all.length > 0
        ? `no pool-eligible rows for this site_key/task_key (${all.length} tenant-scoped row(s) ` +
          "are not readable at pool scope)"
        : "nothing cached for this site_key/task_key";
    return miss(key, "no_rows", detail);
  }

  const candidates = groupByProgram(rows);
  if (candidates.length === 0) {
    // Rows exist but none names a program. These predate ADR-0013, and there is
    // no honest way to infer completeness from them: the highest step_index
    // present is a lower bound on the program's length, never the length.
    return miss(
      key,
      "no_program_ref",
      `${rows.length} row(s) carry no program identity (written before ADR-0013); ` +
        "recompile the trajectory to make this task resolvable",
    );
  }

  const complete = candidates.filter(isComplete).sort(newestFirst);
  if (complete.length === 0) {
    const detail = candidates
      .sort(newestFirst)
      .map(describeIncomplete)
      .join(" | ");
    return miss(key, "incomplete", `no complete program version: ${detail}`);
  }

  const chosen = complete[0]!;
  const ordered = [...chosen.rows].sort((a, b) => a.step_index - b.step_index);
  const invalidatedSteps = ordered.filter(isInvalidated).map((r) => r.step_index);

  return {
    status: "hit",
    site_key: key.site_key,
    task_key: key.task_key,
    program_id: chosen.program_id,
    steps_total: chosen.steps_total,
    compiled_at: chosen.compiled_at,
    rows: ordered,
    // Advisory. See the module note: this never suppresses a step.
    invalidated: invalidatedSteps.length > 0,
    invalidated_step_indices: invalidatedSteps,
  };
}
