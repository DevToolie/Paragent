/**
 * Privacy canary — merge-blocking.
 * @see docs/privacy/boundary-spec.md
 */
import { describe, it, expect } from "vitest";
import {
  allCanaryStrings,
  findCanariesIn,
  runCanaryPipeline,
  type CacheRow,
  type CompiledLocator,
} from "../../src/cache/index.js";

describe("privacy canary", () => {
  it("keeps all canary strings out of pool_eligible rows", () => {
    const { poolRows } = runCanaryPipeline();
    expect(poolRows.length).toBeGreaterThan(0);
    for (const row of poolRows) {
      expect(row.pool_eligible).toBe(true);
      expect(findCanariesIn(JSON.stringify(row)), `pool row ${row.row_id} leaked`).toEqual([]);
    }
  });

  it("keeps canaries out of logs and metrics output", () => {
    const { log, metrics } = runCanaryPipeline();
    for (const c of allCanaryStrings()) {
      expect(log.dump().includes(c), `log leaked ${c}`).toBe(false);
      expect(metrics.dump().includes(c), `metrics leaked ${c}`).toBe(false);
    }
  });

  it("still retains canaries on the tenant-scoped twin", () => {
    const { tenantRows } = runCanaryPipeline();
    expect(findCanariesIn(JSON.stringify(tenantRows)).length).toBeGreaterThan(0);
  });

  it("degrades to topology_only when every locator is tainted", () => {
    const { poolRows } = runCanaryPipeline();
    const topo = poolRows.find((r: CacheRow) => r.row_id === "cache-canary-step-topo");
    expect(topo).toBeDefined();
    expect(topo!.pool_eligible).toBe(true);
    expect(
      topo!.compiled_action.locator_fallback_chain.every(
        (l: CompiledLocator) => l.strategy === "topology_only",
      ),
    ).toBe(true);
    expect(findCanariesIn(JSON.stringify(topo))).toEqual([]);
  });
});
