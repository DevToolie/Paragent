/**
 * Compiled bundle → cache, through the write-time authority (issue #166).
 *
 * ## The break this closes
 *
 * `writeCacheRow()` is the authoritative privacy boundary — invariant 2 in
 * `docs/architecture.md` — and until this module it had **no caller outside
 * `tests/`**. The only runtime code that touched the cache at all was
 * `experiments/gate-v1/run-matrix.ts`, and it only *read*: `--from-cache`
 * resolved a program out of a `JsonlCacheStore` in a directory that no shipped
 * code path ever populated. `cacheHitRate()` is a reported §9 section whose
 * denominator could only be non-empty if a human hand-wrote JSONL first.
 *
 * Two consequences, and the second is the quieter one:
 *
 *  1. A §9 metric could not produce a number for a reason that had nothing to
 *     do with the experiment — nothing could fill the cache.
 *  2. The `pool_eligible` flag that reached disk was decided by
 *     `src/compiler/pool.ts::decidePoolEligibility`, the compiler's own
 *     **pre-check**, while the canary suite defended a function nothing called.
 *     Both fail closed, so this was never a live leak; it was an authority and
 *     a lookalike, with the lookalike doing the work.
 *
 * ## Why the compiler CLI owns the write
 *
 * `paragent compile --to-cache <dir>`, rather than a `gate:matrix` that
 * populates on first run or a separate `paragent cache write`:
 *
 * - **The compiler is the only stage holding `steps_total`.** `resolveProgram`
 *   refuses to return anything it cannot prove complete (ADR-0013), and the
 *   `ProgramRef` carrying that proof is written by the compiler. Whoever writes
 *   rows has to already hold the whole bundle; the compiler does, by
 *   construction.
 * - **A measurement harness should not also be a data producer.** If
 *   `gate:matrix` populated on first run, the populating run would differ from
 *   every run after it — the first would be a file replay and the rest cache
 *   hits, inside one reported sample. That is precisely the "comparing two
 *   different things" hazard #39 warns about for the fresh/repair ratio.
 * - **A separate `cache write` command would need a third reader of the bundle
 *   shape.** The compiler already parses, validates and emits it.
 *
 * This module lives in `src/cache/` and takes a structurally-typed bundle, so
 * the dependency runs one way — the compiler's CLI calls the cache, the cache
 * knows nothing about the compiler. `src/cache/` stays library-only; it gains a
 * caller, not a CLI.
 *
 * ## What it does not do
 *
 * It does not renegotiate what `writeCacheRow` permits. Every row goes through
 * the authority with its fail-closed checks intact, and a bundle that claims
 * pool eligibility the authority refuses raises `CacheWriteRejectedError` —
 * unchanged behaviour, now reachable from a shipped path instead of only from a
 * test.
 */

import { writeCacheRowPair, CacheWriteRejectedError, type WriteLogSink } from "./write.js";
import type { CacheStore } from "./store.js";
import type { CacheRow, CacheRowCandidate } from "./types.js";

/**
 * The bundle shape this module needs, declared structurally.
 *
 * Deliberately not an import of `CompiledTrajectoryBundle`: `CacheRow` is
 * declared twice in this repo — once here and once in `src/compiler/types.ts` —
 * specifically so the compiler does not depend on the cache package. Importing
 * the compiler's types here would close that loop from the other side.
 */
export interface IngestableBundle {
  site_key: string;
  task_key: string;
  rows: readonly CacheRowCandidate[];
}

export interface IngestOptions {
  store: CacheStore;
  log?: WriteLogSink;
}

export interface IngestSummary {
  site_key: string;
  task_key: string;
  /** From the rows' `ProgramRef`, when they carry one. */
  program_id?: string;
  steps: number;
  /** Pool rows the authority judged shareable. */
  pool_eligible: number;
  /** Steps the authority kept tenant-scoped, with its reason. */
  tenant_only: { step_index: number; reason: string }[];
  /**
   * Steps where the compiler's pre-check said "not poolable" and the authority
   * said otherwise.
   *
   * This direction is legal — a pre-check may be stricter than the authority,
   * never looser — but it is not nothing: it means the flag on disk before this
   * module existed was more conservative than the boundary requires. Reported
   * rather than smoothed over, because two fail-closed implementations of one
   * rule drifting apart is exactly how the pre-check stops being a pre-check.
   */
  widened: number[];
}

/** Steps that carry no `program` ref cannot be resolved back. Refuse early. */
function assertResolvable(bundle: IngestableBundle): string | undefined {
  const missing = bundle.rows
    .filter((r) => !r.program)
    .map((r) => r.step_index);
  if (missing.length > 0) {
    throw new Error(
      `bundle rows ${missing.join(", ")} carry no program ref (ADR-0013), so ` +
        "resolveProgram() would report them as no_program_ref forever. " +
        "Recompile the trajectory with a current compiler before caching it.",
    );
  }
  const ids = new Set(bundle.rows.map((r) => r.program?.program_id));
  if (ids.size > 1) {
    throw new Error(
      `bundle mixes program ids (${[...ids].join(", ")}); refusing to write a ` +
        "cache whose rows disagree about which program they belong to.",
    );
  }
  return bundle.rows[0]?.program?.program_id;
}

/**
 * Write every row of a compiled bundle through `writeCacheRowPair`.
 *
 * All-or-nothing: the authority runs over the whole bundle **before** anything
 * is persisted, so a rejection on step 7 cannot leave steps 0-6 on disk. A
 * partial write would not be a correctness hazard — `resolveProgram` fails
 * closed on a prefix and reports `incomplete` — but "the cache holds a program
 * or it does not" is a cheaper thing to reason about than a truncation that
 * resolves as a miss for a reason unrelated to what the caller did wrong.
 *
 * The cost is that the authority runs twice per row. That is deliberate and it
 * is the point: the second pass is the one that persists, and it is the same
 * call, so nothing can decide `pool_eligible` on the way to disk except
 * `writeCacheRow`.
 *
 * @throws CacheWriteRejectedError when a row claims pool eligibility the
 * authority refuses, or when a tenant row would reach the pool file.
 */
export function ingestBundle(
  bundle: IngestableBundle,
  options: IngestOptions,
): IngestSummary {
  const programId = assertResolvable(bundle);

  // Pass 1 — decide, persist nothing. `writeCacheRowPair` with no `store` runs
  // every fail-closed check and returns the rows it would have written.
  const decided: { candidate: CacheRowCandidate; pool: CacheRow; tenant: CacheRow }[] = [];
  for (const candidate of bundle.rows) {
    try {
      const { pool, tenant } = writeCacheRowPair(candidate);
      decided.push({ candidate, pool, tenant });
    } catch (err) {
      if (err instanceof CacheWriteRejectedError) {
        throw new CacheWriteRejectedError(
          `step ${candidate.step_index}: ${err.message}`,
          err.reason,
        );
      }
      throw err;
    }
  }

  // Pass 2 — same call, now persisting. Nothing reached disk until every row
  // was known to be acceptable.
  const widened: number[] = [];
  const tenantOnly: { step_index: number; reason: string }[] = [];
  let poolEligible = 0;
  for (const { candidate, pool } of decided) {
    writeCacheRowPair(candidate, { store: options.store, ...(options.log ? { log: options.log } : {}) });
    if (pool.pool_eligible) {
      poolEligible++;
      // The compiler's claim travelled on the candidate; the authority ignored
      // it and decided for itself. Where the two differ in this direction, say so.
      if (candidate.pool_eligible === false) widened.push(candidate.step_index);
    } else {
      tenantOnly.push({
        step_index: candidate.step_index,
        reason: pool.pool_ineligible_reason ?? "other",
      });
    }
  }

  return {
    site_key: bundle.site_key,
    task_key: bundle.task_key,
    ...(programId ? { program_id: programId } : {}),
    steps: bundle.rows.length,
    pool_eligible: poolEligible,
    tenant_only: tenantOnly,
    widened,
  };
}
