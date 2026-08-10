import type { Assertion, ParamBindings } from "./types.js";

/**
 * A `{param}` hole. Exported so `src/runner/params.ts` derives required names
 * with the same grammar interpolation consumes — two regexes that drifted apart
 * would make a param required that never gets filled, or vice versa.
 */
export const PARAM_HOLE = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/**
 * Replace `{param}` holes with runtime bindings. **Unbound holes are left
 * intact**, deliberately (#122).
 *
 * `ReplayRunner.run()` now refuses a program whose required params are not all
 * bound, so a hole from the *compiled program* cannot reach here unfilled. What
 * still can is a hole in an action a **repair proposed**: the model may return
 * a `corrected_action` carrying a template the run-start check never saw, and
 * that is not knowable before step 0.
 *
 * So this stays total rather than throwing. Leaving the text intact makes the
 * step fail its assertion and be recorded as such, which is the right outcome
 * for a repair that proposed something unusable — where throwing would abort
 * the run and lose the steps already measured. Pinned by
 * `tests/unit/runner-params.test.ts`.
 */
export function interpolate(template: string, params: ParamBindings): string {
  return template.replace(PARAM_HOLE, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, key)) return match;
    return String(params[key]);
  });
}

/** Deep-freeze for assertion immutability during repair. */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** Structural equality for assertions (repair must leave them unchanged). */
export function assertionsEqual(a: Assertion, b: Assertion): boolean {
  return stableStringify(a) === stableStringify(b);
}
