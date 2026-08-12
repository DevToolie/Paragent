/**
 * The pool's **outbound** boundary (ADR-0014, #118).
 *
 * Every other canary in this repo guards what may **enter** the pool:
 * `writeCacheRow()`, the taint rules, the allowlist, `store-leak.test.ts`. That
 * is one claim — *nothing tenant-scoped got in*. Reading is a different claim:
 * *nothing tenant-scoped comes back out to the wrong tenant*. Until #118 there
 * was no read path, so the second claim was vacuously true and untested; the
 * moment a resolver exists it stops being either.
 *
 * The dangerous shape is specific. Pool and tenant rows for the same task live
 * side by side in one directory, and a program is assembled from whichever rows
 * a resolver can see. A resolver reading at pool scope that quietly fell back to
 * a tenant row would produce a program that *works* — and carries another
 * tenant's locator into this tenant's run. Nothing downstream would flag it,
 * because the row is valid and the replay passes.
 *
 * So the assertion is not "prefers pool rows". It is: at `pool_only` scope a
 * tenant-scoped row is **invisible**, and a program that needs one is a MISS —
 * asserted from disk, not from the in-memory row the writer happened to return.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { JsonlCacheStore, POOL_FILE, TENANT_FILE } from "../../src/cache/store.js";
import { writeCacheRowPair } from "../../src/cache/write.js";
import { resolveProgram } from "../../src/cache/resolve.js";
import type { CacheRow, CacheRowCandidate } from "../../src/cache/types.js";

const SITE = "grafana-oss@example";
const TASK = "pool-read-leak";

/** Assembled at runtime so this file is not itself a secret-scan hit. */
const TENANT_STRING = "CANARY-" + "TENANT-" + "4b17ea9c";

function candidate(step_index: number, tenantScoped: boolean): CacheRowCandidate {
  return {
    schema_version: "1.0.0",
    row_id: `row-${step_index}`,
    site_key: SITE,
    task_key: TASK,
    step_index,
    program: {
      program_id: "prog-pool-read",
      steps_total: 2,
      compiled_at: "2026-08-11T10:00:00.000Z",
    },
    compiled_action: {
      type: "click",
      locator_fallback_chain: tenantScoped
        ? // A free-text locator is page content by definition and is exactly
          // what the write boundary marks tenant-scoped.
          [{ strategy: "text", text: TENANT_STRING }]
        : [{ strategy: "role_name", role: "textbox", name: "Username" }],
    },
    assertion: {
      schema_version: "1.0.0",
      assertion_id: `assert-${step_index}`,
      type: "element-visible",
      strength: "strong",
      timeout_ms: 5000,
      failure_classification: "assertion_failed",
    },
    confidence: 1,
    success_count: 1,
    failure_count: 0,
    last_verified_at: "2026-08-11T10:00:00.000Z",
  } as unknown as CacheRowCandidate;
}

describe("a tenant row never resolves at pool scope (#118)", () => {
  let dir: string;
  let store: JsonlCacheStore;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "paragent-pool-read-"));
    store = new JsonlCacheStore({ dir });
    // Step 0 is pool-safe. Step 1 is not — so the *program* is only whole if a
    // tenant-scoped row is readable.
    writeCacheRowPair(candidate(0, false), { store });
    writeCacheRowPair(candidate(1, true), { store });
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("the fixture really did split across the two files", () => {
    // Guards the guard. If both rows had landed in the pool file, or the
    // tenant string had never been written, every assertion below would pass
    // while proving nothing.
    const pool = readFileSync(path.join(dir, POOL_FILE), "utf8");
    const tenant = readFileSync(path.join(dir, TENANT_FILE), "utf8");
    expect(tenant).toContain(TENANT_STRING);
    expect(pool).not.toContain(TENANT_STRING);
  });

  it("refuses the program at pool scope rather than serving a tenant row", () => {
    const result = resolveProgram(store, { site_key: SITE, task_key: TASK }, {
      scope: "pool_only",
    });
    expect(result.status).toBe("miss");
    if (result.status !== "miss") return;
    expect(result.detail).not.toContain(TENANT_STRING);
  });

  it("no tenant string appears anywhere in a pool-scope resolution", () => {
    // The blunt version: serialize whatever came back and look for the canary.
    // A partial leak through some field nobody thought about fails here.
    const result = resolveProgram(store, { site_key: SITE, task_key: TASK }, {
      scope: "pool_only",
    });
    expect(JSON.stringify(result)).not.toContain(TENANT_STRING);
  });

  it("holds after a reopen — the boundary is on disk, not in memory", () => {
    // The version of this bug that reaches production: an index built during
    // the writing process behaves one way, and a fresh process reading the
    // files behaves another.
    const reopened = new JsonlCacheStore({ dir });
    const result = resolveProgram(reopened, { site_key: SITE, task_key: TASK }, {
      scope: "pool_only",
    });
    expect(result.status).toBe("miss");
    expect(JSON.stringify(result)).not.toContain(TENANT_STRING);
  });

  it("same-tenant scope still resolves it — the refusal is scoped, not blanket", () => {
    // Counter-check. If `pool_only` were refusing everything, the assertions
    // above would pass for the wrong reason and the pool would be useless
    // rather than safe.
    const result = resolveProgram(store, { site_key: SITE, task_key: TASK });
    expect(result.status).toBe("hit");
    if (result.status !== "hit") return;
    expect(result.rows).toHaveLength(2);
  });

  it("a fully pool-safe program does resolve at pool scope", () => {
    // The other half of the counter-check: cross-tenant reuse has to actually
    // work, or `pool_only` is just an elaborate way of returning nothing.
    const safeDir = mkdtempSync(path.join(tmpdir(), "paragent-pool-safe-"));
    try {
      const safe = new JsonlCacheStore({ dir: safeDir });
      writeCacheRowPair(candidate(0, false), { store: safe });
      writeCacheRowPair(candidate(1, false), { store: safe });

      const result = resolveProgram(safe, { site_key: SITE, task_key: TASK }, {
        scope: "pool_only",
      });
      expect(result.status).toBe("hit");
      if (result.status !== "hit") return;
      expect(result.rows).toHaveLength(2);
      for (const row of result.rows as CacheRow[]) {
        expect(row.pool_eligible).toBe(true);
      }
    } finally {
      rmSync(safeDir, { recursive: true, force: true });
    }
  });
});
