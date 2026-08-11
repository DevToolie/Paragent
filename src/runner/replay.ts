/**
 * ReplayRunner — execute compiled programs with optional repair loop.
 * Emits step + run metrics via MetricsEmitter. Never invents token costs.
 * Assertion immutability enforced via assertAssertionUnchanged.
 */

import { randomUUID } from "node:crypto";
import type { Page } from "playwright";
import {
  METRICS_SCHEMA_VERSION,
  type Cost,
  type MetricRow,
  type RunMetric,
  type StepMetric,
  type StepOutcome,
} from "../metrics/types.js";
import { addCost, measureWallClock, zeroCost } from "../metrics/cost.js";
import { MetricsEmitter } from "../metrics/emitter.js";
import { executeAction, NETWORK_IDLE_WAIT_MS } from "./actions.js";
import { evaluateAssertion } from "./assertions.js";
import { capturePageState, emptyPageState } from "./page-state.js";
import { assertParamsBound } from "./params.js";
import {
  assertAssertionUnchanged,
  type RepairModelClient,
  StubRepairModelClient,
} from "./repair.js";
import { deepFreeze } from "./templates.js";
import type {
  CompiledAction,
  CompiledProgram,
  CompiledStep,
  ParamBindings,
  RepairContext,
  RepairProposal,
  RunResult,
  StepAttemptResult,
  StepOutcomeObservation,
} from "./types.js";

const SUCCESS_OUTCOMES: ReadonlySet<StepOutcome> = new Set([
  "PASS",
  "REPAIRED_PASS",
]);

export interface ReplayRunnerOptions {
  dryRun?: boolean;
  /** Per-step outcomes when dryRun=true (length should match program.steps). */
  dryRunOutcomes?: StepOutcome[];
  maxRepairsPerRun?: number;
  repairClient?: RepairModelClient;
  metrics?: MetricsEmitter;
  runId?: string;
  /** Fresh-reasoning baseline cost (measured separately). Defaults to zeros. */
  costFresh?: Cost;
  page?: Page;
  /**
   * Ceiling for a parameterless `wait` step's `networkidle` fallback.
   * Defaults to `NETWORK_IDLE_WAIT_MS`; see the note on that constant for why
   * it is bounded at all.
   */
  networkIdleWaitMs?: number;
  /**
   * Observer called once per step, after its metric row is emitted (#64).
   *
   * Optional, and a runner without one behaves exactly as it did before #64 —
   * which is what keeps the gate matrix unaffected. It cannot influence the run:
   * it is invoked after the outcome is final and its return value is ignored.
   */
  onStepOutcome?: (observation: StepOutcomeObservation) => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isFailureOutcome(outcome: StepOutcome): boolean {
  return !SUCCESS_OUTCOMES.has(outcome);
}

function errText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.split("\n")[0]!.slice(0, 300);
}

export class ReplayRunner {
  readonly dryRun: boolean;
  readonly dryRunOutcomes: StepOutcome[];
  readonly maxRepairsPerRun: number;
  private readonly repairClient: RepairModelClient;
  private readonly metrics: MetricsEmitter;
  private readonly costFresh: Cost;
  private readonly page?: Page;
  private readonly networkIdleWaitMs: number;
  private readonly onStepOutcome?: (o: StepOutcomeObservation) => void;

  constructor(options: ReplayRunnerOptions = {}) {
    this.dryRun = options.dryRun ?? false;
    this.dryRunOutcomes = options.dryRunOutcomes ?? [];
    this.maxRepairsPerRun = options.maxRepairsPerRun ?? 2;
    this.repairClient = options.repairClient ?? new StubRepairModelClient();
    this.metrics = options.metrics ?? new MetricsEmitter();
    this.costFresh = options.costFresh ?? zeroCost();
    this.networkIdleWaitMs = options.networkIdleWaitMs ?? NETWORK_IDLE_WAIT_MS;
    if (options.onStepOutcome !== undefined) this.onStepOutcome = options.onStepOutcome;
    if (options.page !== undefined) this.page = options.page;
  }

  getMetricsEmitter(): MetricsEmitter {
    return this.metrics;
  }

  async run(
    program: CompiledProgram,
    params: ParamBindings = {},
    runId: string = randomUUID(),
  ): Promise<RunResult> {
    // Before the browser opens, before step 0, and before any metric is
    // emitted (#122). A forgotten binding otherwise surfaces as PAGE_ERROR or
    // ASSERTION_FAILED — the outcomes the gate counts as churn — at exactly the
    // place in the run where real churn appears, with nothing in the row to
    // tell them apart. A refused run is not a failed run, it is an absent one,
    // so it must contribute nothing to any §9 denominator; throwing is the only
    // shape `RunResult` cannot misrepresent.
    assertParamsBound(program, params);

    const started = Date.now();
    const stepResults: StepAttemptResult[] = [];
    let repairCount = 0;
    let stepsReplayValid = 0;
    let selfHealed = false;
    let timeToRepairTotal = 0;
    let costReplay = zeroCost();
    let costRepair = zeroCost();

    for (const step of program.steps) {
      const frozenAssertion = deepFreeze(
        structuredClone(step.assertion),
      );
      const stepStarted = Date.now();

      // --- first-pass replay ---
      const first = await this.attemptStep({
        program,
        step,
        action: step.compiled_action,
        params,
        runId,
        mode: "replay",
        repairAttempt: 0,
        dryIndex: step.step_index,
      });

      let final: StepAttemptResult = first;
      // The action a repair actually made work, when one did. Needed by the
      // cache-update observer: a REPAIRED_PASS rewrites the entry, so the sink
      // has to know what it was rewritten *to*.
      let repairedAction: CompiledAction | undefined;
      costReplay = addCost(costReplay, first.cost);

      if (first.outcome === "PASS") {
        stepsReplayValid += 1;
        final = {
          ...first,
          replay_valid: true,
          assertion_strength: step.assertion.strength,
        };
      } else if (isFailureOutcome(first.outcome)) {
        // Repair loop — assertion frozen; never rewritten.
        let lastOutcome = first.outcome;
        let lastMessage = first.error_message;
        let repaired = false;
        const failureDetectedAt = Date.now();

        while (repairCount < this.maxRepairsPerRun) {
          repairCount += 1;
          const attempt = repairCount;
          const pageState = this.page
            ? await capturePageState(this.page)
            : emptyPageState();

          const ctx: RepairContext = {
            run_id: runId,
            step,
            assertion: frozenAssertion,
            failed_outcome: lastOutcome,
            page_state: pageState,
            attempt,
            params,
          };
          if (lastMessage !== undefined) ctx.error_message = lastMessage;

          let proposal: RepairProposal;
          let proposeMs: number;
          try {
            ({ result: proposal, wall_clock_ms: proposeMs } =
              await measureWallClock(() => this.repairClient.propose(ctx)));
          } catch (err) {
            // A repair client is an external call (a model API) and can fail
            // for reasons that are not this run's fault — the same posture
            // already given to a browser action or an assertion evaluation,
            // both of which are caught into a StepOutcome rather than left to
            // escape (src/runner/actions.ts, src/runner/assertions.ts). Before
            // this, an uncaught throw here propagated out of run() entirely —
            // one flaky repair call would abort the whole matrix run instead
            // of recording one step's repair as failed.
            final = {
              step_index: step.step_index,
              outcome: "REPAIR_EXHAUSTED",
              replay_valid: false,
              mode: "repair",
              cost: zeroCost(),
              repair_attempt: attempt,
              assertion_strength: step.assertion.strength,
              first_pass_outcome: first.outcome,
              error_message: `repair client threw: ${errText(err)}`,
            };
            break;
          }

          assertAssertionUnchanged(frozenAssertion, step.assertion);
          assertAssertionUnchanged(frozenAssertion, ctx.assertion);

          const proposeCost: Cost = {
            tokens_in: proposal.tokens_in,
            tokens_out: proposal.tokens_out,
            wall_clock_ms: proposeMs,
          };
          if (proposal.model_id !== undefined) {
            proposeCost.model_id = proposal.model_id;
          }
          costRepair = addCost(costRepair, proposeCost);

          if (proposal.corrected_action === null) {
            final = {
              step_index: step.step_index,
              outcome: "REPAIR_EXHAUSTED",
              replay_valid: false,
              mode: "repair",
              cost: proposeCost,
              repair_attempt: attempt,
              assertion_strength: step.assertion.strength,
              // The path every failure takes while repair is a stub. Without
              // this the real outcome is lost — see the field's note.
              first_pass_outcome: first.outcome,
              error_message:
                proposal.notes ??
                lastMessage ??
                "repair returned corrected_action:null",
            };
            break;
          }

          const currentAction = proposal.corrected_action;
          const retry = await this.attemptStep({
            program,
            step,
            action: currentAction,
            params,
            runId,
            mode: "repair",
            repairAttempt: attempt,
            dryIndex: step.step_index,
          });
          costRepair = addCost(costRepair, retry.cost);
          assertAssertionUnchanged(frozenAssertion, step.assertion);

          if (retry.outcome === "PASS") {
            const timeToRepair = Math.max(0, Date.now() - failureDetectedAt);
            timeToRepairTotal += timeToRepair;
            selfHealed = true;
            repaired = true;
            repairedAction = currentAction;
            final = {
              step_index: step.step_index,
              outcome: "REPAIRED_PASS",
              replay_valid: false,
              mode: "repair",
              cost: addCost(proposeCost, retry.cost),
              repair_attempt: attempt,
              time_to_repair_ms: timeToRepair,
              assertion_strength: step.assertion.strength,
            };
            break;
          }

          lastOutcome = retry.outcome;
          lastMessage = retry.error_message;
          final = {
            ...retry,
            replay_valid: false,
            mode: "repair",
            repair_attempt: attempt,
            assertion_strength: step.assertion.strength,
          };
        }

        if (!repaired && final.outcome !== "REPAIR_EXHAUSTED") {
          // Ran out of budget mid-loop or never entered (budget already 0).
          if (repairCount >= this.maxRepairsPerRun || this.maxRepairsPerRun === 0) {
            const exhausted: StepAttemptResult = {
              step_index: step.step_index,
              outcome: "REPAIR_EXHAUSTED",
              replay_valid: false,
              mode: "repair",
              cost: final.cost,
              assertion_strength: step.assertion.strength,
              // Keep what actually went wrong; see the field's note.
              first_pass_outcome: first.outcome,
            };
            if (repairCount > 0) exhausted.repair_attempt = repairCount;
            const msg = final.error_message ?? lastMessage;
            if (msg !== undefined) exhausted.error_message = msg;
            final = exhausted;
          }
        }

        // If first failed and maxRepairsPerRun is 0, mark exhausted.
        if (this.maxRepairsPerRun === 0) {
          const exhausted: StepAttemptResult = {
            step_index: step.step_index,
            outcome: "REPAIR_EXHAUSTED",
            replay_valid: false,
            mode: "replay",
            cost: first.cost,
            assertion_strength: step.assertion.strength,
            first_pass_outcome: first.outcome,
          };
          if (first.error_message !== undefined) {
            exhausted.error_message = first.error_message;
          }
          final = exhausted;
        }

        void stepStarted;
      } else {
        final = {
          ...first,
          replay_valid: false,
          assertion_strength: step.assertion.strength,
        };
      }

      stepResults.push(final);
      this.emitStepMetric(program, runId, final);
      // After the metric, deliberately: the observation must never be able to
      // influence what was measured. See StepOutcomeObservation.
      this.observeStep(program, runId, final, repairedAction);

      if (!SUCCESS_OUTCOMES.has(final.outcome)) {
        // Stop on hard failure after repair exhaustion.
        break;
      }
    }

    const wallClock = Math.max(0, Date.now() - started);
    const stepsTotal = program.steps.length;
    const executedSuccess = stepResults.every((s) =>
      SUCCESS_OUTCOMES.has(s.outcome),
    );
    const taskSuccess =
      executedSuccess && stepResults.length === stepsTotal;
    const successWithLe2 = taskSuccess && repairCount <= 2;

    const runResult: RunResult = {
      run_id: runId,
      site_key: program.site_key,
      task_key: program.task_key,
      testbed_version: program.testbed_version,
      task_success: taskSuccess,
      repair_count: repairCount,
      success_with_le_2_repairs: successWithLe2,
      steps_total: stepsTotal,
      steps_replay_valid: stepsReplayValid,
      self_healed: selfHealed,
      time_to_repair_total_ms: timeToRepairTotal,
      step_results: stepResults,
      wall_clock_total_ms: wallClock,
      cost_fresh: this.costFresh,
      cost_replay: costReplay,
      cost_repair: costRepair,
    };

    this.emitRunMetric(runResult);
    return runResult;
  }

  private async attemptStep(args: {
    program: CompiledProgram;
    step: CompiledStep;
    action: CompiledAction;
    params: ParamBindings;
    runId: string;
    mode: "replay" | "repair";
    repairAttempt: number;
    dryIndex: number;
  }): Promise<StepAttemptResult> {
    const { step, action, params, mode, repairAttempt, dryIndex } = args;

    if (this.dryRun) {
      // First-pass uses dryRunOutcomes. A repair retry (only reached when a
      // client returned corrected_action) is treated as PASS so dry-run can
      // exercise REPAIRED_PASS without inventing live browser success.
      let outcome: StepOutcome =
        this.dryRunOutcomes[dryIndex] ??
        this.dryRunOutcomes[step.step_index] ??
        "PASS";
      if (mode === "repair" && isFailureOutcome(outcome)) {
        outcome = "PASS";
      }
      const result: StepAttemptResult = {
        step_index: step.step_index,
        outcome,
        replay_valid: mode === "replay" && outcome === "PASS",
        mode,
        cost: zeroCost(),
        assertion_strength: step.assertion.strength,
      };
      if (mode === "repair") result.repair_attempt = repairAttempt;
      if (outcome !== "PASS" && outcome !== "REPAIRED_PASS") {
        result.error_message = `dry-run outcome: ${outcome}`;
      }
      return result;
    }

    if (!this.page) {
      return {
        step_index: step.step_index,
        outcome: "PAGE_ERROR",
        replay_valid: false,
        mode,
        cost: zeroCost(),
        assertion_strength: step.assertion.strength,
        error_message: "live run requires a Playwright page (use dryRun)",
      };
    }

    const { result, wall_clock_ms } = await measureWallClock(async () => {
      const actionResult = await executeAction(this.page!, action, params, {
        networkIdleWaitMs: this.networkIdleWaitMs,
      });
      if (!actionResult.ok) {
        return {
          outcome: (actionResult.outcome ?? "PAGE_ERROR") as StepOutcome,
          message: actionResult.message,
        };
      }
      // A `wait` whose networkidle hint never fired is not a failure — it
      // proceeds and says so, so the note has to survive a passing assertion.
      const notes =
        actionResult.settled === false ? actionResult.message : undefined;
      const assertionResult = await evaluateAssertion(
        this.page!,
        step.assertion,
        params,
      );
      return {
        outcome: assertionResult.outcome,
        message: assertionResult.message,
        notes,
      };
    });

    const out: StepAttemptResult = {
      step_index: step.step_index,
      outcome: result.outcome,
      replay_valid: mode === "replay" && result.outcome === "PASS",
      mode,
      cost: { tokens_in: 0, tokens_out: 0, wall_clock_ms },
      assertion_strength: step.assertion.strength,
    };
    if (mode === "repair") out.repair_attempt = repairAttempt;
    if (result.message !== undefined) out.error_message = result.message;
    if (result.notes !== undefined) out.notes = result.notes;
    return out;
  }

  /**
   * Hand the settled outcome to the optional observer (#64).
   *
   * Wrapped: a sink that throws must not take down a measurement run. The
   * cache is a recording of what happened, and losing that recording is
   * strictly better than losing the run that produced it — the run is the
   * measurement. The failure is reported, never swallowed silently.
   */
  private observeStep(
    program: CompiledProgram,
    runId: string,
    final: StepAttemptResult,
    repairedAction: CompiledAction | undefined,
  ): void {
    if (!this.onStepOutcome) return;
    const observation: StepOutcomeObservation = {
      site_key: program.site_key,
      task_key: program.task_key,
      step_index: final.step_index,
      outcome: final.outcome,
    };
    if (final.outcome === "REPAIRED_PASS" && repairedAction !== undefined) {
      observation.repair = {
        run_id: runId,
        repair_attempt: final.repair_attempt ?? 1,
        corrected_action: repairedAction,
      };
    }
    try {
      this.onStepOutcome(observation);
    } catch (err) {
      console.error(
        `onStepOutcome failed for step ${final.step_index}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private emitStepMetric(
    program: CompiledProgram,
    runId: string,
    step: StepAttemptResult,
  ): void {
    const row: StepMetric = {
      schema_version: METRICS_SCHEMA_VERSION,
      metric_kind: "step",
      run_id: runId,
      site_key: program.site_key,
      task_key: program.task_key,
      step_index: step.step_index,
      testbed_version: program.testbed_version,
      outcome: step.outcome,
      replay_valid: step.replay_valid,
      mode: step.mode,
      cost: step.cost,
      recorded_at: nowIso(),
    };
    if (step.repair_attempt !== undefined) {
      row.repair_attempt = step.repair_attempt;
    }
    if (step.time_to_repair_ms !== undefined) {
      row.time_to_repair_ms = step.time_to_repair_ms;
    }
    if (step.assertion_strength !== undefined) {
      row.assertion_strength = step.assertion_strength;
    }
    this.metrics.emit(row);
  }

  private emitRunMetric(result: RunResult): void {
    const row: RunMetric = {
      schema_version: METRICS_SCHEMA_VERSION,
      metric_kind: "run",
      run_id: result.run_id,
      site_key: result.site_key,
      task_key: result.task_key,
      testbed_version: result.testbed_version,
      task_success: result.task_success,
      repair_count: result.repair_count,
      success_with_le_2_repairs: result.success_with_le_2_repairs,
      steps_total: result.steps_total,
      steps_replay_valid: result.steps_replay_valid,
      self_healed: result.self_healed,
      time_to_repair_total_ms: result.time_to_repair_total_ms,
      cost_fresh: result.cost_fresh,
      cost_replay: result.cost_replay,
      cost_repair: result.cost_repair,
      wall_clock_total_ms: result.wall_clock_total_ms,
      recorded_at: nowIso(),
    };
    this.metrics.emit(row as MetricRow);
  }
}
