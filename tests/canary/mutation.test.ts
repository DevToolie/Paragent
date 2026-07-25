/**
 * Mutation test: removing a load-bearing taint rule must make the canary fail.
 * @see docs/privacy/boundary-spec.md
 */
import { describe, it, expect } from "vitest";
import {
  CANARY_TENANT,
  buildPoolRow,
  findCanariesIn,
  runCanaryPipeline,
  taintRulesWithout,
  writeCacheRow,
  type CacheRowCandidate,
  type TaintRule,
} from "../../src/cache/index.js";

describe("privacy canary mutation", () => {
  it("fails the canary invariant when non_vocab_css_attr taint rule is removed", () => {
    for (const row of runCanaryPipeline().poolRows) {
      expect(findCanariesIn(JSON.stringify(row))).toEqual([]);
    }
    const mutatedRules: TaintRule[] = taintRulesWithout("non_vocab_css_attr");
    expect(mutatedRules.every((r: TaintRule) => r.id !== "non_vocab_css_attr")).toBe(true);

    const candidate: CacheRowCandidate = {
      schema_version: "1.0.0",
      row_id: "cache-mutation-css-leak",
      site_key: "canary-synthetic@test",
      task_key: "mutation-css",
      step_index: 0,
      compiled_action: {
        type: "click",
        locator_fallback_chain: [
          { strategy: "css_vocab", css: `[data-account-id="${CANARY_TENANT.accountId}"]` },
        ],
      },
      assertion: {
        schema_version: "1.0.0",
        assertion_id: "assert-visible",
        type: "element-visible",
        strength: "weak",
        expected: { visible: true },
        timeout_ms: 1000,
        failure_classification: "assertion_failed",
      },
      confidence: 0,
      success_count: 0,
      failure_count: 0,
      last_verified_at: "2026-07-24T21:00:00.000Z",
      flow_topology: { landmark: "main" },
    };

    const leaked = buildPoolRow(candidate, { taintRules: mutatedRules });
    expect(leaked.pool_eligible).toBe(true);
    expect(findCanariesIn(JSON.stringify(leaked))).toContain(CANARY_TENANT.accountId);
    expect(findCanariesIn(JSON.stringify(writeCacheRow(candidate)))).toEqual([]);
  });

  it("fails the canary invariant when aria_label_or_name_tenant rule is removed", () => {
    const mutatedRules = taintRulesWithout("aria_label_or_name_tenant");
    const candidate: CacheRowCandidate = {
      schema_version: "1.0.0",
      row_id: "cache-mutation-aria-leak",
      site_key: "canary-synthetic@test",
      task_key: "mutation-aria",
      step_index: 0,
      compiled_action: {
        type: "click",
        locator_fallback_chain: [
          { strategy: "role_name", role: "button", name: CANARY_TENANT.personName },
        ],
      },
      assertion: {
        assertion_id: "a",
        type: "element-visible",
        strength: "weak",
        expected: { visible: true },
        timeout_ms: 1000,
        failure_classification: "assertion_failed",
      },
      confidence: 0,
      success_count: 0,
      failure_count: 0,
      last_verified_at: "2026-07-24T21:00:00.000Z",
      flow_topology: { landmark: "main" },
    };
    const leaked = buildPoolRow(candidate, { taintRules: mutatedRules });
    expect(leaked.pool_eligible).toBe(true);
    expect(findCanariesIn(JSON.stringify(leaked))).toContain(CANARY_TENANT.personName);
    expect(findCanariesIn(JSON.stringify(writeCacheRow(candidate)))).toEqual([]);
  });
});
