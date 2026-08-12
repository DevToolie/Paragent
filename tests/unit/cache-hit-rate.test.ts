/**
 * Cache hit-rate, the fifth §9 secondary metric (#67, ADR-0014).
 *
 * Hit-rate is the metric that makes the compilation thesis *visible*. §3 claims
 * amortized cost trends toward zero **because** an increasing share of steps
 * replay from cache instead of invoking the model. Amortized tokens show the
 * effect; hit-rate shows the mechanism — and if tokens fell for an unrelated
 * reason (a cheaper model, a shorter task) hit-rate stays flat and exposes it.
 *
 * Two things are pinned here, and the second is the one that would be got wrong:
 *
 * 1. The arithmetic, including `no_data` on an empty denominator.
 * 2. **What is in the denominator.** A hit is provenance *and* outcome. Steps
 *    from a file-loaded program have no provenance and belong in no denominator
 *    at all — counting them as misses would make the metric a function of how
 *    the operator invoked the runner rather than of the cache.
 */

import { describe, expect, it } from "vitest";

import { buildGateReport, cacheHitRate } from "../../src/metrics/aggregate.js";
import { METRICS_SCHEMA_VERSION } from "../../src/metrics/types.js";
import type { MetricRow, ProgramSource, StepMetric } from "../../src/metrics/types.js";
import { zeroCost } from "../../src/metrics/cost.js";

function step(
  run_id: string,
  step_index: number,
  replay_valid: boolean,
  program_source?: ProgramSource,
  recorded_at = "2026-08-11T10:00:00.000Z",
): StepMetric {
  const row: StepMetric = {
    schema_version: METRICS_SCHEMA_VERSION,
    metric_kind: "step",
    run_id,
    site_key: "site",
    task_key: "task",
    step_index,
    testbed_version: "11.0.0",
    outcome: replay_valid ? "PASS" : "REPAIRED_PASS",
    replay_valid,
    mode: "replay",
    cost: zeroCost(),
    recorded_at,
  };
  if (program_source !== undefined) row.program_source = program_source;
  return row;
}

describe("the arithmetic", () => {
  it("reports no_data on an empty denominator, never 0", () => {
    // The distinction the whole repo is built on: `no_data` and `0%` are
    // different claims, and a rate of 0 reads as "the cache is failing".
    const result = cacheHitRate([]);
    expect(result.section.status).toBe("no_data");
    expect(result.section.value).toBeNull();
    expect(result.section.denominator).toBe(0);
    expect(result.points).toEqual([]);
  });

  it("is 1.0 when every cache-served step replayed valid", () => {
    const rows: MetricRow[] = [
      step("r1", 0, true, "cache"),
      step("r1", 1, true, "cache"),
    ];
    const { section } = cacheHitRate(rows);
    expect(section.status).toBe("computed");
    expect(section.value).toBe(1);
    expect(section.numerator).toBe(2);
    expect(section.denominator).toBe(2);
  });

  it("is 0.0 when every cache-served step needed repair", () => {
    // A real measured zero, unlike the `no_data` case above — the cache served
    // the program and none of it worked first time.
    const rows: MetricRow[] = [
      step("r1", 0, false, "cache"),
      step("r1", 1, false, "cache"),
    ];
    const { section } = cacheHitRate(rows);
    expect(section.status).toBe("computed");
    expect(section.value).toBe(0);
    expect(section.denominator).toBe(2);
  });

  it("counts a REPAIRED_PASS as a miss — it passed, but it cost tokens", () => {
    // The definition ADR-0014 fixes: a repaired step is a miss even though the
    // task succeeded, because hit-rate exists to track model spend.
    const rows: MetricRow[] = [
      step("r1", 0, true, "cache"),
      step("r1", 1, false, "cache"),
    ];
    const { section } = cacheHitRate(rows);
    expect(rows[1]!.metric_kind === "step" && rows[1]!.outcome).toBe("REPAIRED_PASS");
    expect(section.value).toBe(0.5);
    expect(section.numerator).toBe(1);
    expect(section.denominator).toBe(2);
  });
});

describe("what is in the denominator", () => {
  it("excludes file-loaded steps entirely rather than counting them as misses", () => {
    // Counting them would make hit-rate a function of how the runner was
    // invoked: a matrix run against `--program <bundle>` would report 0%, which
    // reads as "the cache is failing" when the cache was never asked.
    const rows: MetricRow[] = [
      step("r1", 0, true, "cache"),
      step("r2", 0, false, "file"),
      step("r2", 1, false),
    ];
    const { section } = cacheHitRate(rows);
    expect(section.denominator).toBe(1);
    expect(section.value).toBe(1);
  });

  it("an all-file run is no_data, not 0%", () => {
    const rows: MetricRow[] = [step("r1", 0, false, "file"), step("r1", 1, true)];
    const { section } = cacheHitRate(rows);
    expect(section.status).toBe("no_data");
    expect(section.value).toBeNull();
  });

  it("does not redefine replay_valid — the two fields stay independent", () => {
    // #67 is explicit that hit-rate must not be squeezed into an existing
    // field. Same `replay_valid`, different provenance, different denominator.
    const cacheRows: MetricRow[] = [step("r1", 0, true, "cache")];
    const fileRows: MetricRow[] = [step("r1", 0, true, "file")];
    expect(cacheHitRate(cacheRows).section.denominator).toBe(1);
    expect(cacheHitRate(fileRows).section.denominator).toBe(0);
  });

  it("dedupes to the latest row per (run, step)", () => {
    // A repair emits a second row for the same step. Counting both would
    // inflate the denominator and let one step vote twice.
    const rows: MetricRow[] = [
      step("r1", 0, false, "cache"),
      step("r1", 0, true, "cache"),
    ];
    const { section } = cacheHitRate(rows);
    expect(section.denominator).toBe(1);
    expect(section.value).toBe(1);
  });
});

describe("over time — a pooled ratio does not show a trend", () => {
  it("emits one cumulative point per cache-consulting run, in time order", () => {
    const rows: MetricRow[] = [
      step("r2", 0, false, "cache", "2026-08-11T11:00:00.000Z"),
      step("r1", 0, true, "cache", "2026-08-11T10:00:00.000Z"),
      step("r3", 0, true, "cache", "2026-08-11T12:00:00.000Z"),
    ];
    const { points } = cacheHitRate(rows);
    expect(points.map((p) => p.run_id)).toEqual(["r1", "r2", "r3"]);
    expect(points.map((p) => p.n)).toEqual([1, 2, 3]);
    // Cumulative, so the curve is the trend §9 asks for: 1/1, 1/2, 2/3.
    expect(points.map((p) => p.hit_rate)).toEqual([1, 0.5, 2 / 3]);
    expect(points.map((p) => p.cache_steps)).toEqual([1, 2, 3]);
  });

  it("indexes over cache-consulting runs only, not over all runs", () => {
    // A run that never consulted the cache would flat-line the curve for a
    // reason unrelated to the cache, so it gets no point. `run_id` on each
    // point is what lets a reader join back to the amortized series.
    const rows: MetricRow[] = [
      step("cached", 0, true, "cache", "2026-08-11T10:00:00.000Z"),
      step("filed", 0, true, "file", "2026-08-11T11:00:00.000Z"),
    ];
    const { points } = cacheHitRate(rows);
    expect(points).toHaveLength(1);
    expect(points[0]!.run_id).toBe("cached");
  });

  it("the final point equals the pooled section value", () => {
    // Guards a real drift risk: the trend and the headline number are computed
    // in the same pass, and if they ever disagree one of them is lying.
    const rows: MetricRow[] = [
      step("r1", 0, true, "cache", "2026-08-11T10:00:00.000Z"),
      step("r2", 0, false, "cache", "2026-08-11T11:00:00.000Z"),
      step("r2", 1, true, "cache", "2026-08-11T11:00:00.000Z"),
    ];
    const { points, section } = cacheHitRate(rows);
    expect(points[points.length - 1]!.hit_rate).toBe(section.value);
  });
});

describe("the report", () => {
  it("includes the section, beside the amortized curve", () => {
    const report = buildGateReport([step("r1", 0, true, "cache")]);
    const found = report.metrics.find((m) => m.name.includes("hit"));
    expect(found).toBeDefined();
    expect(found?.status).toBe("computed");
    expect(found?.value).toBe(1);
  });

  it("carries the trend points for plotting", () => {
    const report = buildGateReport([step("r1", 0, true, "cache")]);
    expect(report.cache_hit_rate_points).toHaveLength(1);
  });

  it("renders as no_data on an empty run rather than being absent", () => {
    // A missing section and a `no_data` section read very differently to
    // someone checking whether §9 is fully reported.
    const report = buildGateReport([]);
    const found = report.metrics.find((m) => m.name.includes("hit"));
    expect(found?.status).toBe("no_data");
    expect(found?.value).toBeNull();
  });

  it("states no target or threshold — §9 gives a direction, not a number", () => {
    const report = buildGateReport([step("r1", 0, true, "cache")]);
    const found = report.metrics.find((m) => m.name.includes("hit"))!;
    expect(found.formula).toContain("program_source=cache");
    expect(JSON.stringify(found)).not.toMatch(/threshold|target|kill/i);
  });
});
