/**
 * Vocabulary canary — merge-blocking (issue #126).
 *
 * Two guarantees the pinned-version vocabulary rule (`src/cache/vocabulary.ts`)
 * must hold at once, or it is worse than not shipping it:
 *
 *  1. A real, source-cited product-vocabulary string now pools where the old
 *     `isChromeName`-only check would have refused it (proves the addition
 *     is load-bearing, not a no-op).
 *  2. A string that is BYTE-IDENTICAL to a vocabulary-snapshot entry is still
 *     refused when it is tagged `tenant_scoped: true` — the collision case
 *     the issue asked this rule to withstand. The rule keys off the
 *     locator's upstream attestation (`caller_marked_tenant`, evaluated
 *     independently of vocabulary content — see taint.ts), not off string
 *     equality alone, so a value matching the snapshot never bypasses an
 *     explicit tenant tag.
 *
 * @see docs/decisions/ADR-0017-pool-vocabulary-rule.md
 * @see docs/gate/pool-vocabulary.md
 */
import { describe, it, expect } from "vitest";
import {
  isChromeName,
  isPoolSafeAccessibleName,
} from "../../src/cache/allowlist.js";
import { checkLocatorTaint, createTaintChecker, taintRulesWithout } from "../../src/cache/taint.js";
import { buildPoolRow, buildTenantRow, writeCacheRow } from "../../src/cache/write.js";
import { isKnownVendorAccessibleName, VOCABULARY_SNAPSHOT } from "../../src/cache/vocabulary.js";
import type { CacheRowCandidate, CompiledLocator } from "../../src/cache/types.js";

const VOCAB_NAME = "toggle-viz-picker";

function baseAssertion() {
  return {
    assertion_id: "a",
    type: "element-visible",
    strength: "weak" as const,
    expected: { visible: true },
    timeout_ms: 1000,
    failure_classification: "assertion_failed",
  };
}

describe("pool vocabulary rule (#126)", () => {
  it("VOCAB_NAME is a real, sourced snapshot entry and NOT already generic chrome", () => {
    // If this string were already in UI_CHROME_NAMES, the test below would
    // prove nothing about the new rule.
    expect(isChromeName(VOCAB_NAME)).toBe(false);
    expect(isPoolSafeAccessibleName(VOCAB_NAME)).toBe(true);
    expect(isKnownVendorAccessibleName(VOCAB_NAME)).toBe(true);
    const entry = VOCABULARY_SNAPSHOT.find((e) => e.value === VOCAB_NAME);
    expect(entry).toBeDefined();
    expect(entry!.source.url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/grafana\/grafana\/v9\.5\.21\//);
  });

  it("pools a vendor-vocabulary accessible name that carries no upstream tenant claim", () => {
    // Shaped like a repair-model proposal (ADR-0009 / #64): the corrected
    // locator carries no `tenant_scoped` field at all — see
    // tests/canary/repair-rewrite.test.ts, which models repair candidates
    // the same way. This is the real code path where the rule has
    // observable effect: the one live compiled bundle's role_name/label
    // candidates are all pre-tagged `tenant_scoped: true` by the recorder
    // (docs/gate/compiler.md), which `caller_marked_tenant` refuses
    // regardless of vocabulary — see docs/gate/pool-vocabulary.md.
    const candidate: CacheRowCandidate = {
      schema_version: "1.0.0",
      row_id: "cache-vocab-canary-repair-shaped",
      site_key: "grafana-oss@127.0.0.1:3000",
      task_key: "vocab-canary",
      step_index: 0,
      compiled_action: {
        type: "click",
        locator_fallback_chain: [
          { strategy: "role_name", role: "button", name: VOCAB_NAME },
        ],
      },
      assertion: baseAssertion(),
      confidence: 0,
      success_count: 0,
      failure_count: 0,
      last_verified_at: "2026-08-12T00:00:00.000Z",
    };

    const pool = buildPoolRow(candidate);
    expect(pool.pool_eligible).toBe(true);
    expect(pool.pool_ineligible_reason).toBeNull();
    expect(
      pool.compiled_action.locator_fallback_chain.some((l) => l.name === VOCAB_NAME),
    ).toBe(true);

    // writeCacheRow must accept it too — it is the only writer, and this is
    // the path a real cache write goes through.
    const written = writeCacheRow(candidate);
    expect(written.pool_eligible).toBe(true);
  });

  it("still refuses the same vocabulary string when the locator is tagged tenant_scoped", () => {
    // The collision the issue asked for: a locator whose accessible name is
    // BYTE-IDENTICAL to a snapshot entry, but upstream marked it tenant
    // content anyway (e.g. a tenant's own custom field happens to be named
    // "Alias" too). Vocabulary content must never outrank an explicit
    // tenant claim.
    const collidingName = "Alias";
    expect(isPoolSafeAccessibleName(collidingName)).toBe(true); // it IS real vocabulary
    const collidingLocator: CompiledLocator = {
      strategy: "role_name",
      role: "textbox",
      name: collidingName,
      tenant_scoped: true,
    };

    // Proves *why* it is refused: the upstream-claim rule, not a vocabulary
    // miss (isPoolSafeAccessibleName is true for this exact string).
    const taint = checkLocatorTaint(collidingLocator);
    expect(taint.tainted).toBe(true);
    expect(taint.rulesFired).toContain("caller_marked_tenant");

    const candidate: CacheRowCandidate = {
      schema_version: "1.0.0",
      row_id: "cache-vocab-canary-collision",
      site_key: "grafana-oss@127.0.0.1:3000",
      task_key: "vocab-canary-collision",
      step_index: 0,
      compiled_action: {
        type: "click",
        locator_fallback_chain: [
          collidingLocator,
          { strategy: "structural", structural_path: "body > div > input" },
        ],
      },
      assertion: baseAssertion(),
      confidence: 0,
      success_count: 0,
      failure_count: 0,
      last_verified_at: "2026-08-12T00:00:00.000Z",
    };

    const pool = buildPoolRow(candidate);
    // The row still pools (the structural fallback is independently safe),
    // but the colliding locator must be absent from the pool copy: no
    // tenant-tagged locator, and specifically not this name, in the shared
    // row.
    expect(pool.pool_eligible).toBe(true);
    for (const loc of pool.compiled_action.locator_fallback_chain) {
      expect(loc.tenant_scoped).not.toBe(true);
      expect(loc.name).not.toBe(collidingName);
    }

    const written = writeCacheRow(candidate);
    for (const loc of written.compiled_action.locator_fallback_chain) {
      expect(loc.name).not.toBe(collidingName);
    }

    // The tenant twin keeps everything, including the colliding locator —
    // it is tenant-scoped by design, not lost.
    const tenant = buildTenantRow(candidate);
    expect(
      tenant.compiled_action.locator_fallback_chain.some(
        (l) => l.name === collidingName && l.tenant_scoped === true,
      ),
    ).toBe(true);
  });

  it("fails the collision guarantee when caller_marked_tenant is removed (mutation)", () => {
    // Mirrors tests/canary/mutation.test.ts: proves caller_marked_tenant is
    // the load-bearing rule for the collision guarantee above, not an
    // accident of rule ordering.
    const collidingLocator: CompiledLocator = {
      strategy: "role_name",
      role: "textbox",
      name: "Alias",
      tenant_scoped: true,
    };
    const mutated = createTaintChecker(taintRulesWithout("caller_marked_tenant"));
    const result = mutated(collidingLocator);
    // With the upstream-claim rule removed, vocabulary content alone now
    // (wrongly) rescues the tenant-tagged locator — demonstrating the rule
    // was doing real work above.
    expect(result.tainted).toBe(false);
  });
});
