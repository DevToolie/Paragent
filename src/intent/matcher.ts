/**
 * The exact-normalized matcher (issue #124 item 2).
 *
 * "Start with the least clever thing that works": normalize the query and
 * every catalog description with the same rule
 * (`src/intent/normalize.ts::normalizeIntentText`) and require string
 * equality. No scoring, no distance, no partial credit — so there is no
 * threshold to tune and nothing for `docs/INTEGRITY-AUDIT.md` category B to
 * flag. A query one word off from a catalog description is a MISS, the same
 * as a query about an unrelated task; this matcher cannot tell "close" from
 * "wrong" and does not pretend to.
 *
 * That is also its ceiling: `"make me a stat panel using the testdata
 * source"` will not match `"create a stat dashboard from testdata"` unless
 * both phrasings are literally in the catalog. Widening coverage means adding
 * descriptions to `src/intent/catalog.ts`, not loosening this matcher —
 * loosening it is what an embedding-based `IntentMatcher` is for, as a swapped
 * implementation behind the same interface, not a parameter on this one.
 */
import { normalizeIntentText } from "./normalize.js";
import type { IntentMatcher, IntentResolution, KnownTask } from "./types.js";

export class ExactNormalizedMatcher implements IntentMatcher {
  readonly id = "exact-normalized";

  match(query: string, catalog: readonly KnownTask[]): IntentResolution {
    const normalizedQuery = normalizeIntentText(query);
    if (normalizedQuery === "") {
      return {
        status: "miss",
        reason: "empty_query",
        detail: "the query normalized to an empty string (blank, or punctuation-only)",
      };
    }

    const hits: { task_key: string; description: string }[] = [];
    for (const task of catalog) {
      for (const description of task.descriptions) {
        if (normalizeIntentText(description) === normalizedQuery) {
          hits.push({ task_key: task.task_key, description });
        }
      }
    }

    if (hits.length === 0) {
      return {
        status: "miss",
        reason: "no_match",
        detail: `no catalog description normalizes to "${normalizedQuery}"`,
      };
    }

    const distinctTaskKeys = [...new Set(hits.map((h) => h.task_key))];
    if (distinctTaskKeys.length > 1) {
      // Two different tasks registered a description that normalizes the same
      // way. A catalog-authoring bug, not a query problem — never resolved by
      // picking one, for the same reason resolveProgram() never picks a
      // "probably complete" program (ADR-0013).
      return {
        status: "miss",
        reason: "ambiguous",
        detail:
          `"${normalizedQuery}" matches descriptions under ${distinctTaskKeys.length} ` +
          `distinct task_keys (${distinctTaskKeys.join(", ")}) — fix src/intent/catalog.ts, ` +
          "this is never resolved by a tiebreaker",
      };
    }

    const first = hits[0]!;
    return {
      status: "resolved",
      task_key: first.task_key,
      matched_description: first.description,
      method: this.id,
    };
  }
}
