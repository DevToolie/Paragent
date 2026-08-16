/**
 * `paragent compile --to-cache` end to end (issue #166).
 *
 * `cache-resolve-program.test.ts` already drives compile → write → resolve, but
 * it does so by calling `writeCacheRowPair` itself, row by row, from the test.
 * That is the seam; it is not the **shipped path**. Until #166 there was no
 * shipped path: `writeCacheRow()` had no caller outside `tests/`, so
 * `gate:matrix --from-cache <dir>` read a directory nothing in the product
 * could populate, and `cacheHitRate()` could only ever report `no_data` for a
 * reason that had nothing to do with the experiment.
 *
 * So what is under test here is the hop itself — `ingestBundle`, the function
 * the compiler CLI calls — and the two properties that make it safe to put in
 * front of the privacy boundary:
 *
 *  1. **The authority decides `pool_eligible`, not the compiler's pre-check.**
 *     A pre-check may be stricter than `writeCacheRow`; it may never be looser,
 *     and a bundle that claims otherwise is refused rather than written.
 *  2. **All or nothing.** A rejection part-way through cannot leave a prefix on
 *     disk. `resolveProgram` would fail closed on a prefix anyway (`incomplete`
 *     is a miss, not a truncated replay), but a cache that half-holds a program
 *     is a worse thing to debug than one that does not hold it.
 *
 * The last test runs the **committed 12-step live gate bundle** rather than a
 * synthetic one, for the same reason `live-bundle-pool.test.ts` does: synthetic
 * fixtures are what let the pre-check/authority divergence through in the first
 * place.
 */

import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { compileTrajectory } from "../../src/compiler/compile.js";
import type { Trajectory } from "../../src/compiler/types.js";
import { ingestBundle, type IngestableBundle } from "../../src/cache/ingest.js";
import { CacheWriteRejectedError } from "../../src/cache/write.js";
import { JsonlCacheStore, POOL_FILE, TENANT_FILE } from "../../src/cache/store.js";
import { resolveProgram } from "../../src/cache/resolve.js";
import { rowsToProgram } from "../../src/runner/program.js";

const SITE = "fixture@local";
const TASK = "ingest-three-step";

const LIVE_BUNDLE = path.join(
  process.cwd(),
  "artifacts/compiled/traj-gate-live-create-stat-dashboard-from-testdata-9.5.21.bundle.json",
);

const fingerprint = (url: string) => ({
  url_template: url,
  title_template: "Fixture",
  dom_digest: "digest",
  visible_landmarks: ["main"],
  network_idle: true,
});

function trajectory(): Trajectory {
  return {
    schema_version: "1.0.0",
    trajectory_id: "traj-ingest-integration",
    site_key: SITE,
    task_key: TASK,
    recorded_at: "2026-08-11T10:00:00.000Z",
    base_url_template: "http://{host}:{port}/",
    provenance: { recorder: "test", agent_model: "human", testbed_version: "fixture-v1" },
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

const asIngestable = (bundle: unknown) => bundle as unknown as IngestableBundle;

/**
 * Make one row claim pool eligibility the authority will refuse.
 *
 * Via the assertion rather than the locator chain, deliberately: a tainted
 * locator on a row that carries `flow_topology` legally degrades to a pooled
 * `topology_only` row, so it is *not* a refusal on every step. A tenant literal
 * in `expected.template` is checked first in `buildPoolRow` and short-circuits
 * before that fallback, which makes the violation independent of which step it
 * is applied to — the property this helper's callers actually need.
 */
function poison(bundle: { rows: unknown[] }, stepIndex: number): { rows: unknown[] } {
  const rows = structuredClone(bundle.rows) as Record<string, unknown>[];
  const row = rows[stepIndex] as {
    pool_eligible: boolean;
    assertion: { expected?: Record<string, unknown> };
  };
  row.pool_eligible = true;
  row.assertion.expected = {
    ...row.assertion.expected,
    template: "Acme Widgets Inc invoice #4471",
  };
  return { ...bundle, rows };
}

describe("compiled bundle → cache, through the write authority (#166)", () => {
  let root: string;
  let n = 0;
  const freshDir = () => path.join(root, `case-${n++}`);

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "paragent-ingest-"));
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("populates a cache that resolveProgram then returns as a complete program", () => {
    const dir = freshDir();
    const store = new JsonlCacheStore({ dir });
    const bundle = compileTrajectory(trajectory());

    const summary = ingestBundle(asIngestable(bundle), { store });
    expect(summary.steps).toBe(3);
    expect(summary.program_id).toBe("prog-traj-ingest-integration");

    // The claim that matters: a *different* store, opened on the same directory,
    // resolves the whole program. That is the `--from-cache` path exactly — it
    // does not share process state with whoever wrote the rows.
    const reader = new JsonlCacheStore({ dir });
    const resolution = resolveProgram(reader, { site_key: SITE, task_key: TASK });
    expect(resolution.status).toBe("hit");
    if (resolution.status !== "hit") return;

    expect(resolution.steps_total).toBe(3);
    expect(resolution.rows.map((r) => r.step_index)).toEqual([0, 1, 2]);
    expect(resolution.program_id).toBe("prog-traj-ingest-integration");

    // And it is replayable — `required_params` derived from the rows, which is
    // what a caller is told to bind before anything opens a browser.
    const program = rowsToProgram(resolution, "11.0.0");
    expect(program.steps).toHaveLength(3);
  });

  it("writes rows to disk, not just into an in-process index", () => {
    const dir = freshDir();
    ingestBundle(asIngestable(compileTrajectory(trajectory())), {
      store: new JsonlCacheStore({ dir }),
    });

    // Both files, because writeCacheRowPair persists the tenant row too and the
    // store routes it by `pool_eligible`. A pool row in the tenant file (or the
    // reverse) is the leak `tests/canary/store-leak.test.ts` guards from disk.
    expect(existsSync(path.join(dir, POOL_FILE))).toBe(true);
    expect(existsSync(path.join(dir, TENANT_FILE))).toBe(true);
  });

  it("lets the authority, not the compiler pre-check, decide pool_eligible", () => {
    const dir = freshDir();
    const store = new JsonlCacheStore({ dir });
    const bundle = compileTrajectory(trajectory());

    const summary = ingestBundle(asIngestable(bundle), { store });

    // Every pool row on disk carries the authority's verdict. Whatever the
    // compiler wrote into the bundle file is a pre-check and does not travel.
    //
    // Filtered rather than `list().filter(...)`: the default view merges pool
    // and tenant per key and the tenant row wins, because it is written second.
    // Asking the store for pool rows is what `--pool-only` does.
    const pooled = store.list({ pool_eligible: true });
    expect(pooled).toHaveLength(summary.pool_eligible);
    for (const row of pooled) {
      for (const loc of row.compiled_action.locator_fallback_chain) {
        expect(loc.tenant_scoped).not.toBe(true);
        expect(loc.strategy).not.toBe("text");
      }
    }
    // Reported, not smoothed over — see IngestSummary.widened.
    expect(Array.isArray(summary.widened)).toBe(true);
  });

  it("refuses the whole bundle, writing nothing, when a row claims eligibility the authority denies", () => {
    const dir = freshDir();
    const store = new JsonlCacheStore({ dir });
    const bundle = compileTrajectory(trajectory());

    // A tenant literal in the assertion can never be pool-safe; claiming it is,
    // is the one direction a pre-check is never allowed to be wrong in.
    expect(() =>
      ingestBundle(asIngestable(poison(bundle, 2)), { store }),
    ).toThrow(CacheWriteRejectedError);

    // All-or-nothing: step 2 was rejected, so steps 0 and 1 must not be on disk.
    // Without the two-pass write this directory holds a resolvable-looking
    // prefix of a program that was refused.
    const onDisk = existsSync(dir) ? readdirSync(dir) : [];
    expect(onDisk).toEqual([]);
    expect(resolveProgram(new JsonlCacheStore({ dir }), { site_key: SITE, task_key: TASK }).status).toBe("miss");
  });

  it("names the offending step in the rejection", () => {
    // `writeCacheRowPair` knows the row but not its position in a bundle, so a
    // bare rejection reads the same for all twelve steps of the live task.
    const bundle = compileTrajectory(trajectory());
    expect(() =>
      ingestBundle(asIngestable(poison(bundle, 1)), {
        store: new JsonlCacheStore({ dir: freshDir() }),
      }),
    ).toThrow(/step 1:/);
  });

  it("refuses rows with no program ref rather than caching something unresolvable", () => {
    // Without ADR-0013 identity these rows resolve as `no_program_ref` forever.
    // Writing them would produce a cache that is populated and permanently
    // useless — the worst of both, and invisible until someone reads a miss reason.
    const bundle = compileTrajectory(trajectory());
    const rows = structuredClone(bundle.rows) as unknown as Record<string, unknown>[];
    for (const r of rows) delete r.program;

    expect(() =>
      ingestBundle(asIngestable({ ...bundle, rows }), {
        store: new JsonlCacheStore({ dir: freshDir() }),
      }),
    ).toThrow(/no program ref/);
  });

  it("round-trips the committed 12-step live gate bundle", async () => {
    // The real artifact, not a synthetic one. This is the bundle whose
    // url-matches rows the compiler once called poolable and the authority
    // refused (#25) — so it is the one that proves the shipped path survives
    // real data rather than fixtures built to pass.
    const bundle = JSON.parse(await readFile(LIVE_BUNDLE, "utf8")) as {
      site_key: string;
      task_key: string;
      rows: { step_index: number }[];
    };
    const dir = freshDir();
    const summary = ingestBundle(asIngestable(bundle), {
      store: new JsonlCacheStore({ dir }),
    });

    expect(summary.steps).toBe(12);

    const resolution = resolveProgram(new JsonlCacheStore({ dir }), {
      site_key: bundle.site_key,
      task_key: bundle.task_key,
    });
    expect(resolution.status).toBe("hit");
    if (resolution.status !== "hit") return;
    expect(resolution.rows).toHaveLength(12);

    // The point of the exercise, stated as a number: before #166 this
    // denominator could not be non-empty without a human hand-writing JSONL.
    expect(summary.pool_eligible + summary.tenant_only.length).toBe(12);
  });
});
