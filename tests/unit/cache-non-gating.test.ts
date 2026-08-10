/**
 * The constraint #64 names as the one a later agent will "helpfully" break:
 *
 * > Confidence must never gate the gate measurement. In the matrix run, every
 * > compiled step is attempted regardless of confidence — otherwise a
 * > low-confidence row gets skipped and the step-validity denominator silently
 * > shrinks, inflating the headline number.
 *
 * The strong form of that claim is not "an invalidated step is still attempted".
 * It is that the cache cannot influence a run **at all**. So these run the same
 * program twice — once against a cache whose row is healthy, once against a
 * cache whose row is invalidated and at confidence 0 — and assert the two runs
 * are identical in every field that feeds a §9 aggregate.
 *
 * If someone later adds `if (row.confidence < THRESHOLD) continue;`, the
 * denominators diverge and this fails.
 */

import { describe, expect, it } from "vitest";
import { MemoryCacheStore } from "../../src/cache/store.js";
import { createCacheUpdateSink } from "../../src/cache/update.js";
import type { CacheRow } from "../../src/cache/types.js";
import { MetricsEmitter } from "../../src/metrics/emitter.js";
import { filterSteps } from "../../src/metrics/aggregate.js";
import { ReplayRunner } from "../../src/runner/replay.js";
import type { CompiledProgram } from "../../src/runner/types.js";

const SITE = "grafana-oss@127.0.0.1:3000";
const TASK = "create-stat-dashboard";

const program: CompiledProgram = {
  schema_version: "1.0.0",
  program_id: "prog-non-gating",
  site_key: SITE,
  task_key: TASK,
  testbed_version: "11.0.0",
  steps: [0, 1, 2].map((i) => ({
    step_index: i,
    row_id: `cache-row-${i}`,
    compiled_action: {
      type: "click",
      locator_fallback_chain: [
        { strategy: "testid", testid: "submit-button", tenant_scoped: false },
      ],
    },
    assertion: {
      schema_version: "1.0.0",
      assertion_id: `assert-${i}`,
      type: "element-visible",
      strength: "strong",
      target: { locator: { strategy: "testid", testid: "page-header" } },
      expected: { visible: true },
      timeout_ms: 5000,
      failure_classification: "assertion_failed",
    },
  })),
};

function cacheRow(stepIndex: number, overrides: Partial<CacheRow> = {}): CacheRow {
  const step = program.steps[stepIndex]!;
  return {
    schema_version: "1.0.0",
    row_id: step.row_id!,
    site_key: SITE,
    task_key: TASK,
    step_index: stepIndex,
    compiled_action: step.compiled_action,
    assertion: step.assertion,
    confidence: 1,
    success_count: 5,
    failure_count: 0,
    last_verified_at: "2026-08-01T00:00:00.000Z",
    pool_eligible: true,
    pool_ineligible_reason: null,
    ...overrides,
  } as unknown as CacheRow;
}

/** Seed a store, run the program against it, return what the gate would see. */
async function runWith(rows: CacheRow[]): Promise<{
  stepsTotal: number;
  stepsValid: number;
  denominator: number;
  outcomes: string[];
}> {
  const store = new MemoryCacheStore();
  for (const r of rows) store.write(r);

  const metrics = new MetricsEmitter();
  const runner = new ReplayRunner({
    dryRun: true,
    dryRunOutcomes: ["PASS", "PASS", "PASS"],
    metrics,
    onStepOutcome: createCacheUpdateSink({
      store,
      now: () => "2026-08-03T12:00:00.000Z",
    }),
  });

  const result = await runner.run(program, {}, "fixed-run-id");
  const steps = filterSteps(metrics.getRows());
  return {
    stepsTotal: result.steps_total,
    stepsValid: result.steps_replay_valid,
    // The §9 step-validity denominator.
    denominator: steps.length,
    outcomes: result.step_results.map((s) => s.outcome),
  };
}

describe("confidence never gates the measurement (#64)", () => {
  it("a healthy cache and an invalidated one produce identical runs", async () => {
    const healthy = await runWith([cacheRow(0), cacheRow(1), cacheRow(2)]);
    const invalidated = await runWith([
      cacheRow(0, {
        confidence: 0,
        success_count: 0,
        failure_count: 9,
        invalidated_at: "2026-08-02T00:00:00.000Z",
      }),
      cacheRow(1),
      cacheRow(2),
    ]);

    expect(invalidated).toEqual(healthy);
    // Named individually so a failure says which invariant broke.
    expect(invalidated.stepsTotal).toBe(3);
    expect(invalidated.denominator).toBe(3);
    expect(invalidated.outcomes).toEqual(["PASS", "PASS", "PASS"]);
  });

  it("an empty cache produces the same run as a fully populated one", async () => {
    // The Track-1 default: the gate matrix replays a bundle with no cache
    // behind it. That must not be a different measurement.
    expect(await runWith([])).toEqual(
      await runWith([cacheRow(0), cacheRow(1), cacheRow(2)]),
    );
  });

  it("still records the outcome against the invalidated row", async () => {
    // Non-gating must not become non-recording: the point of #64 is that the
    // observation *is* made, it just does not change the run.
    const store = new MemoryCacheStore();
    store.write(
      cacheRow(0, {
        confidence: 0,
        failure_count: 9,
        invalidated_at: "2026-08-02T00:00:00.000Z",
      }),
    );
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: ["PASS", "PASS", "PASS"],
      onStepOutcome: createCacheUpdateSink({
        store,
        now: () => "2026-08-03T12:00:00.000Z",
      }),
    });
    await runner.run(program, {}, "fixed-run-id");

    const updated = store.get({ site_key: SITE, task_key: TASK, step_index: 0 })!;
    expect(updated.success_count).toBe(6); // 5 prior + this one
    // One pass from confidence 0 with prior observations: 0.3 + 0.7*0 = 0.3,
    // still under the threshold, so it stays invalidated. Recovery takes more
    // than a single success once a row is deep in the hole — which is the
    // point of weighting recency rather than averaging.
    expect(updated.confidence).toBeCloseTo(0.3, 6);
    expect(updated.invalidated_at).toBe("2026-08-02T00:00:00.000Z");
  });

  it("a throwing sink cannot take down the run", async () => {
    // The run is the measurement; the cache is a recording of it. Losing the
    // recording is strictly better than losing the measurement.
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: ["PASS", "PASS", "PASS"],
      onStepOutcome: () => {
        throw new Error("sink exploded");
      },
    });
    const result = await runner.run(program, {}, "fixed-run-id");
    expect(result.task_success).toBe(true);
    expect(result.steps_replay_valid).toBe(3);
  });
});
