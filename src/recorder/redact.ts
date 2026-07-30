import { createHash } from "node:crypto";
import type { ParamType } from "./types.js";

const SECRETISH = /pass(word)?|secret|token|cookie|api[_-]?key|credential/i;

export function inferParamType(name: string, sample?: unknown): ParamType {
  if (SECRETISH.test(name)) return "secret_ref";
  if (typeof sample === "boolean") return "boolean";
  if (typeof sample === "number") {
    return Number.isInteger(sample) ? "integer" : "number";
  }
  if (typeof sample === "string") {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sample)) return "email";
    if (/^https?:\/\//i.test(sample)) return "url";
    if (/^\d+$/.test(sample)) return "integer";
  }
  return "string";
}

export function templatizeUrl(
  url: string,
  bindings: Record<string, string | number | boolean>,
): { template: string; paramRefs: string[] } {
  const refs = new Set<string>();
  let template = url;
  const host = bindings.host != null ? String(bindings.host) : undefined;
  const port = bindings.port != null ? String(bindings.port) : undefined;
  if (host && template.includes(host)) {
    template = template.split(host).join("{host}");
    refs.add("host");
  }
  if (port && template.includes(`:${port}`)) {
    template = template.split(`:${port}`).join(":{port}");
    refs.add("port");
  } else if (port && template.includes(port)) {
    template = template.split(port).join("{port}");
    refs.add("port");
  }
  const fixtureRoot =
    bindings.fixture_root != null ? String(bindings.fixture_root) : undefined;
  if (fixtureRoot && template.includes(fixtureRoot)) {
    template = template.split(fixtureRoot).join("{fixture_root}");
    refs.add("fixture_root");
  }
  return { template, paramRefs: [...refs] };
}

/** Bindings `templatizeUrl` already handles positionally; do not double-replace. */
const URL_SPECIAL_BINDINGS = new Set(["host", "port", "fixture_root"]);

/**
 * Replace every bound value in `text` with its `{param}` hole.
 *
 * `templatizeUrl` only knows about host/port/fixture_root, which was enough
 * while the only live step was a navigation. It is not enough for a task that
 * types values into a page: Grafana echoes them straight back into the document
 * title and the URL — `"Paragent Gate Dashboard - Dashboards - Grafana"`,
 * `/d/{uid}/paragent-gate-dashboard` — so a typed value ends up a literal in
 * the artifact, which is exactly what the parameter discipline forbids
 * (issue #24).
 *
 * Only string bindings of 4+ characters are substituted. Short values would
 * match half the page (`"3"` as a series count would rewrite every digit), and
 * numeric ids are handled by the caller binding them explicitly.
 * Longest-first so overlapping values cannot leave a half-substituted string.
 */
export function templatizeText(
  text: string,
  bindings: Record<string, string | number | boolean>,
): string {
  const candidates = Object.entries(bindings)
    .filter(([name]) => !URL_SPECIAL_BINDINGS.has(name))
    .map(([name, value]) => [name, String(value)] as const)
    .filter(([, value]) => value.length >= 4)
    .sort((a, b) => b[1].length - a[1].length);

  let out = text;
  for (const [name, value] of candidates) {
    if (out.includes(value)) out = out.split(value).join(`{${name}}`);
  }
  return out;
}

export function resolveTemplate(
  template: string,
  bindings: Record<string, string | number | boolean>,
): string {
  return template.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, name: string) => {
    if (!(name in bindings)) return match;
    return String(bindings[name]);
  });
}

export function digestSignals(signals: unknown): string {
  const payload = JSON.stringify(signals ?? null);
  if (payload === undefined) {
    throw new Error("digestSignals: failed to serialize signals");
  }
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function assertNoLiteralSecrets(jsonText: string): void {
  const patterns = [
    // typed value fields — not param type maps like "password": "secret_ref"
    /"password"\s*:\s*"(?!secret_ref|string|email|url|integer|number|boolean|enum|json)[^"]+"/i,
    /"value"\s*:\s*"[^"]+"/,
    /Set-Cookie/i,
    /"cookies?"\s*:/i,
    /"localStorage"\s*:/i,
    /"sessionStorage"\s*:/i,
  ];
  for (const re of patterns) {
    if (re.test(jsonText)) {
      throw new Error(`Trajectory redaction failed: matched ${re}`);
    }
  }
}
