import { describe, it, expect } from "vitest";
import { PACKAGE } from "../../src/runner/index.js";
import {
  assertionsEqual,
  deepFreeze,
  interpolate,
} from "../../src/runner/templates.js";
import {
  assertAssertionUnchanged,
  StubRepairModelClient,
  type RepairModelClient,
} from "../../src/runner/repair.js";
import { emptyPageState } from "../../src/runner/page-state.js";
import { ReplayRunner } from "../../src/runner/replay.js";
import { MetricsEmitter } from "../../src/metrics/emitter.js";
import type {
  Assertion,
  CompiledAction,
  CompiledProgram,
  RepairContext,
  RepairProposal,
} from "../../src/runner/types.js";

function sampleAssertion(overrides: Partial<Assertion> = {}): Assertion {
  return {
    schema_version: "1.0.0",
    assertion_id: "a1",
    type: "element-visible",
    strength: "strong",
    timeout_ms: 1000,
    failure_classification: "assertion_failed",
    expected: { visible: true },
    ...overrides,
  };
}

function sampleProgram(): CompiledProgram {
  return {
    schema_version: "1.0.0",
    program_id: "unit-demo",
    site_key: "local-demo",
    task_key: "unit-demo",
    testbed_version: "pending-b1@placeholder",
    steps: [
      {
        step_index: 0,
        compiled_action: {
          type: "navigate",
          url_template: "{base_url}",
          param_refs: ["base_url"],
          locator_fallback_chain: [],
        },
        assertion: sampleAssertion({ assertion_id: "s0" }),
      },
      {
        step_index: 1,
        compiled_action: {
          type: "click",
          locator_fallback_chain: [
            { strategy: "role_name", role: "button", name: "Save" },
          ],
        },
        assertion: sampleAssertion({ assertion_id: "s1" }),
      },
    ],
  };
}

describe("runner package", () => {
  it("exports PACKAGE runner", () => {
    expect(PACKAGE).toBe("runner");
  });

  it("interpolates templates and deep-freezes assertions", () => {
    expect(interpolate("http://{host}:{port}/x", { host: "h", port: 9 })).toBe(
      "http://h:9/x",
    );
    const a = sampleAssertion();
    deepFreeze(a);
    expect(Object.isFrozen(a)).toBe(true);
    expect(() => {
      (a as { assertion_id: string }).assertion_id = "mutated";
    }).toThrow();
  });

  it("assertionsEqual detects mutation; assertAssertionUnchanged throws", () => {
    const a = sampleAssertion();
    const b = sampleAssertion();
    expect(assertionsEqual(a, b)).toBe(true);
    const weakened = sampleAssertion({ strength: "weak" });
    expect(assertionsEqual(a, weakened)).toBe(false);
    expect(() => assertAssertionUnchanged(a, weakened)).toThrow(/assertion/);
  });

  it("StubRepairModelClient returns null action and zero tokens", async () => {
    const client = new StubRepairModelClient();
    const proposal = await client.propose({
      run_id: "r",
      step: sampleProgram().steps[0]!,
      assertion: sampleAssertion(),
      failed_outcome: "ASSERTION_FAILED",
      page_state: emptyPageState(),
      attempt: 1,
      params: {},
    });
    expect(proposal.corrected_action).toBeNull();
    expect(proposal.tokens_in).toBe(0);
    expect(proposal.tokens_out).toBe(0);
  });

  it("dry-run PASS emits replay_valid metrics with zero tokens", async () => {
    const metrics = new MetricsEmitter();
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: ["PASS", "PASS"],
      metrics,
    });
    const result = await runner.run(sampleProgram(), { base_url: "about:blank" });
    expect(result.task_success).toBe(true);
    expect(result.repair_count).toBe(0);
    expect(result.steps_replay_valid).toBe(2);
    expect(result.success_with_le_2_repairs).toBe(true);
    expect(result.cost_repair.tokens_in + result.cost_repair.tokens_out).toBe(0);
    const rows = metrics.getRows();
    expect(rows.filter((r) => r.metric_kind === "step")).toHaveLength(2);
    expect(rows.filter((r) => r.metric_kind === "run")).toHaveLength(1);
  });

  it("dry-run failure + stub repair → REPAIR_EXHAUSTED without changing assertion", async () => {
    const program = sampleProgram();
    const original = structuredClone(program.steps[0]!.assertion);
    const metrics = new MetricsEmitter();
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: ["ASSERTION_FAILED", "PASS"],
      metrics,
      maxRepairsPerRun: 2,
    });
    const result = await runner.run(program, { base_url: "about:blank" });
    expect(result.task_success).toBe(false);
    expect(result.step_results[0]?.outcome).toBe("REPAIR_EXHAUSTED");
    expect(assertionsEqual(original, program.steps[0]!.assertion)).toBe(true);
  });

  it("dry-run failure + mock repair client → REPAIRED_PASS; assertion unchanged", async () => {
    const program = sampleProgram();
    const original = structuredClone(program.steps[0]!.assertion);
    const corrected: CompiledAction = {
      type: "navigate",
      url_template: "{base_url}",
      param_refs: ["base_url"],
      locator_fallback_chain: [],
    };
    const client: RepairModelClient = {
      async propose(_ctx: RepairContext): Promise<RepairProposal> {
        return {
          corrected_action: corrected,
          tokens_in: 0,
          tokens_out: 0,
          notes: "test mock — zero tokens",
        };
      },
    };
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: ["ASSERTION_FAILED", "PASS"],
      repairClient: client,
      maxRepairsPerRun: 2,
    });
    const result = await runner.run(program, { base_url: "about:blank" });
    expect(result.step_results[0]?.outcome).toBe("REPAIRED_PASS");
    expect(result.self_healed).toBe(true);
    expect(result.task_success).toBe(true);
    expect(result.repair_count).toBe(1);
    expect(result.success_with_le_2_repairs).toBe(true);
    expect(assertionsEqual(original, program.steps[0]!.assertion)).toBe(true);
    expect(() => assertAssertionUnchanged(original, program.steps[0]!.assertion)).not.toThrow();
  });
});
