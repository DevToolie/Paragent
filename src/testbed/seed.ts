import {
  FIXTURE_ADMIN_PASS,
  FIXTURE_ADMIN_USER,
  SEED_DASHBOARD_UID,
  SEED_DATASOURCE_NAME,
  SEED_DATASOURCE_UID,
  SEED_OPERATOR_EMAIL,
  SEED_OPERATOR_LOGIN,
  SEED_OPERATOR_PASS,
} from "./constants.js";
import { testdataTypeFor } from "./matrix.js";

export interface SeedOptions {
  baseUrl: string;
  versionId: string;
  timeoutMs?: number;
}

function basicAuthHeader(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`;
}

async function api(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: unknown; text: string }> {
  const headers: Record<string, string> = {
    Authorization: basicAuthHeader(FIXTURE_ADMIN_USER, FIXTURE_ADMIN_PASS),
    Accept: "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const init: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, init);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body — leave it null and let the caller use `text`.
  }
  return { status: res.status, json, text };
}

/** Poll GET /api/health until database is ok or timeout. */
export async function waitForHealth(
  baseUrl: string,
  timeoutMs = 120_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`);
      last = await res.text();
      if (res.ok && /ok/i.test(last)) return;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Grafana health timeout after ${timeoutMs}ms (last: ${last})`);
}

export async function ensureDatasource(
  baseUrl: string,
  versionId: string,
): Promise<void> {
  const dsType = testdataTypeFor(versionId);
  const list = await api(baseUrl, "GET", "/api/datasources");
  if (list.status !== 200 || !Array.isArray(list.json)) {
    throw new Error(`list datasources failed: ${list.status} ${list.text}`);
  }
  const existing = (list.json as Array<{ uid?: string; name?: string }>).find(
    (d) => d.uid === SEED_DATASOURCE_UID || d.name === SEED_DATASOURCE_NAME,
  );
  const payload = {
    name: SEED_DATASOURCE_NAME,
    type: dsType,
    access: "proxy",
    uid: SEED_DATASOURCE_UID,
    isDefault: true,
  };
  if (existing) {
    const upd = await api(baseUrl, "PUT", `/api/datasources/uid/${SEED_DATASOURCE_UID}`, {
      ...payload,
      id: (existing as { id?: number }).id,
    });
    if (upd.status >= 400) {
      // Provisioned DS may already be correct; tolerate conflict-ish responses.
      if (upd.status !== 409) {
        console.warn(`ensureDatasource update: ${upd.status} ${upd.text}`);
      }
    }
    return;
  }
  const create = await api(baseUrl, "POST", "/api/datasources", payload);
  if (create.status >= 400 && create.status !== 409) {
    throw new Error(`create datasource failed: ${create.status} ${create.text}`);
  }
}

export async function ensureDashboard(baseUrl: string): Promise<void> {
  const get = await api(baseUrl, "GET", `/api/dashboards/uid/${SEED_DASHBOARD_UID}`);
  if (get.status === 200) return;
  // Provisioning should have loaded it; if not, import minimal shell.
  const body = {
    dashboard: {
      uid: SEED_DASHBOARD_UID,
      title: "Paragent Seed",
      schemaVersion: 30,
      panels: [],
      tags: ["paragent", "seed"],
      timezone: "browser",
    },
    folderUid: "",
    overwrite: true,
    message: "paragent seed ensure",
  };
  const put = await api(baseUrl, "POST", "/api/dashboards/db", body);
  if (put.status >= 400) {
    throw new Error(`ensure dashboard failed: ${put.status} ${put.text}`);
  }
}

export async function ensureOperator(baseUrl: string): Promise<void> {
  const search = await api(
    baseUrl,
    "GET",
    `/api/users/lookup?loginOrEmail=${encodeURIComponent(SEED_OPERATOR_LOGIN)}`,
  );
  if (search.status === 200) return;

  const create = await api(baseUrl, "POST", "/api/admin/users", {
    name: "Paragent Operator",
    email: SEED_OPERATOR_EMAIL,
    login: SEED_OPERATOR_LOGIN,
    // Grafana HTTP API field (colon-form JSON key — not dotenv assignment).
    password: SEED_OPERATOR_PASS,
    OrgId: 1,
  });
  if (create.status >= 400 && create.status !== 412) {
    // 412 / conflict variants depending on version
    if (create.status !== 409) {
      throw new Error(`ensure operator failed: ${create.status} ${create.text}`);
    }
  }
}

/** Idempotent seed: health → datasource → dashboard → operator. */
export async function seedInstance(opts: SeedOptions): Promise<void> {
  await waitForHealth(opts.baseUrl, opts.timeoutMs ?? 120_000);
  await ensureDatasource(opts.baseUrl, opts.versionId);
  await ensureDashboard(opts.baseUrl);
  await ensureOperator(opts.baseUrl);
}
