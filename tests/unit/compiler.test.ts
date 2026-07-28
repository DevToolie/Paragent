import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  compileTrajectory,
  DEFAULT_ASSERTION_TIMEOUT_MS,
  looksLikeTenantLiteral,
  orderLocatorCandidates,
  PACKAGE,
  validateCompiledBundle,
  type Trajectory,
} from "../../src/compiler/index.js";

describe("compiler package", () => {
  it("exports package id", () => {
    expect(PACKAGE).toBe("compiler");
  });
});

describe("locator preference order", () => {
  it("orders by B2 preference then rank", () => {
    const ordered = orderLocatorCandidates([
      { strategy: "structural", rank: 1 },
      { strategy: "role_name", rank: 2 },
      { strategy: "testid", rank: 1 },
      { strategy: "label", rank: 1 },
      { strategy: "text", rank: 1 },
    ]);
    expect(ordered.map((c) => c.strategy)).toEqual([
      "role_name",
      "label",
      "testid",
      "structural",
      "text",
    ]);
  });
});

describe("tenant literal heuristics", () => {
  it("flags emails and uuids; allows chrome labels and holes", () => {
    expect(looksLikeTenantLiteral("user@example.com")).toBe(true);
    expect(
      looksLikeTenantLiteral("550e8400-e29b-41d4-a716-446655440000"),
    ).toBe(true);
    expect(looksLikeTenantLiteral("Username")).toBe(false);
    expect(looksLikeTenantLiteral("http://{host}:{port}/login")).toBe(false);
  });
});

describe("click assertion target", () => {
  const fingerprint = (url: string, landmarks: string[]) => ({
    url_template: url,
    title_template: "Fixture",
    dom_digest: "digest",
    visible_landmarks: landmarks,
    network_idle: true,
  });

  const clickStep = (from: string, to: string) => ({
    step_index: 0,
    intent: "Submit login form",
    action: { type: "click" as const },
    locator_candidates: [
      { strategy: "role_name" as const, rank: 0, role: "button", name: "Log in" },
    ],
    pre_state: fingerprint(from, ["main", "form"]),
    post_state: fingerprint(to, ["main", "form"]),
    timing_ms: { started_offset_ms: 0, duration_ms: 5 },
    assertion_hint: {
      suggested_type: "element-visible",
      observed_signals: ["click target resolved"],
    },
  });

  const wrap = (step: Trajectory["steps"][number]): Trajectory => ({
    schema_version: "1.0.0",
    trajectory_id: "traj-click",
    site_key: "fixture@local",
    task_key: "click-task",
    recorded_at: "2026-07-25T00:00:00.000Z",
    base_url_template: "http://{host}:{port}/app",
    provenance: {
      recorder: "test",
      agent_model: "human",
      testbed_version: "fixture-v1",
    },
    parameters: { host: "string", port: "integer" },
    steps: [step],
  });

  it("uses the destination URL, not the clicked control, when a click navigates", () => {
    // Regression: the clicked control is routinely hidden by the very
    // transition being asserted (login submit hides the login form), so
    // "the button I clicked is still visible" is both weak and often false.
    const bundle = compileTrajectory(
      wrap(clickStep("http://{host}:{port}/app", "http://{host}:{port}/app#home")),
      { compiledAt: "2026-07-25T00:00:00.000Z" },
    );
    const assertion = bundle.rows[0]!.assertion;
    expect(assertion.type).toBe("url-matches");
    expect(assertion.strength).toBe("strong");
    expect(assertion.target?.url_template).toBe("http://{host}:{port}/app#home");
  });

  it("still asserts the control for a click that does not navigate", () => {
    const bundle = compileTrajectory(
      wrap(clickStep("http://{host}:{port}/app", "http://{host}:{port}/app")),
      { compiledAt: "2026-07-25T00:00:00.000Z" },
    );
    const assertion = bundle.rows[0]!.assertion;
    expect(assertion.type).toBe("element-visible");
    expect(assertion.target?.locator?.role).toBe("button");
    expect(assertion.expected?.visible).toBe(true);
  });

  // ADR-0007
  it("asserts the control is GONE when a non-navigating click hides it", () => {
    const step = {
      ...clickStep("http://{host}:{port}/app", "http://{host}:{port}/app"),
      post_action_target_visible: false,
    };
    const assertion = compileTrajectory(wrap(step), {
      compiledAt: "2026-07-25T00:00:00.000Z",
    }).rows[0]!.assertion;

    expect(assertion.type).toBe("element-visible");
    expect(assertion.expected?.visible).toBe(false);
    expect(assertion.target?.locator?.role).toBe("button");
    // Disappearance IS the purpose of a dismiss-shaped click, and this fails
    // on a no-op — so it is load-bearing, not merely consistent with success.
    expect(assertion.strength).toBe("strong");
  });

  it("prefers the destination when a click both navigates and hides its control", () => {
    const step = {
      ...clickStep("http://{host}:{port}/app", "http://{host}:{port}/app#home"),
      post_action_target_visible: false,
    };
    const assertion = compileTrajectory(wrap(step), {
      compiledAt: "2026-07-25T00:00:00.000Z",
    }).rows[0]!.assertion;

    // Where it landed is better evidence than what vanished.
    expect(assertion.type).toBe("url-matches");
    expect(assertion.strength).toBe("strong");
  });

  it("leaves fill steps alone even when the field is hidden afterwards", () => {
    const step = {
      ...clickStep("http://{host}:{port}/app", "http://{host}:{port}/app"),
      action: { type: "fill" as const, param_refs: ["q"] },
      post_action_target_visible: false,
    };
    const assertion = compileTrajectory(wrap(step), {
      compiledAt: "2026-07-25T00:00:00.000Z",
    }).rows[0]!.assertion;

    // The new branch is scoped to click-like actions; a fill that hides its
    // own field is not a pattern we have observed, so do not invent a rule.
    expect(assertion.expected?.visible).not.toBe(false);
  });
});

describe("assertion timeout policy", () => {
  // `timeout_ms` is an assertion-STRENGTH knob, not a perf one: a shorter
  // timeout is a stricter check. The runner spends it on failure, so it is also
  // the dominant term in worst-case replay latency. Nothing pinned the emitted
  // value before, which meant it could be "tuned" for speed and silently move
  // step-level replay-validity — the one number PRD §9 gates on.
  const trajectory = (): Trajectory => ({
    schema_version: "1.0.0",
    trajectory_id: "traj-timeout",
    site_key: "fixture@local",
    task_key: "timeout-task",
    recorded_at: "2026-07-25T00:00:00.000Z",
    base_url_template: "http://{host}:{port}/app",
    provenance: {
      recorder: "test",
      agent_model: "human",
      testbed_version: "fixture-v1",
    },
    parameters: { host: "string", port: "integer" },
    steps: [
      {
        step_index: 0,
        intent: "Open the app",
        action: { type: "navigate" as const, url_template: "http://{host}:{port}/app" },
        locator_candidates: [],
        pre_state: {
          url_template: "about:blank",
          title_template: "",
          dom_digest: "d0",
          visible_landmarks: [],
          network_idle: false,
        },
        post_state: {
          url_template: "http://{host}:{port}/app",
          title_template: "App",
          dom_digest: "d1",
          visible_landmarks: ["main"],
          network_idle: true,
        },
        timing_ms: { started_offset_ms: 0, duration_ms: 5 },
      },
    ],
  });

  it("emits the documented default on every assertion", () => {
    expect(DEFAULT_ASSERTION_TIMEOUT_MS).toBe(5000);
    const bundle = compileTrajectory(trajectory());
    for (const row of bundle.rows) {
      expect(row.assertion.timeout_ms).toBe(DEFAULT_ASSERTION_TIMEOUT_MS);
    }
  });

  it("can be overridden per compile without touching the default", () => {
    const bundle = compileTrajectory(trajectory(), { assertionTimeoutMs: 1234 });
    for (const row of bundle.rows) {
      expect(row.assertion.timeout_ms).toBe(1234);
    }
    // The override must not leak into the module-level policy.
    expect(DEFAULT_ASSERTION_TIMEOUT_MS).toBe(5000);
  });
});

describe("compileTrajectory example", () => {
  it("emits one asserted cache-row per step with no tenant literals", async () => {
    const trajPath = path.join(
      process.cwd(),
      "contracts/examples/trajectory.example.json",
    );
    const trajectory = JSON.parse(
      await readFile(trajPath, "utf8"),
    ) as Trajectory;

    const bundle = compileTrajectory(trajectory, {
      compiledAt: "2026-07-25T00:00:00.000Z",
      inputPath: "contracts/examples/trajectory.example.json",
    });

    expect(bundle.bundle_kind).toBe("compiled_trajectory");
    expect(bundle.rows).toHaveLength(trajectory.steps.length);

    for (const row of bundle.rows) {
      expect(
        row.assertion.strength === "strong" ||
          row.assertion.strength === "weak",
      ).toBe(true);
      expect(row.assertion.notes).toBeTruthy();
      expect(row.compiled_action.locator_fallback_chain).toBeDefined();
      if (row.pool_eligible === false) {
        expect(row.pool_ineligible_reason).toBeTruthy();
      } else {
        expect(row.pool_ineligible_reason).toBeNull();
      }
    }

    expect(["element-visible", "url-matches"]).toContain(
      bundle.rows[0]!.assertion.type,
    );
    expect(bundle.rows[0]!.assertion.strength).toBe("strong");
    expect(bundle.rows[0]!.compiled_action.locator_fallback_chain).toEqual([]);
    expect(bundle.rows[0]!.pool_eligible).toBe(true);

    expect(bundle.rows[1]!.assertion.type).toBe("element-visible");
    expect(bundle.rows[1]!.assertion.strength).toBe("weak");
    expect(
      bundle.rows[1]!.compiled_action.locator_fallback_chain[0]!.strategy,
    ).toBe("role_name");
    expect(bundle.rows[1]!.pool_eligible).toBe(true);

    const validation = await validateCompiledBundle(bundle);
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);
  });
});
