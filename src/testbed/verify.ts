/**
 * Seed verification — read the seeded state back over the Grafana HTTP API and
 * reduce it to a fingerprint that is stable across matrix versions.
 *
 * Why this exists: the gate measures whether a compiled trajectory survives a
 * version bump. That is only meaningful if the *only* thing that differed
 * between two runs is the Grafana version. A seed that quietly produces three
 * panels on one version and two on another turns a seeding artifact into what
 * looks like churn.
 *
 * Determinism rules for anything added here:
 *   - no timestamps, no Grafana-assigned numeric ids, no map iteration order
 *   - arrays are sorted by a stable key before they enter the fingerprint
 *   - a field that cannot be made stable across versions is EXCLUDED from the
 *     fingerprint and reported in `context` instead, with the reason recorded
 *     in docs/gate/testbed.md
 */

import {
  SEED_DASHBOARD_UID,
  SEED_DATASOURCE_NAME,
  SEED_DATASOURCE_UID,
  SEED_OPERATOR_LOGIN,
} from "./constants.js";
import { api } from "./seed.js";

export interface FingerprintPanel {
  title: string;
  type: string;
}

/** The stable part. Two versions seeded identically must produce equal objects. */
export interface SeedFingerprint {
  dashboard: {
    panel_count: number;
    panels: FingerprintPanel[];
    title: string;
    uid: string;
  };
  datasource: {
    name: string;
    queryable: boolean;
    uid: string;
  };
  users: {
    operator_present: boolean;
    operator_role: string | null;
  };
}

/**
 * Observed alongside the fingerprint but deliberately NOT part of it.
 *
 * `datasource_type` flips from `testdata` to `grafana-testdata-datasource` at
 * Grafana 10 (ADR-0003), so including it would make every cross-major compare
 * fail for a reason we already know and accept. Reported so a human can see
 * which side of the boundary they are on.
 */
export interface VerifyContext {
  datasource_type: string;
  grafana_version: string;
}

export interface VerifyResult {
  fingerprint: SeedFingerprint;
  context: VerifyContext;
}

export class VerifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerifyError";
  }
}

/** Endpoints `--verify` reads, in order. Printed by `--verify --dry-run`. */
export function verifyPlan(): string[] {
  return [
    "GET  /api/health",
    `GET  /api/datasources/uid/${SEED_DATASOURCE_UID}`,
    "POST /api/ds/query                       (datasource queryable check)",
    `GET  /api/dashboards/uid/${SEED_DASHBOARD_UID}`,
    "GET  /api/org/users                      (operator presence + role)",
  ];
}

/** Recursively sort object keys so serialization is byte-stable. */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    out[key] = canonicalize(source[key]);
  }
  return out;
}

/** Canonical serialization: sorted keys, trailing newline, no timestamps. */
export function canonicalJson(fingerprint: SeedFingerprint): string {
  return `${JSON.stringify(canonicalize(fingerprint), null, 2)}\n`;
}

/** Panels sorted by (title, type) — Grafana does not promise array order. */
export function sortPanels(panels: FingerprintPanel[]): FingerprintPanel[] {
  return [...panels].sort(
    (a, b) => a.title.localeCompare(b.title) || a.type.localeCompare(b.type),
  );
}

interface RawPanel {
  title?: string;
  type?: string;
  panels?: RawPanel[];
}

/**
 * Flatten one level of row-nested panels. Collapsed rows nest their children
 * under `panels`, and whether a row is collapsed is a saved-state detail we do
 * not want deciding the panel count.
 */
export function flattenPanels(panels: RawPanel[] | undefined): FingerprintPanel[] {
  const out: FingerprintPanel[] = [];
  for (const panel of panels ?? []) {
    if (Array.isArray(panel.panels) && panel.panels.length > 0) {
      out.push(...flattenPanels(panel.panels));
    }
    if (panel.type === "row") continue;
    out.push({ title: panel.title ?? "", type: panel.type ?? "" });
  }
  return out;
}

async function grafanaVersion(baseUrl: string): Promise<string> {
  const health = await api(baseUrl, "GET", "/api/health");
  if (health.status !== 200) {
    throw new VerifyError(
      `instance unreachable or unhealthy: GET /api/health returned ${health.status} ${health.text}`,
    );
  }
  const body = health.json as { version?: string } | null;
  return body?.version ?? "unknown";
}

/**
 * True when the datasource answers a trivial query. Uses /api/ds/query, which
 * exists across the whole matrix; the per-version datasource health endpoint
 * does not.
 */
async function isQueryable(baseUrl: string): Promise<boolean> {
  const res = await api(baseUrl, "POST", "/api/ds/query", {
    from: "now-5m",
    to: "now",
    queries: [
      {
        refId: "A",
        datasource: { uid: SEED_DATASOURCE_UID },
        scenarioId: "random_walk",
        intervalMs: 60_000,
        maxDataPoints: 10,
      },
    ],
  });
  return res.status === 200;
}

export async function buildFingerprint(baseUrl: string): Promise<VerifyResult> {
  const version = await grafanaVersion(baseUrl);

  const ds = await api(
    baseUrl,
    "GET",
    `/api/datasources/uid/${SEED_DATASOURCE_UID}`,
  );
  if (ds.status !== 200) {
    throw new VerifyError(
      `seed datasource ${SEED_DATASOURCE_UID} missing: ${ds.status} ${ds.text}`,
    );
  }
  const dsBody = ds.json as { name?: string; type?: string; uid?: string };

  const dash = await api(
    baseUrl,
    "GET",
    `/api/dashboards/uid/${SEED_DASHBOARD_UID}`,
  );
  if (dash.status !== 200) {
    throw new VerifyError(
      `seed dashboard ${SEED_DASHBOARD_UID} missing: ${dash.status} ${dash.text}`,
    );
  }
  const dashBody = dash.json as {
    dashboard?: { uid?: string; title?: string; panels?: RawPanel[] };
  };
  const panels = sortPanels(flattenPanels(dashBody.dashboard?.panels));

  const orgUsers = await api(baseUrl, "GET", "/api/org/users");
  if (orgUsers.status !== 200) {
    throw new VerifyError(
      `cannot read org users: ${orgUsers.status} ${orgUsers.text}`,
    );
  }
  const operator = (
    orgUsers.json as Array<{ login?: string; role?: string }>
  ).find((u) => u.login === SEED_OPERATOR_LOGIN);

  return {
    fingerprint: {
      dashboard: {
        panel_count: panels.length,
        panels,
        title: dashBody.dashboard?.title ?? "",
        uid: dashBody.dashboard?.uid ?? "",
      },
      datasource: {
        name: dsBody.name ?? SEED_DATASOURCE_NAME,
        queryable: await isQueryable(baseUrl),
        uid: dsBody.uid ?? "",
      },
      users: {
        operator_present: operator !== undefined,
        operator_role: operator?.role ?? null,
      },
    },
    context: {
      datasource_type: dsBody.type ?? "unknown",
      grafana_version: version,
    },
  };
}

/** Human-readable summary for stdout. */
export function summarize(result: VerifyResult): string {
  const { fingerprint: fp, context } = result;
  const lines = [
    `  dashboard:  ${fp.dashboard.uid} "${fp.dashboard.title}" — ${fp.dashboard.panel_count} panel(s)`,
    ...fp.dashboard.panels.map((p) => `                · ${p.title} [${p.type}]`),
    `  datasource: ${fp.datasource.uid} "${fp.datasource.name}" queryable=${fp.datasource.queryable}`,
    `  operator:   present=${fp.users.operator_present} role=${fp.users.operator_role ?? "n/a"}`,
    "",
    "  not fingerprinted (expected to differ across majors):",
    `    datasource_type = ${context.datasource_type}`,
    `    grafana_version = ${context.grafana_version}`,
  ];
  return lines.join("\n");
}

export interface FingerprintDiff {
  path: string;
  left: unknown;
  right: unknown;
}

/** Deep diff of two canonicalized fingerprints. Empty array means equal. */
export function diffFingerprints(
  left: SeedFingerprint,
  right: SeedFingerprint,
): FingerprintDiff[] {
  const diffs: FingerprintDiff[] = [];
  const walk = (a: unknown, b: unknown, path: string): void => {
    const aIsObj = a !== null && typeof a === "object" && !Array.isArray(a);
    const bIsObj = b !== null && typeof b === "object" && !Array.isArray(b);
    if (aIsObj && bIsObj) {
      const keys = new Set([
        ...Object.keys(a as Record<string, unknown>),
        ...Object.keys(b as Record<string, unknown>),
      ]);
      for (const key of [...keys].sort()) {
        walk(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key,
        );
      }
      return;
    }
    if (JSON.stringify(canonicalize(a)) !== JSON.stringify(canonicalize(b))) {
      diffs.push({ path, left: a, right: b });
    }
  };
  walk(canonicalize(left), canonicalize(right), "");
  return diffs;
}
