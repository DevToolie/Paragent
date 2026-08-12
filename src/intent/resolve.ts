/**
 * Entry point: intent -> task_key (issue #124).
 *
 * `resolveTaskIntent()` is what a caller wires in front of an explicit
 * `--task-key` — see `src/recorder/cli.ts`. It composes a matcher (default:
 * `ExactNormalizedMatcher`) with a catalog (default:
 * `src/intent/catalog.ts::KNOWN_TASKS`), both overridable so a test — or a
 * future embedding matcher — never has to touch the default table.
 *
 * This function decides *which task_key*, nothing else. It does not call
 * `resolveProgram()`, does not touch the cache, and does not write a row —
 * `writeCacheRow()` stays the only thing that decides what a row is (#124
 * constraints). A resolved `task_key` is exactly as trustworthy as any
 * hand-typed one: it still has to survive `resolveProgram()`'s completeness
 * check and the replayed assertions, same as if a human had typed the slug.
 */
import { KNOWN_TASKS } from "./catalog.js";
import { ExactNormalizedMatcher } from "./matcher.js";
import type { IntentMatcher, IntentResolution, KnownTask } from "./types.js";

export interface ResolveTaskIntentOptions {
  /** Defaults to `ExactNormalizedMatcher`. */
  matcher?: IntentMatcher;
  /** Defaults to `KNOWN_TASKS`. */
  catalog?: readonly KnownTask[];
}

const DEFAULT_MATCHER = new ExactNormalizedMatcher();

export function resolveTaskIntent(
  query: string,
  options: ResolveTaskIntentOptions = {},
): IntentResolution {
  const matcher = options.matcher ?? DEFAULT_MATCHER;
  const catalog = options.catalog ?? KNOWN_TASKS;
  return matcher.match(query, catalog);
}
