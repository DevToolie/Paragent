/**
 * CANARY STUB — intentionally failing until B5 lands the real cross-tenant leak test.
 *
 * This failure is correct. Track-1 code must not merge without the privacy canary.
 * B5 replaces this file with: seed synthetic tenant canaries → record → compile →
 * cache-write → assert zero canaries in pool_eligible rows / logs / metrics.
 *
 * @see docs/privacy/boundary-spec.md (B5)
 */
import { describe, it, expect } from "vitest";

describe("privacy canary (stub)", () => {
  it("blocks merge until B5 replaces this stub with the real canary", () => {
    expect.fail(
      "CANARY STUB RED: B5 must replace tests/canary/canary.test.ts with the real " +
        "cross-tenant leak test (synthetic canary strings → record → compile → " +
        "cache-write → assert zero leakage into pool_eligible rows). " +
        "See wave pack Agent B5. This red status is intentional.",
    );
  });
});
