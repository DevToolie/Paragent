/**
 * End-to-end pipeline: record -> compile -> cache-write -> replay -> report.
 *
 * Runs against the bundled static fixture only: no Docker, no network, no model.
 * This is the only test that exercises the seams between packages; every other
 * suite tests one package in isolation.
 */

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, type Page } from "playwright";
import { launchTestBrowser } from "../helpers/browser.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TrajectoryRecorder } from "../../src/recorder/index.js";
import {
  FIXTURE_HOST,
  FIXTURE_URL_TEMPLATE,
  recordFixtureTask,
  startFixtureServer,
  type FixtureServer,
} from "../../src/recorder/fixture.js";
import type { Trajectory as RecordedTrajectory } from "../../src/recorder/types.js";
import { compileTrajectory, validateCompiledBundle } from "../../src/compiler/index.js";
import type { Trajectory as CompilerTrajectory } from "../../src/compiler/types.js";
import { writeCacheRowPair } from "../../src/cache/index.js";
import type { CacheRowCandidate } from "../../src/cache/types.js";
import { ReplayRunner } from "../../src/runner/replay.js";
import { bundleToProgram } from "../../src/runner/program.js";
import type { ParamBindings } from "../../src/runner/types.js";
import { MetricsEmitter } from "../../src/metrics/emitter.js";
import { buildGateReport } from "../../src/metrics/aggregate.js";
import type { MetricRow } from "../../src/metrics/types.js";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js");
const addFormats = require("ajv-formats");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The fixture is served over loopback rather than opened as `file://`, and the
 * server and the recorded task both come from `src/recorder/fixture.ts` — the
 * module the `--fixture` CLI itself uses.
 *
 * Not cosmetic, on either count. `file://{fixture_root}/...` makes the
 * parameter a whole filesystem path, and a path-valued hole spans `/`
 * separators — which the compiler's `templateToRegex` deliberately does not
 * allow (holes compile to `[^/?#]+` so a `url-matches` assertion cannot skip
 * across path segments). Loosening that to fit would weaken every URL assertion
 * the product emits.
 *
 * This test used to own a private copy of the server and the step sequence,
 * "matching the recorder CLI's". It matched a CLI that was recording something
 * else: the CLI still emitted `file://`, so the one path a visitor tries first
 * produced a bundle that failed at replay while this test stayed green
 * ([#141](https://github.com/DevToolie/Paragent/issues/141)). Driving the
 * product's own module is what makes this a seam test rather than a test of a
 * copy.
 *
 * Loopback only: no egress, no Docker, no model.
 */

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

// Bundle -> CompiledProgram now lives in `src/runner/program.ts`. It was local
// to this test while "the runtime never needs it today" was true; #62's live
// matrix driver made it needed, so this test now exercises the same adapter the
// gate runs rather than a copy that could drift from it.

/** Record the fixture task exactly as `npm run recorder -- --fixture` does. */
async function recordFixtureTrajectory(
  page: Page,
  params: FixtureParams,
): Promise<RecordedTrajectory> {
  const recorder = new TrajectoryRecorder(page, {
    trajectory_id: "traj-integration-fixture",
    site_key: "grafana-oss@fixture",
    task_key: "login-open-dashboards-list",
    base_url_template: FIXTURE_URL_TEMPLATE,
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

  await recordFixtureTask(recorder, page, {
    username: String(params.username),
    password: String(params.password),
  });

  return recorder.toTrajectory();
}

describe("pipeline: record -> compile -> cache -> replay", () => {
  let browser: Browser;
  let server: FixtureServer;
  let params: FixtureParams;

  beforeAll(async () => {
    server = await startFixtureServer();
    params = buildParams(server.port);
    browser = await launchTestBrowser();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it(
    "records, compiles, writes through the privacy boundary, and replays clean",
    async () => {
      // --- 1. record -------------------------------------------------------
      const recordPage = await browser.newPage();
      let trajectory: RecordedTrajectory;
      try {
        trajectory = await recordFixtureTrajectory(recordPage, params);
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

      // ADR-0007: visible_landmarks must mean visible. The fixture's app view
      // is `hidden` on load, so its banner/navigation must NOT be reported on
      // the freshly navigated page — they were, before this was filtered.
      expect(trajectory.steps[0]!.post_state.visible_landmarks).toEqual([
        "main",
        "form",
      ]);
      // And the acted-on control's fate is recorded: the dismiss button is gone.
      expect(trajectory.steps[5]!.post_action_target_visible).toBe(false);
      expect(trajectory.steps[4]!.post_action_target_visible).toBe(true);

      // --- 2. compile ------------------------------------------------------
      const bundle = compileTrajectory(
        trajectory as unknown as CompilerTrajectory,
        { compiledAt: "2026-07-25T00:00:00.000Z" },
      );
      expect(bundle.rows.length).toBe(trajectory.steps.length);

      const bundleValidation = await validateCompiledBundle(bundle);
      expect(bundleValidation.errors).toEqual([]);
      expect(bundleValidation.ok).toBe(true);

      // A green replay proves nothing on its own: the compiler could fall
      // through to a weaker assertion and still pass. Pin the shapes.
      const shapes = bundle.rows.map((r) => ({
        action: r.compiled_action.type,
        type: r.assertion.type,
        visible: r.assertion.expected?.visible,
      }));

      // Login submit: navigates AND hides its control — the destination wins
      // over the disappearance (ADR-0007 ordering).
      expect(shapes[3]).toEqual({
        action: "click",
        type: "url-matches",
        visible: undefined,
      });
      // Dismiss: hides itself, no URL change. Must assert the control is GONE,
      // not that it is still visible. This is the #71 regression guard.
      expect(shapes[5]).toEqual({
        action: "click",
        type: "element-visible",
        visible: false,
      });
      expect(bundle.rows[5]!.assertion.strength).toBe("strong");

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
          bundleToProgram(bundle, "fixture-v1"),
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
