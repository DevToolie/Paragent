import { describe, it, expect } from "vitest";
import {
  PACKAGE,
  writeCacheRow,
  buildPoolRow,
  checkLocatorTaint,
  CacheWriteRejectedError,
  ALLOWED_ARIA_ROLES,
  type CacheRowCandidate,
} from "../../src/cache/index.js";

function baseCandidate(overrides: Partial<CacheRowCandidate> = {}): CacheRowCandidate {
  return {
    schema_version: "1.0.0",
    row_id: "row-1",
    site_key: "site@test",
    task_key: "task",
    step_index: 0,
    compiled_action: {
      type: "click",
      locator_fallback_chain: [{ strategy: "role_name", role: "button", name: "Submit" }],
    },
    assertion: {
      assertion_id: "a1",
      type: "element-visible",
      strength: "strong",
      expected: { visible: true },
      timeout_ms: 1000,
      failure_classification: "assertion_failed",
    },
    confidence: 0,
    success_count: 0,
    failure_count: 0,
    last_verified_at: "2026-07-24T21:00:00.000Z",
    flow_topology: { landmark: "main" },
    ...overrides,
  };
}

describe("cache privacy write path", () => {
  it("exports the cache package id", () => {
    expect(PACKAGE).toBe("cache");
  });

  it("marks chrome role_name locators pool-safe", () => {
    expect(checkLocatorTaint({ strategy: "role_name", role: "textbox", name: "Username" }).tainted).toBe(false);
  });

  it("taints data-account-id CSS selectors", () => {
    const result = checkLocatorTaint({ strategy: "css_vocab", css: '[data-account-id="acct-1"]' });
    expect(result.tainted).toBe(true);
    expect(result.rulesFired).toContain("non_vocab_css_attr");
  });

  it("taints free-text strategy", () => {
    const result = checkLocatorTaint({ strategy: "text", text: "Acme Corp dashboard" });
    expect(result.tainted).toBe(true);
    expect(result.rulesFired).toContain("free_text_strategy");
  });

  it("taints non-vocabulary ARIA roles", () => {
    expect(ALLOWED_ARIA_ROLES.has("button")).toBe(true);
    const result = checkLocatorTaint({
      strategy: "role_name",
      role: "custom-tenant-widget",
      name: "Submit",
    });
    expect(result.tainted).toBe(true);
    expect(result.rulesFired).toContain("non_vocab_role");
  });

  it("writes pool_eligible=true for allowlisted locators", () => {
    const row = writeCacheRow(baseCandidate());
    expect(row.pool_eligible).toBe(true);
    expect(row.pool_ineligible_reason).toBeNull();
  });

  it("strips tainted locators from the pool view", () => {
    const row = buildPoolRow(
      baseCandidate({
        compiled_action: {
          type: "click",
          locator_fallback_chain: [
            { strategy: "text", text: "Secret Tenant Label" },
            { strategy: "role_name", role: "button", name: "Submit" },
          ],
        },
      }),
    );
    expect(row.pool_eligible).toBe(true);
    expect(row.compiled_action.locator_fallback_chain).toHaveLength(1);
    expect(row.compiled_action.locator_fallback_chain[0]?.strategy).toBe("role_name");
  });

  it("refuses caller pool_eligible=true when only tainted content remains and no topology", () => {
    const candidate = baseCandidate({
      pool_eligible: true,
      compiled_action: {
        type: "click",
        locator_fallback_chain: [{ strategy: "text", text: "Tenant Only" }],
      },
    });
    delete candidate.flow_topology;
    expect(() => writeCacheRow(candidate)).toThrow(CacheWriteRejectedError);
  });
});
