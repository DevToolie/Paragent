/**
 * Cache store (#63) — the read side and the append-only JSONL store.
 *
 * The contract block runs **both** implementations through identical
 * assertions. A memory store whose behaviour quietly diverges from the real one
 * is worse than no fixture: every later test that uses it would be proving
 * something about a thing that does not ship.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  JsonlCacheStore,
  MemoryCacheStore,
  POOL_FILE,
  TENANT_FILE,
  cacheKeyOf,
  cacheKeyString,
  type CacheStore,
} from "../../src/cache/store.js";
import type { CacheRow } from "../../src/cache/types.js";

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "paragent-cache-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function row(overrides: Partial<CacheRow> = {}): CacheRow {
  return {
    schema_version: "1.0.0",
    row_id: "cache-row-0",
    site_key: "grafana-oss@127.0.0.1:3000",
    task_key: "create-stat-dashboard",
    step_index: 0,
    compiled_action: {
      type: "click",
      locator_fallback_chain: [
        { strategy: "testid", testid: "save", tenant_scoped: false },
      ],
    },
    assertion: {
      schema_version: "1.0.0",
      assertion_id: "assert-0",
      type: "element-visible",
      strength: "strong",
      target: { locator: { strategy: "testid", testid: "done" } },
      expected: { visible: true },
      timeout_ms: 5000,
      failure_classification: "assertion_failed",
    },
    confidence: 0,
    success_count: 0,
    failure_count: 0,
    last_verified_at: "2026-07-29T00:00:00.000Z",
    pool_eligible: true,
    pool_ineligible_reason: null,
    ...overrides,
  } as CacheRow;
}

describe("cacheKeyString", () => {
  it("cannot collide across a key boundary", () => {
    // Joining on ":" would make these the same string, silently merging two
    // different entries into one.
    const a = cacheKeyString({ site_key: "a:b", task_key: "c", step_index: 0 });
    const b = cacheKeyString({ site_key: "a", task_key: "b:c", step_index: 0 });
    expect(a).not.toBe(b);
  });

  it("derives the key from a row", () => {
    expect(cacheKeyOf(row({ step_index: 4 }))).toEqual({
      site_key: "grafana-oss@127.0.0.1:3000",
      task_key: "create-stat-dashboard",
      step_index: 4,
    });
  });
});

// --- contract both stores must satisfy -------------------------------------

/**
 * `reopen` is what makes the ordering contract meaningful (#121).
 *
 * The bug it pins only appears across a process boundary, so the contract needs
 * a way to say "same store, loaded again" without knowing which implementation
 * it is holding. For `JsonlCacheStore` that is a fresh instance over the same
 * directory; for `MemoryCacheStore` there is no boundary to cross, and identity
 * is the honest answer rather than a simulated one.
 */
const implementations: Array<[string, () => CacheStore, (s: CacheStore) => CacheStore]> = [
  ["MemoryCacheStore", () => new MemoryCacheStore(), (s) => s],
  [
    "JsonlCacheStore",
    () => new JsonlCacheStore({ dir: tempDir() }),
    (s) => new JsonlCacheStore({ dir: path.dirname((s as JsonlCacheStore).poolPath) }),
  ],
];

describe.each(implementations)("CacheStore contract: %s", (_name, make, reopen) => {
  it("round-trips a written row", () => {
    const store = make();
    const r = row();
    store.write(r);
    expect(store.get(cacheKeyOf(r))).toEqual(r);
  });

  it("returns undefined for a key that was never written", () => {
    const store = make();
    expect(store.get({ site_key: "nope", task_key: "nope", step_index: 0 })).toBeUndefined();
  });

  it("last write wins for the same key", () => {
    const store = make();
    store.write(row({ success_count: 1 }));
    store.write(row({ success_count: 2 }));
    store.write(row({ success_count: 3 }));
    expect(store.get(cacheKeyOf(row()))?.success_count).toBe(3);
    // One key, one current entry — repeated writes must not multiply rows.
    expect(store.list()).toHaveLength(1);
  });

  it("keys on all three parts, not just row_id", () => {
    const store = make();
    // Same row_id, different step: two entries, not one overwriting the other.
    store.write(row({ step_index: 0 }));
    store.write(row({ step_index: 1 }));
    store.write(row({ task_key: "other-task" }));
    store.write(row({ site_key: "other-site" }));
    expect(store.list()).toHaveLength(4);
  });

  it("filters by site_key and task_key", () => {
    const store = make();
    store.write(row({ step_index: 0 }));
    store.write(row({ step_index: 1 }));
    store.write(row({ task_key: "other-task", step_index: 0 }));

    expect(store.list({ task_key: "create-stat-dashboard" })).toHaveLength(2);
    expect(store.list({ site_key: "grafana-oss@127.0.0.1:3000" })).toHaveLength(3);
    expect(store.list({ site_key: "absent" })).toEqual([]);
  });

  // --- #121: read order is a store guarantee, not a caller's job -----------

  it("lists a task in step order regardless of write order", () => {
    const store = make();
    for (const i of [3, 0, 4, 1, 2]) store.write(row({ step_index: i }));
    expect(store.list().map((r) => r.step_index)).toEqual([0, 1, 2, 3, 4]);
  });

  it("keeps step order after a reload, whatever the rows' pool eligibility", () => {
    // The real shape: one task, mixed eligibility. JsonlCacheStore loads the
    // pool file to exhaustion before the tenant file, so without a sort this
    // reads back [0, 2, 4, 1, 3] — every pool row hoisted to the front.
    const store = make();
    for (const i of [0, 1, 2, 3, 4]) {
      store.write(
        i % 2 === 0
          ? row({ step_index: i, pool_eligible: true, pool_ineligible_reason: null })
          : row({
              step_index: i,
              pool_eligible: false,
              pool_ineligible_reason: "tenant_locator_text",
            }),
      );
    }
    expect(store.list().map((r) => r.step_index)).toEqual([0, 1, 2, 3, 4]);
    expect(reopen(store).list().map((r) => r.step_index)).toEqual([0, 1, 2, 3, 4]);
  });

  it("orders across tasks deterministically, and keeps each task contiguous", () => {
    const store = make();
    store.write(row({ task_key: "b-task", step_index: 1 }));
    store.write(row({ task_key: "a-task", step_index: 1, pool_eligible: false, pool_ineligible_reason: "tenant_locator_text" }));
    store.write(row({ task_key: "b-task", step_index: 0, pool_eligible: false, pool_ineligible_reason: "tenant_locator_text" }));
    store.write(row({ task_key: "a-task", step_index: 0 }));

    const seen = reopen(store).list().map((r) => `${r.task_key}#${r.step_index}`);
    expect(seen).toEqual(["a-task#0", "a-task#1", "b-task#0", "b-task#1"]);
  });

  it("does not hand out a reference a caller can mutate", () => {
    // The cache is updated through writeCacheRow(), not by reaching into the
    // store and editing what get() returned.
    const store = make();
    store.write(row({ success_count: 1 }));
    const fetched = store.get(cacheKeyOf(row()))!;
    fetched.success_count = 999;
    expect(store.get(cacheKeyOf(row()))?.success_count).toBe(1);
  });
});

// --- JSONL-specific behaviour ----------------------------------------------

describe("JsonlCacheStore", () => {
  it("routes on pool_eligible: the two files never mix", () => {
    const dir = tempDir();
    const store = new JsonlCacheStore({ dir });
    store.write(row({ pool_eligible: true }));
    store.write(
      row({
        step_index: 1,
        pool_eligible: false,
        pool_ineligible_reason: "tenant_locator_text",
      }),
    );

    const pool = readFileSync(path.join(dir, POOL_FILE), "utf8").trim().split("\n");
    const tenant = readFileSync(path.join(dir, TENANT_FILE), "utf8").trim().split("\n");
    expect(pool).toHaveLength(1);
    expect(tenant).toHaveLength(1);
    // The property that matters: nothing in the pool file is tenant-scoped.
    for (const line of pool) {
      expect((JSON.parse(line) as CacheRow).pool_eligible).toBe(true);
    }
    for (const line of tenant) {
      expect((JSON.parse(line) as CacheRow).pool_eligible).toBe(false);
    }
  });

  it("is append-only — a superseded row stays on disk", () => {
    // The file is the audit trail for the privacy boundary. If a tenant string
    // ever reached the pool file, a rewriting store would let the next correct
    // write erase the evidence.
    const dir = tempDir();
    const store = new JsonlCacheStore({ dir });
    store.write(row({ success_count: 1 }));
    store.write(row({ success_count: 2 }));

    const lines = readFileSync(path.join(dir, POOL_FILE), "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect((JSON.parse(lines[0]!) as CacheRow).success_count).toBe(1);
    expect((JSON.parse(lines[1]!) as CacheRow).success_count).toBe(2);
    // …while the read side still answers with the latest.
    expect(store.get(cacheKeyOf(row()))?.success_count).toBe(2);
  });

  it("survives a process exit — a new store reads what the old one wrote", () => {
    const dir = tempDir();
    new JsonlCacheStore({ dir }).write(row({ success_count: 7 }));

    // Fresh instance, same directory: the whole point of persisting.
    const reopened = new JsonlCacheStore({ dir });
    expect(reopened.get(cacheKeyOf(row()))?.success_count).toBe(7);
    expect(reopened.list()).toHaveLength(1);
  });

  it("replays append order when reloading, so last-write-wins survives a restart", () => {
    const dir = tempDir();
    const first = new JsonlCacheStore({ dir });
    first.write(row({ success_count: 1 }));
    first.write(row({ success_count: 2 }));

    expect(new JsonlCacheStore({ dir }).get(cacheKeyOf(row()))?.success_count).toBe(2);
  });

  it("tolerates a trailing newline and blank lines", () => {
    const dir = tempDir();
    const file = path.join(dir, POOL_FILE);
    new JsonlCacheStore({ dir }); // create the dir
    writeFileSync(file, `${JSON.stringify(row())}\n\n\n`, "utf8");
    expect(new JsonlCacheStore({ dir }).list()).toHaveLength(1);
  });

  it("starts empty rather than throwing when no files exist yet", () => {
    const store = new JsonlCacheStore({ dir: path.join(tempDir(), "not-created-yet") });
    expect(store.list()).toEqual([]);
    expect(store.readRaw("pool")).toBe("");
  });

  // --- #96: a corrupted line must not permanently block the store ----------
  //
  // The file is append-only and a bad line is never removed by anything, so
  // throwing here would mean every *future* construction against this
  // directory fails too — a one-time crash turning into a permanent outage.

  it("skips a truncated last line instead of throwing", () => {
    const dir = tempDir();
    const file = path.join(dir, POOL_FILE);
    new JsonlCacheStore({ dir }); // create the dir
    const good = JSON.stringify(row({ step_index: 0 }));
    // The shape a process killed mid-append actually leaves: a complete line,
    // then a JSON object cut off partway through.
    const truncated = JSON.stringify(row({ step_index: 1 })).slice(0, 20);
    writeFileSync(file, `${good}\n${truncated}`, "utf8");

    expect(() => new JsonlCacheStore({ dir })).not.toThrow();
    const rows = new JsonlCacheStore({ dir }).list();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.step_index).toBe(0);
  });

  it("still loads every good line before and after a bad one", () => {
    const dir = tempDir();
    const file = path.join(dir, POOL_FILE);
    new JsonlCacheStore({ dir });
    const lines = [
      JSON.stringify(row({ step_index: 0 })),
      "{not valid json",
      JSON.stringify(row({ step_index: 1 })),
    ];
    writeFileSync(file, `${lines.join("\n")}\n`, "utf8");

    const steps = new JsonlCacheStore({ dir })
      .list()
      .map((r) => r.step_index)
      .sort();
    expect(steps).toEqual([0, 1]);
  });

  it("reports the skipped line through the log sink, naming file and line number", () => {
    const dir = tempDir();
    const file = path.join(dir, POOL_FILE);
    new JsonlCacheStore({ dir });
    writeFileSync(file, `${JSON.stringify(row())}\ngarbage\n`, "utf8");

    const warn = vi.fn();
    new JsonlCacheStore({ dir, log: { warn } });

    expect(warn).toHaveBeenCalledTimes(1);
    const [message, meta] = warn.mock.calls[0]!;
    expect(message).toContain(file);
    expect(message).toContain(":2:"); // 1-indexed; "garbage" is line 2
    expect(meta).toMatchObject({ line: 2, preview: "garbage" });
  });

  it("falls back to console.warn — a missing log sink is not the same as nothing to report", () => {
    const dir = tempDir();
    const file = path.join(dir, POOL_FILE);
    new JsonlCacheStore({ dir });
    writeFileSync(file, "not json at all\n", "utf8");

    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      new JsonlCacheStore({ dir });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toContain("skipping unparseable cache line");
    } finally {
      spy.mockRestore();
    }
  });
});
