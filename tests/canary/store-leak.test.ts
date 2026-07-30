/**
 * The check that matters for #63: canary strings on **disk**.
 *
 * `tests/canary/canary.test.ts` asserts on the rows the write path returns, in
 * memory. Until now that was the whole story, because `runCanaryPipeline`
 * wrote into a black hole. #63 introduces the first path where classified rows
 * reach a filesystem, and a filesystem is where a leak becomes permanent: the
 * store is append-only, so one bad line cannot be corrected by a later write,
 * and a committed cache file is a privacy incident rather than a bug.
 *
 * So this suite runs the canary pipeline against a real `JsonlCacheStore` in a
 * temp directory and then greps the bytes.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CANARY_TENANT,
  allCanaryStrings,
  findCanariesIn,
  runCanaryPipeline,
} from "../../src/cache/pipeline.js";
import {
  JsonlCacheStore,
  POOL_FILE,
  TENANT_FILE,
} from "../../src/cache/store.js";
import type { CacheRow } from "../../src/cache/types.js";

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "paragent-canary-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function runAgainstDisk(): { dir: string; store: JsonlCacheStore } {
  const dir = tempDir();
  const store = new JsonlCacheStore({ dir });
  runCanaryPipeline({ store });
  return { dir, store };
}

describe("canary: no tenant string reaches the pool file", () => {
  it("writes both files", () => {
    const { store } = runAgainstDisk();
    // If this ever reads empty the rest of the suite proves nothing — a leak
    // test over a file that was never written passes trivially.
    expect(store.readRaw("pool").length).toBeGreaterThan(0);
    expect(store.readRaw("tenant").length).toBeGreaterThan(0);
  });

  it("the pool file on disk contains NO canary string", () => {
    const { dir } = runAgainstDisk();
    const bytes = readFileSync(path.join(dir, POOL_FILE), "utf8");
    expect(findCanariesIn(bytes)).toEqual([]);
    // Named individually so a failure says which one escaped.
    for (const [label, value] of Object.entries(CANARY_TENANT)) {
      expect(bytes, `pool file leaked ${label}`).not.toContain(value);
    }
  });

  it("every line in the pool file is pool_eligible", () => {
    const { dir } = runAgainstDisk();
    const lines = readFileSync(path.join(dir, POOL_FILE), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const row = JSON.parse(line) as CacheRow;
      expect(row.pool_eligible).toBe(true);
      for (const loc of row.compiled_action.locator_fallback_chain) {
        expect(loc.tenant_scoped).not.toBe(true);
        expect(loc.strategy).not.toBe("text");
      }
    }
  });

  it("the tenant file DOES carry the tenant material — the split is real", () => {
    // The counter-check. If the tenant file were also clean, the pool file
    // being clean would prove nothing: it could mean the canary strings were
    // dropped everywhere, or that nothing was written at all.
    const { dir } = runAgainstDisk();
    const bytes = readFileSync(path.join(dir, TENANT_FILE), "utf8");
    const found = findCanariesIn(bytes);
    expect(found.length).toBeGreaterThan(0);
    expect(bytes).toContain(CANARY_TENANT.resourceName);
  });

  it("the two files are disjoint by classification", () => {
    const { dir } = runAgainstDisk();
    const read = (f: string): CacheRow[] =>
      readFileSync(path.join(dir, f), "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as CacheRow);

    expect(read(POOL_FILE).every((r) => r.pool_eligible)).toBe(true);
    expect(read(TENANT_FILE).every((r) => !r.pool_eligible)).toBe(true);
  });

  it("a reopened store still hands back no canary in pooled rows", () => {
    // Reload path: rows come back through JSON.parse rather than from the
    // in-memory write, so the classification has to survive a round trip.
    const { dir } = runAgainstDisk();
    for (const row of new JsonlCacheStore({ dir }).list()) {
      if (!row.pool_eligible) continue;
      expect(findCanariesIn(JSON.stringify(row))).toEqual([]);
    }
  });

  it("the canary set is non-empty, so these assertions can fail", () => {
    // Guards the guard: if allCanaryStrings() ever returned [], every
    // `findCanariesIn(...)` above would pass vacuously.
    expect(allCanaryStrings().length).toBeGreaterThan(0);
  });
});
