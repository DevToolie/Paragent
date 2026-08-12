/**
 * Intent package — resolve a natural-language goal to a task_key (#124).
 * @see docs/decisions/ADR-0015-task-identity-and-intent-resolution.md
 */
export const PACKAGE = "intent" as const;

export * from "./types.js";
export { normalizeIntentText } from "./normalize.js";
export { KNOWN_TASKS } from "./catalog.js";
export { ExactNormalizedMatcher } from "./matcher.js";
export { resolveTaskIntent, type ResolveTaskIntentOptions } from "./resolve.js";
