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
