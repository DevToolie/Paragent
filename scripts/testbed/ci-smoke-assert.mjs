#!/usr/bin/env node
/**
 * CI smoke assertion for a booted test-bed instance.
 *
 * Interim stand-in for `npm run testbed -- --version <X> --verify` (issue #57).
 * Asserts, against an already-booted instance:
 *   1. GET /api/health reports database ok
 *   2. the provisioned/seeded dashboard uid `paragent-seed` exists
 *   3. the provisioned/seeded datasource uid `paragent-testdata` exists
 *
 * Fixture credentials are read from scripts/testbed/matrix.json — the existing
 * source of truth for the local Docker fixture — so no credential literal lives
 * in the workflow file or is echoed into the job log.
 *
 *   node scripts/testbed/ci-smoke-assert.mjs --version 11.0.0 [--port 3000]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const MATRIX = JSON.parse(readFileSync(path.join(HERE, "matrix.json"), "utf8"));

const SEED_DASHBOARD_UID = "paragent-seed-DELIBERATELY-WRONG";
const SEED_DATASOURCE_UID = "paragent-testdata";
const HEALTH_TIMEOUT_MS = 120_000;

/** @param {string[]} argv */
function parse(argv) {
  let version;
  let port = MATRIX.host_port_default;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--version" || a === "-v") {
      version = argv[++i];
    } else if (a === "--port") {
      port = Number.parseInt(argv[++i], 10);
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  if (!version) throw new Error("--version is required");
  if (!Number.isFinite(port) || port <= 0) throw new Error("invalid --port");
  return { version, port };
}

const authHeader = () =>
  "Basic " +
  Buffer.from(
    `${MATRIX.fixture_admin_user}:${MATRIX.fixture_admin_pass}`,
    "utf8",
  ).toString("base64");

/**
 * @param {string} baseUrl
 * @param {string} p
 */
async function get(baseUrl, p) {
  const res = await fetch(`${baseUrl}${p}`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body — callers fall back to `text`.
  }
  return { status: res.status, json, text };
}

/** @param {string} baseUrl */
async function assertHealthy(baseUrl) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let last = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      last = await res.text();
      if (res.ok && /"database"\s*:\s*"ok"/i.test(last)) {
        console.log(`  health: ok  ${last.replace(/\s+/g, " ").trim()}`);
        return;
      }
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(
    `health assertion failed after ${HEALTH_TIMEOUT_MS}ms (last: ${last})`,
  );
}

/** @param {string} baseUrl */
async function assertSeedDashboard(baseUrl) {
  const res = await get(baseUrl, `/api/dashboards/uid/${SEED_DASHBOARD_UID}`);
  if (res.status !== 200) {
    throw new Error(
      `seed dashboard ${SEED_DASHBOARD_UID} missing: ${res.status} ${res.text}`,
    );
  }
  const title = res.json?.dashboard?.title;
  if (!title) {
    throw new Error(`seed dashboard ${SEED_DASHBOARD_UID} has no title`);
  }
  console.log(`  dashboard: ${SEED_DASHBOARD_UID} present ("${title}")`);
}

/** @param {string} baseUrl */
async function assertSeedDatasource(baseUrl) {
  const res = await get(baseUrl, `/api/datasources/uid/${SEED_DATASOURCE_UID}`);
  if (res.status !== 200) {
    throw new Error(
      `seed datasource ${SEED_DATASOURCE_UID} missing: ${res.status} ${res.text}`,
    );
  }
  console.log(`  datasource: ${SEED_DATASOURCE_UID} present (${res.json?.type})`);
}

async function main() {
  const { version, port } = parse(process.argv.slice(2));
  const baseUrl = MATRIX.base_url_template.replace("{port}", String(port));
  console.log(`smoke assert: ${MATRIX.target} ${version} at ${baseUrl}`);

  await assertHealthy(baseUrl);
  await assertSeedDashboard(baseUrl);
  await assertSeedDatasource(baseUrl);

  console.log("smoke assert: PASS");
}

main().catch((err) => {
  console.error(`smoke assert: FAIL — ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
