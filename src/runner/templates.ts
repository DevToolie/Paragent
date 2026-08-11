import type { Assertion, ParamBindings } from "./types.js";

const HOLE = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/**
 * Replace `{param}` holes with runtime bindings. Unbound holes are left intact.
 *
 * Leaving them intact is now an **unreachable** branch on the replay path rather
 * than a tolerated one (#122): `ReplayRunner.run()` refuses a program whose
 * requirements are unbound before step 0, so a hole arriving here without a
 * binding is an internal invariant violation, not a user error. It is still not
 * an exception, because `interpolate` is a string function with callers that
 * legitimately hold partial bindings — `deriveRequiredParams` reads the same
 * templates without any bindings at all. Pinned by
 * `tests/unit/runner-params.test.ts`, which asserts both that the behaviour is
 * unchanged and that `run()` no longer lets a program reach it.
 */
export function interpolate(template: string, params: ParamBindings): string {
  return template.replace(HOLE, (match, key: string) => {
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
