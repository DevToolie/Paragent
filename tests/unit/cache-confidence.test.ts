/**
 * Confidence, self-invalidation and the repair rewrite (#64 / PRD §5.3).
 *
 * The arithmetic is the easy part. What these pin is the behaviour the numbers
 * were *chosen* for, so that changing `CONFIDENCE_ALPHA` or
 * `INVALIDATION_THRESHOLD` fails loudly rather than silently redefining what
 * "stale" means — and the two rules that matter more than the numbers:
 * confidence never gates a measurement, and every update goes through the
 * privacy gatekeeper.
 */

import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_ALPHA,
  INVALIDATION_THRESHOLD,
  applyOutcome,
  classifyOutcome,
  isInvalidated,
  isVerified,
  nextConfidence,
} from "../../src/cache/confidence.js";
import { MemoryCacheStore } from "../../src/cache/store.js";
import { recordStepOutcome } from "../../src/cache/update.js";
import type { CacheRow } from "../../src/cache/types.js";

const NOW = "2026-08-03T12:00:00.000Z";
const EARLIER = "2026-08-01T00:00:00.000Z";
const LATER = "2026-08-05T09:00:00.000Z";

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
        { strategy: "testid", testid: "submit-button", tenant_scoped: false },
      ],
    },
    assertion: {
      schema_version: "1.0.0",
      assertion_id: "assert-0",
      type: "element-visible",
      strength: "strong",
      target: { locator: { strategy: "testid", testid: "page-header" } },
      expected: { visible: true },
      timeout_ms: 5000,
      failure_classification: "assertion_failed",
    },
    confidence: 0,
    success_count: 0,
    failure_count: 0,
    last_verified_at: EARLIER,
    pool_eligible: true,
    pool_ineligible_reason: null,
    ...overrides,
  } as CacheRow;
}

/** Replay a sequence of outcomes against a fresh row. */
function sequence(outcomes: Array<"pass" | "failure">): CacheRow {
  let current = row();
  for (const kind of outcomes) {
    current = { ...current, ...applyOutcome(current, kind, { now: NOW }) } as CacheRow;
  }
  return current;
}

describe("confidence model — the properties the defaults were chosen for", () => {
  it("scores a first success as verified-once, not low-confidence", () => {
    // The compiler writes confidence: 0 on every fresh row. Decaying from it
    // would score a first success 0.3 and read as stale, when what it is is
    // one observation that succeeded.
    expect(sequence(["pass"]).confidence).toBe(1);
    expect(isInvalidated(sequence(["pass"]))).toBe(false);
  });

  it("invalidates a fully-confident row after two consecutive failures", () => {
    expect(sequence(["pass", "failure"]).confidence).toBeCloseTo(0.7, 6);
    const twice = sequence(["pass", "failure", "failure"]);
    expect(twice.confidence).toBeCloseTo(0.49, 6);
    expect(twice.confidence).toBeLessThan(INVALIDATION_THRESHOLD);
    expect(isInvalidated(twice)).toBe(true);
  });

  it("recovers above the threshold on the next success", () => {
    const recovered = sequence(["pass", "failure", "failure", "pass"]);
    expect(recovered.confidence).toBeGreaterThan(INVALIDATION_THRESHOLD);
    expect(isInvalidated(recovered)).toBe(false);
  });

  it("invalidates on a first-ever failure — §5.3 calls a failed assertion stale", () => {
    const failed = sequence(["failure"]);
    expect(failed.confidence).toBe(0);
    expect(isInvalidated(failed)).toBe(true);
  });

  it("calls §5.3's own example stale: passed 100×, failed 3× today", () => {
    // The whole reason the weighting is exponential. A plain success rate would
    // score this 100/103 = 0.97 and call it healthy.
    const stale = sequence([
      ...Array<"pass">(100).fill("pass"),
      "failure",
      "failure",
      "failure",
    ]);
    expect(stale.success_count).toBe(100);
    expect(stale.failure_count).toBe(3);
    expect(stale.confidence).toBeCloseTo(0.343, 6);
    expect(isInvalidated(stale)).toBe(true);
  });

  it("never invalidates an unobserved row, however low its confidence reads", () => {
    // Every fresh row is confidence: 0. Treating that as staleness would mark
    // the whole cache invalid the moment it was compiled.
    const fresh = row();
    expect(fresh.confidence).toBe(0);
    expect(isVerified(fresh)).toBe(false);
    expect(isInvalidated(fresh)).toBe(false);
  });

  it("only a success refreshes last_verified_at", () => {
    const failed = applyOutcome(row({ confidence: 1, success_count: 1 }), "failure", {
      now: NOW,
    });
    // A failure is an observation, but not evidence the entry still fits.
    expect(failed.last_verified_at).toBe(EARLIER);
    expect(applyOutcome(row(), "pass", { now: NOW }).last_verified_at).toBe(NOW);
  });

  it("keeps the original invalidation timestamp across further failures", () => {
    const first = sequence(["pass", "failure", "failure"]);
    const later = applyOutcome(first, "failure", { now: "2026-08-04T00:00:00.000Z" });
    // When it went stale is the fact worth keeping, not when it was last seen
    // to still be stale.
    expect(later.invalidated_at).toBe(first.invalidated_at);
  });

  it("pins the chosen defaults, so changing them is a deliberate act", () => {
    expect(CONFIDENCE_ALPHA).toBe(0.3);
    expect(INVALIDATION_THRESHOLD).toBe(0.5);
  });

  it("seeds directly on the first observation only", () => {
    expect(nextConfidence(0, 0, true)).toBe(1);
    expect(nextConfidence(0, 0, false)).toBe(0);
    expect(nextConfidence(1, 1, false)).toBeCloseTo(0.7, 6);
  });
});

describe("classifyOutcome", () => {
  it("treats REPAIR_EXHAUSTED as a failure", () => {
    // The step did not do what the entry says it does.
    expect(classifyOutcome("REPAIR_EXHAUSTED")).toBe("failure");
  });

  it("treats REPAIRED_PASS as a rewrite, not a confirmation", () => {
    // The recorded action was wrong and a different one worked. Scoring that as
    // a plain pass would raise confidence in an action that just failed.
    expect(classifyOutcome("REPAIRED_PASS")).toBe("repaired");
    expect(classifyOutcome("PASS")).toBe("pass");
  });

  it("leaves a row untouched on an outcome it does not understand", () => {
    expect(classifyOutcome("SOMETHING_NEW")).toBeNull();
  });
});

describe("repair rewrite", () => {
  const corrected = {
    type: "click" as const,
    locator_fallback_chain: [
      { strategy: "testid" as const, testid: "modal-close", tenant_scoped: false },
    ],
  };

  it("persists the corrected action and does not inherit the old track record", () => {
    const stale = sequence(["pass", "failure", "failure"]);
    const rewritten = applyOutcome(stale, "repaired", {
      now: NOW,
      repair: { run_id: "run-1", repair_attempt: 2, corrected_action: corrected },
    });

    expect(rewritten.compiled_action).toEqual(corrected);
    // A new action starts as verified-once. Carrying 100 prior successes over
    // would credit it with a record belonging to the action it replaced.
    expect(rewritten.confidence).toBe(1);
    expect(rewritten.success_count).toBe(1);
    expect(rewritten.failure_count).toBe(0);
    expect(rewritten.invalidated_at).toBeNull();
  });

  it("records provenance linking the new version to the repair", () => {
    const rewritten = applyOutcome(row(), "repaired", {
      now: NOW,
      repair: { run_id: "run-1", repair_attempt: 2, corrected_action: corrected },
    });
    expect(rewritten.repair_provenance).toEqual({
      repaired_at: NOW,
      run_id: "run-1",
      repair_attempt: 2,
      replaced_action_type: "click",
    });
  });

  // #114: the schema, ADR-0009 and src/cache/types.ts all say the field is
  // present *only* on a row written by a repair rewrite. Nothing enforced it,
  // so a row that was ever repaired carried that repair's provenance forward on
  // every later version — with a `repaired_at` that no longer matched the
  // version's own `last_verified_at`.
  const repairedOnce = () =>
    applyOutcome(row(), "repaired", {
      now: NOW,
      repair: { run_id: "run-1", repair_attempt: 1, corrected_action: corrected },
    }) as CacheRow;

  it("clears provenance on a later plain pass", () => {
    const next = applyOutcome(repairedOnce(), "pass", { now: LATER });
    expect(next.repair_provenance).toBeUndefined();
    expect(next.last_verified_at).toBe(LATER);
  });

  it("clears provenance on a later failure", () => {
    const next = applyOutcome(repairedOnce(), "failure", { now: LATER });
    expect(next.repair_provenance).toBeUndefined();
  });

  it("does not inherit a previous repair's provenance when repair details are absent", () => {
    // A `repaired` outcome with nothing to record must carry no provenance
    // rather than the last repair's — the field names the write that produced
    // *this* version.
    const next = applyOutcome(repairedOnce(), "repaired", { now: LATER });
    expect(next.repair_provenance).toBeUndefined();
  });

  it("re-stamps provenance for each repair, rather than keeping the first", () => {
    const second = applyOutcome(repairedOnce(), "repaired", {
      now: LATER,
      repair: { run_id: "run-2", repair_attempt: 1, corrected_action: corrected },
    });
    expect(second.repair_provenance).toEqual({
      repaired_at: LATER,
      run_id: "run-2",
      repair_attempt: 1,
      replaced_action_type: "click",
    });
  });
});

describe("recordStepOutcome — the write path", () => {
  it("writes the next version through the store", () => {
    const store = new MemoryCacheStore();
    store.write(row());
    const result = recordStepOutcome(
      {
        site_key: row().site_key,
        task_key: row().task_key,
        step_index: 0,
        outcome: "PASS",
      },
      { store, now: () => NOW },
    );
    expect(result.row?.confidence).toBe(1);
    expect(store.get({ site_key: row().site_key, task_key: row().task_key, step_index: 0 })?.success_count).toBe(1);
  });

  it("keeps every superseded version — invalidated rows are never deleted", () => {
    const store = new MemoryCacheStore();
    store.write(row());
    const key = {
      site_key: row().site_key,
      task_key: row().task_key,
      step_index: 0,
    };
    for (const outcome of ["PASS", "ASSERTION_FAILED", "TIMEOUT"]) {
      recordStepOutcome({ ...key, step_index: 0, outcome }, { store, now: () => NOW });
    }
    // Deleting would destroy the record of what churn did, which is the
    // entire experiment.
    expect(store.allWrites().length).toBe(4); // initial + three updates
    expect(isInvalidated(store.get(key)!)).toBe(true);
  });

  it("does not persist a stale repair_provenance on the version after a repair (#114)", () => {
    // The end-to-end shape of the bug: repair a step, then pass it. The stored
    // row is the audit trail, and a version labelled with a repair that did not
    // write it is a corrupted one.
    const store = new MemoryCacheStore();
    store.write(row());
    const key = { site_key: row().site_key, task_key: row().task_key, step_index: 0 };

    const repaired = recordStepOutcome(
      {
        ...key,
        outcome: "REPAIRED_PASS",
        repair: {
          run_id: "run-1",
          repair_attempt: 1,
          corrected_action: {
            type: "click",
            locator_fallback_chain: [
              { strategy: "testid", testid: "modal-close", tenant_scoped: false },
            ],
          },
        },
      },
      { store, now: () => NOW },
    );
    expect(repaired.row?.repair_provenance?.run_id).toBe("run-1");

    const passed = recordStepOutcome({ ...key, outcome: "PASS" }, { store, now: () => LATER });
    expect(passed.row?.repair_provenance).toBeUndefined();
    expect(store.get(key)?.repair_provenance).toBeUndefined();
    // …and the earlier version keeps its provenance: the history is intact.
    expect(store.allWrites().at(-2)?.repair_provenance?.run_id).toBe("run-1");
  });

  it("names the assertion, not the locators, when the assertion is what emptied the chain", () => {
    // #114 (minor): the refusal text hardcoded "every corrected locator was
    // tenant-tainted". A repair proposing clean locators against a step whose
    // frozen assertion carries a tenant literal hits the same empty chain, and
    // no locator was involved.
    const store = new MemoryCacheStore();
    store.write(
      row({
        assertion: {
          ...row().assertion,
          type: "text-equals",
          expected: { template: "Acme Corporation Quarterly Revenue" },
        },
        pool_eligible: false,
        pool_ineligible_reason: "literal_in_assertion",
      } as Partial<CacheRow>),
    );

    let thrown: unknown;
    try {
      recordStepOutcome(
        {
          site_key: row().site_key,
          task_key: row().task_key,
          step_index: 0,
          outcome: "REPAIRED_PASS",
          repair: {
            run_id: "run-1",
            repair_attempt: 1,
            corrected_action: {
              type: "click",
              locator_fallback_chain: [
                { strategy: "testid", testid: "modal-close", tenant_scoped: false },
              ],
            },
          },
        },
        { store, now: () => NOW },
      );
    } catch (err) {
      thrown = err;
    }

    const message = (thrown as Error).message;
    expect(message).toContain("assertion carries a tenant literal");
    expect(message).not.toContain("every corrected locator was tenant-tainted");
    // The machine-readable reason was already right and stays right.
    expect((thrown as { reason: string }).reason).toBe("literal_in_assertion");
  });

  it("is a no-op, not an error, when the cache has no such row", () => {
    // Normal during Track 1: the gate matrix replays a bundle with no cache
    // behind it.
    const store = new MemoryCacheStore();
    const result = recordStepOutcome(
      { site_key: "s", task_key: "t", step_index: 0, outcome: "PASS" },
      { store, now: () => NOW },
    );
    expect(result.skipped).toBe("no-such-row");
    expect(result.row).toBeUndefined();
    expect(store.list()).toEqual([]);
  });
});
