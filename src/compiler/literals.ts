/**
 * Heuristics for rejecting tenant-looking literals from compiled output.
 * Authoritative allowlist enforcement is B5; compiler fail-closes on suspicion.
 */

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const OPAQUE_ID_RE = /\b[0-9a-f]{16,}\b/i;
const SECRETISH_RE =
  /\b(eyJ[A-Za-z0-9_-]{10,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,}|sk-[A-Za-z0-9]{8,})\b/i;

/**
 * Product / chrome strings that are not tenant data when used as locator names.
 * CONFIDENCE: MED — provisional until B5 vocabulary lands.
 */
const CHROME_ALLOWLIST = new Set(
  [
    "username",
    "password",
    "email",
    "sign in",
    "log in",
    "login",
    "submit",
    "save",
    "cancel",
    "next",
    "back",
    "search",
    "dashboards",
    "home",
    "settings",
    "grafana",
  ].map((s) => s.toLowerCase()),
);

export function hasTemplateHoles(value: string): boolean {
  return /\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(value);
}

export function isChromeLabel(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (CHROME_ALLOWLIST.has(trimmed)) return true;
  if (/^[a-z][a-z0-9-]{0,40}$/i.test(trimmed) && !OPAQUE_ID_RE.test(trimmed)) {
    return true;
  }
  return false;
}

export function looksLikeTenantLiteral(value: string): boolean {
  if (!value || value.trim() === "") return false;
  if (hasTemplateHoles(value)) {
    const withoutHoles = value.replace(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, "");
    return (
      EMAIL_RE.test(withoutHoles) ||
      UUID_RE.test(withoutHoles) ||
      SECRETISH_RE.test(withoutHoles)
    );
  }
  if (EMAIL_RE.test(value)) return true;
  if (UUID_RE.test(value)) return true;
  if (SECRETISH_RE.test(value)) return true;
  if (OPAQUE_ID_RE.test(value) && value.length >= 16) return true;
  if (isChromeLabel(value)) return false;
  if (/\s/.test(value.trim()) && value.trim().split(/\s+/).length >= 3) {
    return true;
  }
  return false;
}

/**
 * Tenant check for **selector-shaped** values — `structural_path`, `css`.
 *
 * `looksLikeTenantLiteral` ends with a prose heuristic: three or more
 * whitespace-separated words is treated as human text, and human text near a
 * locator is assumed to be tenant data. That is right for a name or a label and
 * catastrophically wrong for a CSS path, where the whitespace is the descendant
 * combinator. `body > button` is three tokens. Real Grafana paths are thirty.
 *
 * Measured consequence, issue #25: compiling the live 12-step trajectory marked
 * **every** structural candidate tainted, so every chain came out `allTainted`,
 * gained a `topology_only` entry, and reported `pool_ineligible_reason:
 * topology_only_degraded` — 11 of 12 rows, for a reason that was an artifact of
 * the heuristic rather than anything in the page. The example trajectory never
 * showed it because its hand-written paths are short.
 *
 * Identifier-shaped tenant data inside a selector still counts: a uid in
 * `div[data-uid="…"]`, an email in an attribute selector, a bearer-looking
 * blob. Only the prose rule is dropped, because a selector is not prose.
 */
export function looksLikeTenantSelector(value: string): boolean {
  if (!value || value.trim() === "") return false;
  const probe = hasTemplateHoles(value)
    ? value.replace(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, "")
    : value;
  return (
    EMAIL_RE.test(probe) ||
    UUID_RE.test(probe) ||
    SECRETISH_RE.test(probe) ||
    OPAQUE_ID_RE.test(probe)
  );
}

/** Object keys whose values are selectors, not prose. */
export const SELECTOR_KEYS = new Set(["structural_path", "css", "count_scope"]);

/**
 * String leaves with the key they were found under, so a caller can apply the
 * prose rule to prose and the selector rule to selectors. `collectStringLeaves`
 * throws the key away, which is why `assertion.target.locator.structural_path`
 * used to be judged as if it were a sentence.
 */
export function collectStringEntries(
  value: unknown,
  key = "",
  out: { key: string; value: string }[] = [],
): { key: string; value: string }[] {
  if (typeof value === "string") {
    out.push({ key, value });
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringEntries(item, key, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      collectStringEntries(v, k, out);
    }
  }
  return out;
}

export function collectStringLeaves(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringLeaves(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectStringLeaves(v, out);
    }
  }
  return out;
}
