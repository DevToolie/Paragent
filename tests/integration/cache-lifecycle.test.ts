/**
 * Cache lifecycle end to end (#64): a real browser, a real replay, and a real
 * `JsonlCacheStore` on disk.
 *
 * The unit tests drive `applyOutcome` directly. This drives the whole seam the
 * product actually uses — `ReplayRunner` → `onStepOutcome` → `writeCacheRow` →
 * append-only JSONL — because the interesting failures live in the wiring, not
 * in the arithmetic: a sink that is never called, a row keyed differently by the
 * runner than by the store, a write that never reaches the file.
 *
 * Loopback fixture only: no Docker, no network, no model.
 */

import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { type Browser } from "playwright";
import { launchTestBrowser } from "../helpers/browser.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { JsonlCacheStore, POOL_FILE } from "../../src/cache/store.js";
import { createCacheUpdateSink } from "../../src/cache/update.js";
import { isInvalidated } from "../../src/cache/confidence.js";
import type { CacheRow } from "../../src/cache/types.js";
import { ReplayRunner } from "../../src/runner/replay.js";
import type { CompiledProgram } from "../../src/runner/types.js";

const SITE = "local-demo";
const TASK = "cache-lifecycle";
const PAGE = `<!doctype html><html><head><title>Local demo</title></head><body>
  <main><h1>Local demo</h1>
    <button type="button" data-testid="submit-button">Save</button>
  </main></body></html>`;

function programWith(testid: string): CompiledProgram {
  return {
    schema_version: "1.0.0",
    program_id: "prog-cache-lifecycle",
    site_key: SITE,
    task_key: TASK,
    testbed_version: "fixture-v1",
    steps: [
      {
        step_index: 0,
        row_id: "cache-row-0",
        compiled_action: {
          type: "click",
          locator_fallback_chain: [
            { strategy: "testid", testid, tenant_scoped: false },
          ],
        },
        assertion: {
          schema_version: "1.0.0",
          assertion_id: "assert-0",
          type: "element-visible",
          strength: "strong",
          target: { locator: { strategy: "testid", testid: "submit-button" } },
          expected: { visible: true },
          timeout_ms: 2000,
          failure_classification: "assertion_failed",
        },
      },
    ],
  };
}

function seedRow(): CacheRow {
  const step = programWith("submit-button").steps[0]!;
  return {
    schema_version: "1.0.0",
    row_id: step.row_id!,
    site_key: SITE,
    task_key: TASK,
    step_index: 0,
    compiled_action: step.compiled_action,
    assertion: step.assertion,
    confidence: 0,
    success_count: 0,
    failure_count: 0,
    last_verified_at: "2026-08-01T00:00:00.000Z",
    pool_eligible: true,
    pool_ineligible_reason: null,
  } as unknown as CacheRow;
}

describe("cache lifecycle: replay -> confidence -> invalidation (#64)", () => {
  let browser: Browser;
  let server: Server;
  let baseUrl: string;
  let dir: string;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(PAGE);
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    browser = await launchTestBrowser();
    dir = mkdtempSync(path.join(tmpdir(), "paragent-lifecycle-"));
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((r) => server?.close(() => r()));
    rmSync(dir, { recursive: true, force: true });
  });

  /** One real replay against the fixture page, recording into `store`. */
  async function replay(
    store: JsonlCacheStore,
    testid: string,
    now: string,
  ): Promise<void> {
    const page = await browser.newPage();
    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      const runner = new ReplayRunner({
        page,
        onStepOutcome: createCacheUpdateSink({ store, now: () => now }),
      });
      await runner.run(programWith(testid), {});
    } finally {
      await page.close();
    }
  }

  it(
    "counts successes, then invalidates when a locator breaks",
    async () => {
      const store = new JsonlCacheStore({ dir });
      store.write(seedRow());
      const key = { site_key: SITE, task_key: TASK, step_index: 0 };

      // --- two clean replays ------------------------------------------------
      await replay(store, "submit-button", "2026-08-03T10:00:00.000Z");
      await replay(store, "submit-button", "2026-08-03T11:00:00.000Z");

      let row = store.get(key)!;
      expect(row.success_count).toBe(2);
      expect(row.failure_count).toBe(0);
      expect(row.last_verified_at).toBe("2026-08-03T11:00:00.000Z");
      expect(row.confidence).toBe(1);
      expect(isInvalidated(row)).toBe(false);

      // --- break the locator ------------------------------------------------
      // Not a fabricated outcome: this testid is genuinely absent from the
      // page, so the runner produces a real failure.
      await replay(store, "no-such-control", "2026-08-03T12:00:00.000Z");
      row = store.get(key)!;
      expect(row.failure_count).toBe(1);
      expect(row.confidence).toBeCloseTo(0.7, 6);
      // One failure is not yet staleness — that is the decay doing its job.
      expect(isInvalidated(row)).toBe(false);
      // A failure must not refresh last_verified_at.
      expect(row.last_verified_at).toBe("2026-08-03T11:00:00.000Z");

      await replay(store, "no-such-control", "2026-08-03T13:00:00.000Z");
      row = store.get(key)!;
      expect(row.failure_count).toBe(2);
      expect(row.confidence).toBeCloseTo(0.49, 6);
      expect(isInvalidated(row)).toBe(true);
      expect(row.invalidated_at).toBe("2026-08-03T13:00:00.000Z");

      // --- the history survived --------------------------------------------
      // Append-only: every version is still on disk, which is the record of
      // what churn did.
      const lines = readFileSync(path.join(dir, POOL_FILE), "utf8")
        .trim()
        .split("\n")
        .filter(Boolean);
      expect(lines).toHaveLength(5); // seed + four replays
      const confidences = lines.map((l) => (JSON.parse(l) as CacheRow).confidence);
      expect(confidences[0]).toBe(0); // seeded, unobserved
      expect(confidences.at(-1)).toBeCloseTo(0.49, 6);
    },
    120_000,
  );

  it(
    "a recovery replay lifts it back above the threshold",
    async () => {
      const store = new JsonlCacheStore({ dir: mkdtempSync(path.join(tmpdir(), "paragent-rec-")) });
      store.write(seedRow());
      const key = { site_key: SITE, task_key: TASK, step_index: 0 };

      await replay(store, "submit-button", "2026-08-03T10:00:00.000Z");
      await replay(store, "no-such-control", "2026-08-03T11:00:00.000Z");
      await replay(store, "no-such-control", "2026-08-03T12:00:00.000Z");
      expect(isInvalidated(store.get(key)!)).toBe(true);

      await replay(store, "submit-button", "2026-08-03T13:00:00.000Z");
      const row = store.get(key)!;
      expect(isInvalidated(row)).toBe(false);
      expect(row.invalidated_at).toBeNull();
      expect(row.last_verified_at).toBe("2026-08-03T13:00:00.000Z");
    },
    120_000,
  );
});
