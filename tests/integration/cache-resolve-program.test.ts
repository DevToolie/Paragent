/**
 * compile → cache write → resolve → replay, on a real `JsonlCacheStore` (#120).
 *
 * The unit tests drive `resolveProgram` against hand-built rows. This drives the
 * seam the product would actually use, because the interesting failures live in
 * the wiring: a compiler that stamps identity onto its bundle but not onto what
 * reaches disk, a write path that drops the new field while rebuilding the row,
 * a resolver that agrees with a fixture and disagrees with the store.
 *
 * The truncation case is the reason this file exists. A cache holding rows 0-1
 * of a 3-step flow is not a bad number — it is a browser that opens a page,
 * clicks once, and stops inside a form. Every row on disk is individually
 * valid, so nothing below the program level can detect it, and the only place
 * it can be caught is here.
 *
 * No Docker, no network, no model, no browser: the replay runs in `dryRun`,
 * because what is under test is *which program comes back*, not what a page
 * does with it. `tests/integration/cache-lifecycle.test.ts` already covers the
 * live-browser half of the cache seam.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { compileTrajectory } from "../../src/compiler/compile.js";
import type { Trajectory } from "../../src/compiler/types.js";
import { JsonlCacheStore } from "../../src/cache/store.js";
import { writeCacheRowPair } from "../../src/cache/write.js";
import { resolveProgram } from "../../src/cache/resolve.js";
import type { CacheRow, CacheRowCandidate } from "../../src/cache/types.js";
import { bundleToProgram, rowsToProgram } from "../../src/runner/program.js";
import { ReplayRunner } from "../../src/runner/replay.js";

const SITE = "fixture@local";
const TASK = "three-step";

const fingerprint = (url: string) => ({
  url_template: url,
  title_template: "Fixture",
  dom_digest: "digest",
  visible_landmarks: ["main"],
  network_idle: true,
});

/**
 * Three steps, one of which needs a parameter bound.
 *
 * `fill` carries `param_refs`, which is what makes `required_params` non-empty
 * on the far side — the point being that a caller can be told what to bind
 * before anything opens a browser, from a program it resolved rather than one
 * it was handed.
 */
function trajectory(): Trajectory {
  return {
    schema_version: "1.0.0",
    trajectory_id: "traj-resolve-integration",
    site_key: SITE,
    task_key: TASK,
    recorded_at: "2026-08-11T10:00:00.000Z",
    base_url_template: "http://{host}:{port}/",
    provenance: {
      recorder: "test",
      agent_model: "human",
      testbed_version: "fixture-v1",
    },
    parameters: { host: "string", port: "integer", username: "string" },
    steps: [
      {
        step_index: 0,
        intent: "Open the app",
        action: { type: "navigate" as const, url_template: "http://{host}:{port}/" },
        locator_candidates: [],
        pre_state: fingerprint("http://{host}:{port}/"),
        post_state: fingerprint("http://{host}:{port}/"),
        timing_ms: { started_offset_ms: 0, duration_ms: 5 },
      },
      {
        step_index: 1,
        intent: "Type the username",
        action: { type: "fill" as const, param_refs: ["username"] },
        locator_candidates: [
          { strategy: "role_name" as const, rank: 0, role: "textbox", name: "Username" },
        ],
        pre_state: fingerprint("http://{host}:{port}/"),
        post_state: fingerprint("http://{host}:{port}/"),
        timing_ms: { started_offset_ms: 5, duration_ms: 5 },
      },
      {
        step_index: 2,
        intent: "Save",
        action: { type: "click" as const },
        locator_candidates: [
          { strategy: "role_name" as const, rank: 0, role: "button", name: "Save" },
        ],
        pre_state: fingerprint("http://{host}:{port}/"),
        post_state: fingerprint("http://{host}:{port}/saved"),
        timing_ms: { started_offset_ms: 10, duration_ms: 5 },
      },
    ],
  } as unknown as Trajectory;
}

/** Persist rows 0..limit-1 through the real gatekeeper. */
function writeRows(store: JsonlCacheStore, rows: CacheRow[], limit = rows.length): void {
  for (const row of rows.slice(0, limit)) {
    writeCacheRowPair(row as unknown as CacheRowCandidate, { store });
  }
}

describe("compile → write → resolve → replay", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "paragent-resolve-"));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("a fully-written task resolves to the same program the bundle produces", () => {
    const store = new JsonlCacheStore({ dir: path.join(dir, "complete") });
    const bundle = compileTrajectory(trajectory());
    writeRows(store, bundle.rows as unknown as CacheRow[]);

    const resolution = resolveProgram(store, { site_key: SITE, task_key: TASK });
    expect(resolution.status).toBe("hit");
    if (resolution.status !== "hit") return;

    const fromCache = rowsToProgram(resolution, "11.0.0");
    const fromBundle = bundleToProgram(bundle, "11.0.0");

    // The two sources must describe the same task under the same name, or
    // nothing downstream can join a cache-resolved run to a bundle-resolved one.
    expect(fromCache.program_id).toBe(fromBundle.program_id);
    expect(fromCache.steps.map((s) => s.step_index)).toEqual(
      fromBundle.steps.map((s) => s.step_index),
    );
    expect(fromCache.steps).toHaveLength(3);
  });

  it("reports what to bind before anything opens a browser", () => {
    // Derived from the resolved rows rather than stored on them (ADR-0013), so
    // it cannot go stale against the steps it describes.
    const store = new JsonlCacheStore({ dir: path.join(dir, "params") });
    const bundle = compileTrajectory(trajectory());
    writeRows(store, bundle.rows as unknown as CacheRow[]);

    const resolution = resolveProgram(store, { site_key: SITE, task_key: TASK });
    if (resolution.status !== "hit") throw new Error("expected a hit");
    expect(rowsToProgram(resolution, "11.0.0").required_params).toContain("username");
  });

  it("survives a reopen — the identity is on disk, not just in memory", () => {
    // The store rebuilds its index from the JSONL files at construction, so a
    // `program` that only existed on the in-memory row would resolve in-process
    // and vanish on restart. That is the version of this bug that would reach
    // production.
    const cacheDir = path.join(dir, "reopen");
    const bundle = compileTrajectory(trajectory());
    writeRows(new JsonlCacheStore({ dir: cacheDir }), bundle.rows as unknown as CacheRow[]);

    const reopened = new JsonlCacheStore({ dir: cacheDir });
    const resolution = resolveProgram(reopened, { site_key: SITE, task_key: TASK });
    expect(resolution.status).toBe("hit");
    if (resolution.status !== "hit") return;
    expect(resolution.steps_total).toBe(3);
  });

  it("a resolved program is actually replayable", async () => {
    const store = new JsonlCacheStore({ dir: path.join(dir, "replay") });
    const bundle = compileTrajectory(trajectory());
    writeRows(store, bundle.rows as unknown as CacheRow[]);

    const resolution = resolveProgram(store, { site_key: SITE, task_key: TASK });
    if (resolution.status !== "hit") throw new Error("expected a hit");

    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: ["PASS", "PASS", "PASS"],
    });
    const result = await runner.run(rowsToProgram(resolution, "11.0.0"), {
      host: "127.0.0.1",
      port: 3000,
      username: "someone",
    });

    // Every step attempted, none skipped: a resolved program is a whole
    // program, and the read path did not become a second place that decides
    // what is worth running.
    expect(result.steps_total).toBe(3);
    expect(result.steps_attempted).toBe(3);
    expect(result.task_success).toBe(true);
  });
});

describe("a truncated write never yields a short program", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "paragent-truncated-"));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("stops at a MISS rather than replaying the prefix", () => {
    // The failure #120 exists to prevent, driven through the real store: two of
    // three rows on disk, both valid, and the resolver refuses.
    const store = new JsonlCacheStore({ dir: path.join(dir, "short") });
    const bundle = compileTrajectory(trajectory());
    writeRows(store, bundle.rows as unknown as CacheRow[], 2);

    const resolution = resolveProgram(store, { site_key: SITE, task_key: TASK });
    expect(resolution.status).toBe("miss");
    if (resolution.status !== "miss") return;
    expect(resolution.reason).toBe("incomplete");
    expect(resolution.detail).toContain("missing step_index 2");
  });

  it("the rows really are on disk — the miss is a refusal, not an empty cache", () => {
    // Counter-check. If the writes had silently failed, the assertion above
    // would pass for the wrong reason and prove nothing about truncation.
    const store = new JsonlCacheStore({ dir: path.join(dir, "evidence") });
    const bundle = compileTrajectory(trajectory());
    writeRows(store, bundle.rows as unknown as CacheRow[], 2);

    const rows = store.list({ site_key: SITE, task_key: TASK });
    expect(rows.map((r) => r.step_index)).toEqual([0, 1]);
    expect(rows[0]?.program?.steps_total).toBe(3);
  });
});
