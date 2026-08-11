/**
 * Required-parameter derivation and the pre-run refusal (#122).
 *
 * What these pin is a **measurement** property, not an ergonomic one. Before
 * this, a forgotten binding surfaced as `PAGE_ERROR` or `ASSERTION_FAILED` — the
 * two outcomes the §9 aggregates read as evidence about churn — at exactly the
 * place in a run where real churn appears, with nothing in the metric row to
 * tell them apart. A matrix run with one misconfigured parameter reported a
 * worse gate number and looked like ordinary site drift.
 *
 * So the assertions that matter most here are the negative ones: a refused run
 * emits nothing at all, and a fully-bound program behaves exactly as it did.
 */

import { describe, expect, it } from "vitest";
import { MetricsEmitter } from "../../src/metrics/emitter.js";
import { bundleToProgram } from "../../src/runner/program.js";
import {
  UnboundParamsError,
  deriveRequiredParams,
  programRequirements,
  templateHoles,
  unsatisfiedRequirements,
} from "../../src/runner/params.js";
import { ReplayRunner } from "../../src/runner/replay.js";
import { interpolate } from "../../src/runner/templates.js";
import type {
  Assertion,
  CompiledAction,
  CompiledProgram,
  CompiledStep,
} from "../../src/runner/types.js";
import type { CompiledTrajectoryBundle } from "../../src/compiler/types.js";

function assertion(overrides: Partial<Assertion> = {}): Assertion {
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

function step(
  step_index: number,
  compiled_action: CompiledAction,
  overrides: Partial<Assertion> = {},
): CompiledStep {
  return { step_index, compiled_action, assertion: assertion(overrides) };
}

function program(steps: CompiledStep[]): CompiledProgram {
  return {
    schema_version: "1.0.0",
    program_id: "unit-params",
    site_key: "local-demo",
    task_key: "params",
    testbed_version: "pending-b1@placeholder",
    steps,
  };
}

/** Requirement key sets, order-independent, for readable assertions. */
function names(reqs: { any_of: string[] }[]): string[][] {
  return reqs.map((r) => r.any_of);
}

describe("templateHoles", () => {
  it("collects each distinct hole once, in first-appearance order", () => {
    expect(templateHoles("http://{host}:{port}/d/{host}")).toEqual(["host", "port"]);
  });

  it("is empty for a template with no holes, and for no template", () => {
    expect(templateHoles("http://localhost:3000/")).toEqual([]);
    expect(templateHoles(undefined)).toEqual([]);
  });
});

describe("deriveRequiredParams", () => {
  it("requires every hole in a navigate url_template", () => {
    const reqs = deriveRequiredParams([
      step(0, {
        type: "navigate",
        url_template: "http://{host}:{port}/dashboard/new",
        param_refs: ["host", "port"],
        locator_fallback_chain: [],
      }),
    ]);
    expect(names(reqs)).toEqual([["host"], ["port"]]);
  });

  it("requires a hole in a URL *path* segment — the silently-wrong one", () => {
    // `http://localhost:3000/d/{uid}/view` unbound is a *valid* URL. Playwright
    // navigates to `/d/%7Buid%7D/view`: a real request to the wrong page, no
    // error raised, and whatever the assertion then says is about a page the
    // recording never visited.
    const reqs = deriveRequiredParams([
      step(0, {
        type: "navigate",
        url_template: "http://localhost:3000/d/{dash_uid}/view",
        locator_fallback_chain: [],
      }),
    ]);
    expect(names(reqs)).toEqual([["dash_uid"]]);
  });

  it("requires a hole in a templated press key", () => {
    const reqs = deriveRequiredParams([
      step(0, { type: "press", key: "{key}", locator_fallback_chain: [] }),
    ]);
    expect(names(reqs)).toEqual([["key"]]);
  });

  it("requires the param_refs of a value-carrying action", () => {
    const reqs = deriveRequiredParams([
      step(0, { type: "fill", param_refs: ["panel_title"], locator_fallback_chain: [] }),
      step(1, { type: "select", param_refs: ["datasource"], locator_fallback_chain: [] }),
      step(2, { type: "upload", param_refs: ["file_path"], locator_fallback_chain: [] }),
    ]);
    expect(names(reqs)).toEqual([["panel_title"], ["datasource"], ["file_path"]]);
  });

  it("treats a multi-ref chain as any-of, because that is what the action does", () => {
    // `firstParam()` returns the first *bound* ref, so either satisfies the
    // step. Flattening to "all of them" would refuse a program that runs.
    const reqs = deriveRequiredParams([
      step(0, { type: "fill", param_refs: ["title", "name"], locator_fallback_chain: [] }),
    ]);
    expect(names(reqs)).toEqual([["title", "name"]]);
    expect(unsatisfiedRequirements(reqs, { name: "x" })).toEqual([]);
    expect(unsatisfiedRequirements(reqs, { title: "x" })).toEqual([]);
    expect(unsatisfiedRequirements(reqs, { other: "x" })).toHaveLength(1);
  });

  it("does not require a wait's param_refs — an unbound wait is not an error", () => {
    // A recorded wait_ms takes precedence (ADR-0008), and with neither the step
    // falls back to the bounded networkidle hint. Requiring it would refuse
    // programs that replay correctly today.
    const reqs = deriveRequiredParams([
      step(0, { type: "wait", param_refs: ["ms"], locator_fallback_chain: [] }),
      step(1, { type: "wait", wait_ms: 150, param_refs: ["ms"], locator_fallback_chain: [] }),
    ]);
    expect(reqs).toEqual([]);
  });

  it("does not require a navigate's param_refs beyond what its template uses", () => {
    // The template is the ground truth; a ref listed but not interpolated is
    // inert, and demanding it would invent a requirement the run does not have.
    const reqs = deriveRequiredParams([
      step(0, {
        type: "navigate",
        url_template: "http://{host}/x",
        param_refs: ["host", "unused_legacy_ref"],
        locator_fallback_chain: [],
      }),
    ]);
    expect(names(reqs)).toEqual([["host"]]);
  });

  it("requires holes in an assertion template", () => {
    const reqs = deriveRequiredParams([
      step(0, { type: "click", locator_fallback_chain: [] }, {
        type: "text-matches",
        expected: { template: "Saved {resource_label}" },
      }),
    ]);
    expect(names(reqs)).toEqual([["resource_label"]]);
  });

  it("reads the regex_template when there is one, because that is what runs", () => {
    // The live gate bundle depends on this. Its url-matches assertions carry
    // `{dashboard_uid}` / `{dashboard_slug}` in a url_template that is never
    // evaluated — `evaluateAssertion` prefers regex_template — and those are
    // server-generated values no caller can bind. Requiring them would refuse
    // the only real bundle in the repo.
    const reqs = deriveRequiredParams([
      step(0, { type: "click", locator_fallback_chain: [] }, {
        type: "url-matches",
        target: { url_template: "http://{host}:{port}/d/{dashboard_uid}/{slug}" },
        expected: {
          template: "http://{host}:{port}/d/{dashboard_uid}/{slug}",
          regex_template: "^http://[^/?#]+:[^/?#]+/d/[^/?#]+/[^/?#]+$",
        },
      }),
    ]);
    expect(reqs).toEqual([]);
  });

  it("reports a param used by many steps once, attributed to the first", () => {
    const nav = (i: number): CompiledStep =>
      step(i, {
        type: "navigate",
        url_template: "http://{host}/page",
        locator_fallback_chain: [],
      });
    const reqs = deriveRequiredParams([nav(0), nav(1), nav(2)]);
    expect(reqs).toEqual([{ any_of: ["host"], source: "step 0 url_template" }]);
  });
});

describe("ReplayRunner refuses an unbound program", () => {
  const unbound = program([
    step(0, {
      type: "navigate",
      url_template: "http://{host}:{port}/dashboard/new",
      locator_fallback_chain: [],
    }),
    step(1, { type: "fill", param_refs: ["panel_title"], locator_fallback_chain: [] }),
  ]);

  it("throws before step 0, naming every missing requirement", async () => {
    const runner = new ReplayRunner({ dryRun: true, dryRunOutcomes: ["PASS", "PASS"] });
    await expect(runner.run(unbound, { host: "127.0.0.1" })).rejects.toThrow(
      UnboundParamsError,
    );
    await expect(runner.run(unbound, { host: "127.0.0.1" })).rejects.toThrow(
      /port.*panel_title/s,
    );
  });

  it("emits no metrics at all — a refused run is absent, not failed", async () => {
    // The constraint that matters. `PAGE_ERROR` and `ASSERTION_FAILED` are the
    // §9 churn evidence; a caller error must not land in either denominator, and
    // the cleanest way to guarantee that is to produce no row to count.
    const metrics = new MetricsEmitter();
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: ["PASS", "PASS"],
      metrics,
    });
    await expect(runner.run(unbound, {})).rejects.toThrow(UnboundParamsError);
    expect(metrics.getRows()).toEqual([]);
  });

  it("names only parameters, never values", async () => {
    const runner = new ReplayRunner({ dryRun: true });
    const wantsSecretRef = program([
      step(0, { type: "fill", param_refs: ["api_token"], locator_fallback_chain: [] }),
    ]);
    let err: unknown;
    try {
      await runner.run(wantsSecretRef, { unrelated: "s3cret-value-never-logged" });
    } catch (caught) {
      err = caught;
    }
    expect(err).toBeInstanceOf(UnboundParamsError);
    expect((err as UnboundParamsError).message).toContain("api_token");
    expect((err as UnboundParamsError).message).not.toContain("s3cret-value-never-logged");
  });

  it("leaves a fully-bound program completely unaffected", async () => {
    const metrics = new MetricsEmitter();
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: ["PASS", "PASS"],
      metrics,
    });
    const result = await runner.run(unbound, {
      host: "127.0.0.1",
      port: 3000,
      panel_title: "CPU",
    });
    expect(result.task_success).toBe(true);
    expect(result.steps_replay_valid).toBe(2);
    expect(metrics.getRows()).toHaveLength(3); // two steps + one run row
  });

  it("does not refuse a program that needs nothing bound", async () => {
    const runner = new ReplayRunner({ dryRun: true, dryRunOutcomes: ["PASS"] });
    const bare = program([step(0, { type: "click", locator_fallback_chain: [] })]);
    await expect(runner.run(bare, {})).resolves.toMatchObject({ task_success: true });
  });
});

describe("required_params travels on the program", () => {
  const bundle = {
    bundle_kind: "compiled_trajectory",
    source_trajectory_id: "traj-x",
    site_key: "grafana-oss@127.0.0.1:3000",
    task_key: "create-dashboard",
    rows: [
      {
        step_index: 1,
        row_id: "r1",
        compiled_action: { type: "fill", param_refs: ["title"], locator_fallback_chain: [] },
        assertion: assertion({ assertion_id: "a2" }),
      },
      {
        step_index: 0,
        row_id: "r0",
        compiled_action: {
          type: "navigate",
          url_template: "http://{host}:{port}/",
          locator_fallback_chain: [],
        },
        assertion: assertion({ assertion_id: "a1" }),
      },
    ],
  } as unknown as CompiledTrajectoryBundle;

  it("is derived once by bundleToProgram, in sorted step order", () => {
    const p = bundleToProgram(bundle, "9.5.21");
    expect(names(p.required_params!)).toEqual([["host"], ["port"], ["title"]]);
    expect(p.required_params![0]!.source).toBe("step 0 url_template");
  });

  it("falls back to deriving when a program carries none", () => {
    // The guarantee cannot depend on which code path built the program — the
    // same reason trajectory discovery is shape-based rather than
    // location-based (#116). A hand-built program is validated identically.
    const handBuilt = program([
      step(0, {
        type: "navigate",
        url_template: "http://{host}/",
        locator_fallback_chain: [],
      }),
    ]);
    expect(handBuilt.required_params).toBeUndefined();
    expect(names(programRequirements(handBuilt))).toEqual([["host"]]);
  });

  it("prefers what the program records over re-deriving", () => {
    const p = { ...program([]), required_params: [{ any_of: ["pinned"], source: "recorded" }] };
    expect(names(programRequirements(p))).toEqual([["pinned"]]);
  });
});

describe("interpolate still leaves an unbound hole intact", () => {
  it("is unchanged as a string function", () => {
    // #122 item 4: with run() refusing first, reaching here unbound is an
    // internal invariant violation rather than a user error. It stays
    // non-throwing because callers legitimately hold partial bindings —
    // deriveRequiredParams reads these same templates with none at all.
    expect(interpolate("http://{host}/{path}", { host: "h" })).toBe("http://h/{path}");
    expect(interpolate("{a}", {})).toBe("{a}");
  });
});
