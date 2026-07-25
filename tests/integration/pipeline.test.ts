/**
 * End-to-end pipeline: record -> compile -> cache-write -> replay -> report.
 *
 * Runs against the bundled static fixture only: no Docker, no network, no model.
 * This is the only test that exercises the seams between packages; every other
 * suite tests one package in isolation.
 */

import { createRequire } from "node:module";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TrajectoryRecorder } from "../../src/recorder/index.js";
import type { Trajectory as RecordedTrajectory } from "../../src/recorder/types.js";
import { compileTrajectory, validateCompiledBundle } from "../../src/compiler/index.js";
import type {
  CompiledTrajectoryBundle,
  Trajectory as CompilerTrajectory,
} from "../../src/compiler/types.js";
import { writeCacheRowPair } from "../../src/cache/index.js";
import type { CacheRowCandidate } from "../../src/cache/types.js";
import { ReplayRunner } from "../../src/runner/replay.js";
import type {
  Assertion,
  CompiledAction,
  CompiledProgram,
  ParamBindings,
} from "../../src/runner/types.js";
import { MetricsEmitter } from "../../src/metrics/emitter.js";
import { buildGateReport } from "../../src/metrics/aggregate.js";
import type { MetricRow } from "../../src/metrics/types.js";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js");
const addFormats = require("ajv-formats");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "src/recorder/fixtures/grafana-gate-login.html");
const FIXTURE_HOST = "127.0.0.1";
const URL_TEMPLATE = "http://{host}:{port}/grafana-gate-login.html";

/**
 * The fixture is served over loopback rather than opened as `file://`.
 *
 * Not cosmetic. `file://{fixture_root}/...` makes the parameter a whole
 * filesystem path, and a path-valued hole spans `/` separators — which the
 * compiler's `templateToRegex` deliberately does not allow (holes compile to
 * `[^/?#]+` so a `url-matches` assertion cannot skip across path segments).
 * Loosening that to fit the test would weaken every URL assertion the product
 * emits.
 *
 * `http://{host}:{port}/...` is also the shape a real recording has — it is
 * exactly what `npm run recorder -- --base-url` produces against the Grafana
 * testbed — so the seam under test is the representative one.
 *
 * Loopback only: no egress, no Docker, no model.
 */
function startFixtureServer(): Promise<Server> {
  const dir = path.dirname(FIXTURE);
  const server = createServer((req, res) => {
    const name = path.basename(new URL(req.url ?? "/", "http://localhost").pathname);
    readFile(path.join(dir, name), "utf8").then(
      (body) => {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(body);
      },
      () => {
        res.writeHead(404).end("not found");
      },
    );
  });
  return new Promise((resolve) => {
    server.listen(0, FIXTURE_HOST, () => resolve(server));
  });
}

/** Test-only values. Never persisted — the recorder lifts them to param slots. */
type FixtureParams = ParamBindings & {
  host: string;
  port: number;
  username: string;
  password: string;
};

function buildParams(port: number): FixtureParams {
  return {
    host: FIXTURE_HOST,
    port,
    username: "pipeline-user-never-persist",
    password: "pipeline-secret-never-persist",
  };
}

/**
 * Bundle -> CompiledProgram.
 *
 * Local to this test on purpose: the runtime never needs it today, and adding an
 * adapter to src/compiler/ would be a contract change (CONTRIBUTING: extend
 * schemas via ADR, not ad-hoc fields). The two shapes are structurally identical
 * per step; only the wrapper differs.
 */
function toCompiledProgram(
  bundle: CompiledTrajectoryBundle,
  testbedVersion: string,
): CompiledProgram {
  return {
    schema_version: "1.0.0",
    program_id: `prog-${bundle.source_trajectory_id}`,
    site_key: bundle.site_key,
    task_key: bundle.task_key,
    testbed_version: testbedVersion,
    steps: bundle.rows.map((row) => ({
      step_index: row.step_index,
      row_id: row.row_id,
      compiled_action: row.compiled_action as CompiledAction,
      assertion: row.assertion as Assertion,
    })),
  };
}

/** Drive the fixture gate task, matching the recorder CLI's step sequence. */
async function recordFixtureTask(
  page: Page,
  params: FixtureParams,
): Promise<RecordedTrajectory> {
  const recorder = new TrajectoryRecorder(page, {
    trajectory_id: "traj-integration-fixture",
    site_key: "grafana-oss@fixture",
    task_key: "login-open-dashboards-list",
    base_url_template: URL_TEMPLATE,
    provenance: {
      recorder: "integration-test",
      agent_model: "human",
      testbed_version: "fixture-v1",
    },
    parameters: {
      host: "string",
      port: "integer",
      username: "string",
      password: "secret_ref",
    },
    bindings: { host: params.host, port: params.port },
  });

  await recorder.navigate(URL_TEMPLATE, "Open the login page", [
    "host",
    "port",
  ]);
  await recorder.fill(
    page.getByLabel("Username"),
    "username",
    String(params.username),
    "Fill username field",
  );
  await recorder.fill(
    page.getByLabel("Password"),
    "password",
    String(params.password),
    "Fill username secret field",
  );
  await recorder.click(
    page.getByRole("button", { name: "Log in" }),
    "Submit login form",
  );
  await recorder.click(
    page.getByTestId("nav-dashboards"),
    "Navigate to Dashboards list",
  );

  return recorder.toTrajectory();
}

describe("pipeline: record -> compile -> cache -> replay", () => {
  let browser: Browser;
  let server: Server;
  let params: FixtureParams;

  beforeAll(async () => {
    server = await startFixtureServer();
    params = buildParams((server.address() as AddressInfo).port);
    browser = await chromium.launch({ headless: true });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it(
    "records, compiles, writes through the privacy boundary, and replays clean",
    async () => {
      // --- 1. record -------------------------------------------------------
      const recordPage = await browser.newPage();
      let trajectory: RecordedTrajectory;
      try {
        trajectory = await recordFixtureTask(recordPage, params);
      } finally {
        await recordPage.close();
      }

      const trajectorySchema = JSON.parse(
        await readFile(path.join(ROOT, "contracts/trajectory.schema.json"), "utf8"),
      );
      const ajv = new Ajv2020({ allErrors: true, strict: false });
      addFormats(ajv);
      const validateTrajectory = ajv.compile(trajectorySchema);
      expect(
        validateTrajectory(trajectory),
        JSON.stringify(validateTrajectory.errors),
      ).toBe(true);

      // Typed values must never reach the artifact.
      const trajectoryText = JSON.stringify(trajectory);
      expect(trajectoryText).not.toContain(String(params.username));
      expect(trajectoryText).not.toContain(String(params.password));

      // --- 2. compile ------------------------------------------------------
      const bundle = compileTrajectory(
        trajectory as unknown as CompilerTrajectory,
        { compiledAt: "2026-07-25T00:00:00.000Z" },
      );
      expect(bundle.rows.length).toBe(trajectory.steps.length);

      const bundleValidation = await validateCompiledBundle(bundle);
      expect(bundleValidation.errors).toEqual([]);
      expect(bundleValidation.ok).toBe(true);

      // --- 3. cache write --------------------------------------------------
      for (const row of bundle.rows) {
        const { pool } = writeCacheRowPair(row as unknown as CacheRowCandidate);
        for (const loc of pool.compiled_action.locator_fallback_chain) {
          expect(loc.strategy).not.toBe("text");
          expect(loc.tenant_scoped).not.toBe(true);
        }
      }

      // --- 4. replay live --------------------------------------------------
      const emitter = new MetricsEmitter();
      const replayPage = await browser.newPage();
      let result;
      try {
        const runner = new ReplayRunner({
          dryRun: false,
          page: replayPage,
          metrics: emitter,
          maxRepairsPerRun: 0,
        });
        result = await runner.run(
          toCompiledProgram(bundle, "fixture-v1"),
          params,
        );
      } finally {
        await replayPage.close();
      }

      const failures = result.step_results
        .filter((s) => s.outcome !== "PASS")
        .map((s) => `step ${s.step_index}: ${s.outcome} — ${s.error_message ?? ""}`);
      expect(failures, failures.join("\n")).toEqual([]);
      expect(result.steps_replay_valid).toBe(result.steps_total);
      expect(result.task_success).toBe(true);
      expect(result.repair_count).toBe(0);

      // --- 5. report -------------------------------------------------------
      const rows: readonly MetricRow[] = emitter.getRows();
      const report = buildGateReport(rows);
      const validity = report.metrics.find((m) =>
        m.name.includes("step-level replay-validity"),
      );
      expect(validity?.status).toBe("computed");
      expect(validity?.value).toBe(1);
    },
    120_000,
  );
});
