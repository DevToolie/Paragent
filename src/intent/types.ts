/**
 * Types for intent -> task_key resolution (issue #124, ADR-0015).
 *
 * An agent arrives with a goal in natural language, not a slug. Everything
 * downstream of the recorder — the compiler, the cache, the metrics — is keyed
 * by `task_key`, a string a human chose. This package is the layer in front of
 * that: given a phrase, decide which `task_key` (if any) it names.
 *
 * `docs/decisions/ADR-0015-task-identity-and-intent-resolution.md` is the
 * record of *what a task's identity is* — this file is only the shapes that
 * decision produces.
 */

/**
 * One task the system knows how to run, and the ways a person might describe
 * its goal.
 *
 * `descriptions` are goal statements, not step lists — "create a stat
 * dashboard from testdata", never "click the Add visualization button". They
 * must never carry a parameter value, a customer name, or portal content
 * (CONTRIBUTING rule 1); every entry in `src/intent/catalog.ts` is a genuine
 * product-generic paraphrase of an ADR-0006-class task, and `npm run
 * secret-scan` runs over this file like any other.
 */
export interface KnownTask {
  /** The task_key this description set resolves to. Opaque to this package. */
  task_key: string;
  /**
   * Natural-language phrasings of the task's goal. At least one. Order does
   * not matter — every entry is checked, and a match on any of them resolves
   * the same way.
   */
  descriptions: readonly string[];
}

/** Why a query did not resolve. A reason, not a bare miss — #67-style: a miss is a measurement in its own right. */
export type IntentMissReason =
  /** The query normalized to nothing checkable (empty, or punctuation-only). */
  | "empty_query"
  /** No catalog entry's normalized description equals the normalized query. */
  | "no_match"
  /**
   * The query matches descriptions registered under more than one distinct
   * task_key. A catalog authoring error, never resolved by picking one —
   * see `src/intent/catalog.ts` and `ExactNormalizedMatcher`.
   */
  | "ambiguous";

export interface ResolvedIntent {
  status: "resolved";
  task_key: string;
  /** The catalog description that matched, verbatim (not normalized). */
  matched_description: string;
  /** Which matcher produced this — `IntentMatcher.id`. */
  method: string;
}

/**
 * A candidate exists, but the matcher is not confident enough to resolve
 * automatically (issue #124 item 3: "make a wrong match impossible to execute
 * silently"). `ExactNormalizedMatcher` never returns this — an exact match on
 * normalized text has no partial-credit notion to hedge on — but the type
 * exists so a future scored matcher (embedding similarity) has somewhere to
 * put a near-miss instead of guessing. A caller must treat this exactly like a
 * miss for the purpose of resolving a program: it is not resolved, and running
 * `candidate_task_key` requires an explicit confirmation from the caller (e.g.
 * re-issuing the request with `--task-key` set), never an automatic retry.
 */
export interface IntentNeedsConfirmation {
  status: "needs_confirmation";
  candidate_task_key: string;
  matched_description: string;
  method: string;
  /** Why this stopped short of an automatic resolution. */
  reason: string;
}

export interface UnresolvedIntent {
  status: "miss";
  reason: IntentMissReason;
  /** Human-readable account, written for a run log. */
  detail: string;
}

export type IntentResolution = ResolvedIntent | IntentNeedsConfirmation | UnresolvedIntent;

/**
 * Swappable matching strategy (issue #124 item 2). `ExactNormalizedMatcher` is
 * the only implementation today — normalized exact match against
 * `src/intent/catalog.ts`. Embedding similarity is the obvious upgrade and
 * must implement this same interface rather than replace the call site, so
 * swapping the matcher never touches a caller.
 *
 * A matcher owns the entire resolve/confirm/miss decision for its strategy;
 * it is not handed a threshold by the caller, because a threshold with no
 * measurement behind it is exactly the category-B failure
 * `docs/INTEGRITY-AUDIT.md` exists to prevent (see ADR-0015). If a future
 * matcher needs one, it names and labels it as a chosen default itself, the
 * way `CONFIDENCE_ALPHA` does in `src/cache/confidence.ts` (ADR-0009).
 */
export interface IntentMatcher {
  /** Stable identifier, recorded on a resolution as `method`. */
  readonly id: string;
  match(query: string, catalog: readonly KnownTask[]): IntentResolution;
}
