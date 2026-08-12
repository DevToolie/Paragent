/**
 * Decide `task_key` for a recording (issue #124, ADR-0015).
 *
 * A separate module from `cli.ts` on purpose: `src/cli.ts` (the `paragent`
 * binary router, #134) dispatches to `recorder/cli.ts` by dynamically
 * importing it, and that import *is* the invocation — `cli.ts` has no
 * direct-run guard and runs `main()` unconditionally on import, by design (see
 * its own header comment). A function that needs to be unit-tested without a
 * browser therefore cannot live in `cli.ts`; importing that module for a test
 * would launch a browser and call `process.exit`. This module has no such
 * side effect and is safe to import directly —
 * `tests/unit/recorder-select-task.test.ts` does exactly that.
 */
import { resolveTaskIntent } from "../intent/index.js";

export type TaskKeyDecision =
  | { task_key: string; note?: string }
  | { errorMessage: string };

/**
 * `--task-key` wins outright when given — a caller who already knows the slug
 * needs no resolution and gets none, and nothing here second-guesses it.
 * Otherwise `--intent "<goal>"` is resolved through `src/intent/`, the new
 * entry point that lets a caller show up with a goal instead of a slug. A
 * resolution that needs confirmation, or misses, **stops the recording**
 * rather than falling back to a default — the #124 constraint that a miss is
 * `no_data`-shaped, not a guess. With neither flag, `defaultTaskKey` applies —
 * unchanged behavior for every caller that predates this issue.
 */
export function resolveTaskKeyForRecording(
  args: Record<string, string | boolean>,
  defaultTaskKey: string,
): TaskKeyDecision {
  const explicit = args["task-key"] as string | undefined;
  if (explicit) return { task_key: explicit };

  const intent = args["intent"] as string | undefined;
  if (intent) {
    const resolution = resolveTaskIntent(intent);
    if (resolution.status === "resolved") {
      return {
        task_key: resolution.task_key,
        note:
          `intent resolved: "${intent}" -> ${resolution.task_key} ` +
          `(${resolution.method}, matched "${resolution.matched_description}")`,
      };
    }
    if (resolution.status === "needs_confirmation") {
      return {
        errorMessage:
          `intent "${intent}" is close to ${resolution.candidate_task_key} but was not ` +
          `resolved automatically (${resolution.reason}). Re-run with ` +
          `--task-key ${resolution.candidate_task_key} to confirm, or rephrase.`,
      };
    }
    return {
      errorMessage:
        `intent "${intent}" did not resolve (${resolution.reason}): ${resolution.detail}. ` +
        "Pass --task-key explicitly, or add the phrasing to src/intent/catalog.ts.",
    };
  }

  return { task_key: defaultTaskKey };
}
