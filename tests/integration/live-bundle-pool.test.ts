/**
 * The compiled live gate task, pushed through the B5 write path.
 *
 * Issue #25 asks for two things this file pins:
 *
 *  1. **The compiler's `pool_eligible` is a pre-check, and B5 is authoritative.**
 *     A pre-check may be stricter than the authority; it may never be looser.
 *     `writeCacheRow` throws `CacheWriteRejectedError` when a caller claims
 *     `pool_eligible: true` and B5 disagrees, so "looser" is not a leak — it is
 *     a crash in the one path that has to work. Before this test the compiler
 *     called all five `url-matches` rows poolable and B5 refused every one.
 *  2. **Fail-closed holds on real data.** No pool row may carry a tenant-scoped
 *     locator, a free-text locator, or a tenant literal in its assertion.
 *
 * It runs against the committed bundle rather than a synthetic row on purpose:
 * the synthetic fixtures are what let both defects through in the first place.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { writeCacheRowPair } from "../../src/cache/write.js";
import { validateCompiledBundle } from "../../src/compiler/index.js";
import type { CacheRow, CacheRowCandidate } from "../../src/cache/types.js";

const BUNDLE = path.join(
  process.cwd(),
  "artifacts/compiled/traj-gate-live-create-stat-dashboard-from-testdata-9.5.21.bundle.json",
);

interface Bundle {
  rows: (CacheRow & { pool_eligible: boolean })[];
}

/** The row minus the fields the cache assigns itself. */
function toCandidate(row: Bundle["rows"][number]): CacheRowCandidate {
  const {
    schema_version: _schema,
    row_id: _id,
    confidence: _c,
    success_count: _s,
    failure_count: _f,
    last_verified_at: _v,
    ...candidate
  } = row;
  return candidate as CacheRowCandidate;
}

describe("live compiled bundle through the B5 write path", () => {
  it("never claims pool eligibility the cache would refuse", async () => {
    const bundle = JSON.parse(await readFile(BUNDLE, "utf8")) as Bundle;
    expect(bundle.rows).toHaveLength(12);

    for (const row of bundle.rows) {
      // Throws CacheWriteRejectedError on a claim B5 will not honour.
      const { pool } = writeCacheRowPair(toCandidate(row));
      if (row.pool_eligible) {
        expect(
          pool.pool_eligible,
          `row ${row.step_index}: compiler said poolable, B5 said ${pool.pool_ineligible_reason}`,
        ).toBe(true);
      }
    }
  });

  it("lets no tenant-scoped or free-text locator into a pool row", async () => {
    const bundle = JSON.parse(await readFile(BUNDLE, "utf8")) as Bundle;

    for (const row of bundle.rows) {
      const { pool, tenant } = writeCacheRowPair(toCandidate(row));
      if (pool.pool_eligible) {
        for (const loc of pool.compiled_action.locator_fallback_chain) {
          expect(loc.tenant_scoped).not.toBe(true);
          expect(["text", "placeholder"]).not.toContain(loc.strategy);
        }
      }
      // The tenant row keeps everything: the split is what makes the pool row
      // safe to share, and a tenant row that lost candidates would replay worse
      // than the trajectory it came from.
      expect(
        tenant.compiled_action.locator_fallback_chain.length,
      ).toBeGreaterThanOrEqual(
        row.compiled_action.locator_fallback_chain.length,
      );
    }
  });

  it("keeps the committed bundle schema-valid", async () => {
    // `npm run compile` validates on the way out, but nothing re-checks the
    // committed artifact afterwards — so a schema change would leave a stale
    // bundle in the tree looking fine.
    const bundle = JSON.parse(await readFile(BUNDLE, "utf8")) as Bundle;
    const result = await validateCompiledBundle(
      bundle as unknown as Parameters<typeof validateCompiledBundle>[0],
    );
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("records what real input actually produced", async () => {
    // Observations, not targets. They are pinned so that a change in synthesis
    // shows up as a failing test to be explained, rather than as a quiet drift
    // in the numbers docs/gate/compiler.md reports.
    const bundle = JSON.parse(await readFile(BUNDLE, "utf8")) as Bundle;
    const strong = bundle.rows.filter((r) => r.assertion.strength === "strong");
    const poolable = bundle.rows.filter((r) => r.pool_eligible);

    expect(strong).toHaveLength(6);
    expect(poolable).toHaveLength(1);
    expect(
      bundle.rows.every((r) => r.assertion.notes && r.assertion.notes.length > 0),
    ).toBe(true);
    // No row may fall through to an unwired `custom` assertion — the runner
    // fails those outright, so one would be a guaranteed replay failure.
    expect(bundle.rows.some((r) => r.assertion.type === "custom")).toBe(false);
  });
});
