/**
 * #84 — per-run wall-clock budget (ADR-0011).
 *
 * The runner capped repair *attempts* and nothing capped elapsed time, so a run's
 * worst case was unbounded in the dimension a user feels and the §9 kill line
 * measures. These pin the guard and — more importantly — what it reports, since
 * the risk of a budget is that it quietly shrinks a denominator.
 *
 * The clock is injected rather than slept through: a test that waits out a real
 * budget is either slow or short enough to be flaky, and only the budget reads
 * this seam, so a fake clock here cannot fabricate an emitted measurement.
 */
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { type Browser, type Page } from "playwright";
import { launchTestBrowser } from "../helpers/browser.js";
import {
  DEFAULT_RUN_BUDGET_MS,
  ReplayRunner,
} from "../../src/runner/replay.js";
import { MetricsEmitter } from "../../src/metrics/emitter.js";
import { selfHealRate, truncationSummary } from "../../src/metrics/aggregate.js";
import type { RunMetric } from "../../src/metrics/types.js";
import type { RepairModelClient } from "../../src/runner/repair.js";
import type {
  Assertion,
  CompiledProgram,
  RepairContext,
  RepairProposal,
} from "../../src/runner/types.js";

function assertion(id: string): Assertion {
  return {
    schema_version: "1.0.0",
    assertion_id: id,
    type: "element-visible",
    strength: "strong",
    timeout_ms: 1000,
    failure_classification: "assertion_failed",
    expected: { visible: true },
  };
}

/** `n` identical click steps — enough to have somewhere to stop. */
function program(n: number): CompiledProgram {
  return {
    schema_version: "1.0.0",
    program_id: "budget-demo",
    site_key: "local-demo",
    task_key: "budget-demo",
    testbed_version: "pending-b1@placeholder",
    steps: Array.from({ length: n }, (_, i) => ({
      step_index: i,
      compiled_action: {
        type: "click" as const,
        locator_fallback_chain: [
          { strategy: "role_name" as const, role: "button", name: "Save" },
        ],
      },
      assertion: assertion(`s${i}`),
    })),
  };
}

/** A clock the test advances by hand. Milliseconds since an arbitrary zero. */
function fakeClock(): { now: () => number; advance: (ms: number) => void } {
  let t = 1_000_000;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

const runRows = (metrics: MetricsEmitter): RunMetric[] =>
  metrics.getRows().filter((r): r is RunMetric => r.metric_kind === "run");

describe("replay wall-clock budget (#84 / ADR-0011)", () => {
  it("defaults to a budget that does not fire on a healthy run", async () => {
    const metrics = new MetricsEmitter();
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: ["PASS", "PASS", "PASS"],
      metrics,
    });
    expect(runner.runBudgetMs).toBe(DEFAULT_RUN_BUDGET_MS);

    const result = await runner.run(program(3));
    expect(result.task_success).toBe(true);
    expect(result.budget_exhausted).toBe(false);
    expect(result.steps_attempted).toBe(3);
    expect(runRows(metrics)[0]!.budget_exhausted).toBe(false);
  });

  it("stops at the next step boundary and says so on the run row", async () => {
    const clock = fakeClock();
    const metrics = new MetricsEmitter();
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: ["PASS", "PASS", "PASS", "PASS"],
      metrics,
      runBudgetMs: 100,
      now: clock.now,
      // Every step burns 60ms of the 100ms budget, so the run reaches step 2's
      // boundary over budget.
      onStepOutcome: () => clock.advance(60),
    });

    const result = await runner.run(program(4));
    expect(result.budget_exhausted).toBe(true);
    expect(result.steps_attempted).toBe(2);
    expect(result.steps_total).toBe(4);
    expect(result.task_success).toBe(false);

    // Steps it never reached emit no rows at all — they were not attempted, and
    // scoring them either way would invent a result.
    const steps = metrics.getRows().filter((r) => r.metric_kind === "step");
    expect(steps).toHaveLength(2);
    expect(steps.every((s) => s.outcome === "PASS")).toBe(true);

    const run = runRows(metrics)[0]!;
    expect(run.budget_exhausted).toBe(true);
    expect(run.steps_attempted).toBe(2);
    expect(run.wall_clock_budget_ms).toBe(100);
  });

  it("never cuts a step mid-flight — the step in progress finishes", async () => {
    const clock = fakeClock();
    const metrics = new MetricsEmitter();
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: ["PASS", "PASS"],
      metrics,
      runBudgetMs: 10,
      now: clock.now,
      // Step 0 alone blows the budget tenfold. It still produces a full,
      // ordinary PASS row: an assertion denied its own timeout would report a
      // failure belonging to the budget rather than to the site.
      onStepOutcome: () => clock.advance(100),
    });

    const result = await runner.run(program(2));
    expect(result.steps_attempted).toBe(1);
    expect(result.step_results[0]!.outcome).toBe("PASS");
    expect(result.budget_exhausted).toBe(true);
  });

  it("can be disabled deliberately, restoring the unbounded behaviour", async () => {
    const clock = fakeClock();
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: ["PASS", "PASS", "PASS"],
      runBudgetMs: 0,
      now: clock.now,
      onStepOutcome: () => clock.advance(10_000_000),
    });
    const result = await runner.run(program(3));
    expect(result.budget_exhausted).toBe(false);
    expect(result.steps_attempted).toBe(3);
    expect(result.task_success).toBe(true);
  });

  it("counts a budget-truncated run as not-successful, never as repaired", async () => {
    const clock = fakeClock();
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: ["PASS", "PASS", "PASS"],
      runBudgetMs: 50,
      now: clock.now,
      onStepOutcome: () => clock.advance(60),
    });
    const result = await runner.run(program(3));
    // Every step it ran passed, and the run still did not succeed: task_success
    // means the whole task, and this one did not finish.
    expect(result.step_results.every((s) => s.outcome === "PASS")).toBe(true);
    expect(result.task_success).toBe(false);
    expect(result.self_healed).toBe(false);
    expect(result.success_with_le_2_repairs).toBe(false);
  });

  it("keeps a truncated run out of the self-heal denominator", async () => {
    const clock = fakeClock();
    const metrics = new MetricsEmitter();
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: ["PASS", "PASS", "PASS", "PASS"],
      metrics,
      runBudgetMs: 100,
      now: clock.now,
      onStepOutcome: () => clock.advance(60),
    });
    await runner.run(program(4));
    const rows = metrics.getRows();

    // 2 of 4 steps ran, both passed, nothing ever failed — so there is nothing
    // to have healed. Scoring this run against steps_total would put it in the
    // denominator and count it as a self-heal failure, inventing a result out
    // of steps that were never executed.
    expect(selfHealRate(rows).status).toBe("no_data");

    // And the shortfall is stated rather than left to be inferred.
    expect(truncationSummary(rows)).toEqual({
      runs: 1,
      runs_truncated_by_budget: 1,
      steps_unattempted: 2,
      status: "computed",
    });
  });
});

/**
 * The in-loop check, on the real clock.
 *
 * A step's first pass is instant in dry-run, so the step-boundary check always
 * gets there first and the repair-loop check is unreachable with a fake clock.
 * The case it exists for is the one #84 describes — a step that spends its full
 * assertion timeout before it is even classified as a failure — so this drives a
 * real page and a real timeout rather than simulating one.
 */
describe("replay budget stops repair on a genuinely slow step", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await launchTestBrowser();
    page = await browser.newPage();
    await page.setContent("<!doctype html><html><body><p>empty</p></body></html>");
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it("reports BUDGET_EXHAUSTED with the first-pass outcome, not REPAIR_EXHAUSTED", async () => {
    const slow: CompiledProgram = {
      schema_version: "1.0.0",
      program_id: "budget-live",
      site_key: "local-demo",
      task_key: "budget-live",
      testbed_version: "pending-b1@placeholder",
      steps: [
        {
          step_index: 0,
          // 700ms in the action, then an assertion that cannot pass and spends
          // its own 300ms — ~1s in one step, against a 400ms budget.
          compiled_action: { type: "wait", wait_ms: 700, locator_fallback_chain: [] },
          assertion: {
            ...assertion("live-0"),
            timeout_ms: 300,
            target: {
              locator: { strategy: "role_name", role: "button", name: "Nothing Here" },
            },
          },
        },
      ],
    };

    const metrics = new MetricsEmitter();
    // A client that would happily propose forever. If the budget did not stop
    // it, the outcome would be REPAIRED_PASS or REPAIR_EXHAUSTED, not this.
    const eagerClient: RepairModelClient = {
      propose: async (_ctx: RepairContext): Promise<RepairProposal> => ({
        corrected_action: { type: "wait", wait_ms: 0, locator_fallback_chain: [] },
        tokens_in: 0,
        tokens_out: 0,
      }),
    };
    const runner = new ReplayRunner({
      page,
      metrics,
      maxRepairsPerRun: 2,
      runBudgetMs: 400,
      repairClient: eagerClient,
    });

    const result = await runner.run(slow);
    const step = result.step_results[0]!;
    expect(step.outcome).toBe("BUDGET_EXHAUSTED");
    expect(step.replay_valid).toBe(false);
    // The failure itself is still measured — it is the recovery the clock cut.
    expect(step.first_pass_outcome).toBeDefined();
    expect(step.error_message).toMatch(/budget \(400ms\) spent/);
    // Attempts remained; time did not. That is the distinction from
    // REPAIR_EXHAUSTED, and why reusing that member would have been a lie.
    expect(result.repair_count).toBe(0);
    expect(result.budget_exhausted).toBe(true);
    expect(result.task_success).toBe(false);
  }, 30_000);
});
