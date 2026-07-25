import { pickPrimaryLocator } from "./locators.js";
import { hasTemplateHoles, looksLikeTenantLiteral } from "./literals.js";
import type {
  Assertion,
  AssertionType,
  CompiledLocator,
  ParamType,
  Trajectory,
  TrajectoryStep,
} from "./types.js";
import { SCHEMA_VERSION } from "./types.js";

const ASSERTION_TYPES = new Set<AssertionType>([
  "element-visible",
  "text-matches",
  "url-matches",
  "count-equals",
  "network-idle",
  "custom",
]);

function extractParamTypes(
  template: string,
  trajectoryParams: Record<string, ParamType>,
): Record<string, ParamType> | undefined {
  const holes = [...template.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)].map(
    (m) => m[1]!,
  );
  if (holes.length === 0) return undefined;
  const param_types: Record<string, ParamType> = {};
  for (const name of holes) {
    param_types[name] = trajectoryParams[name] ?? "string";
  }
  return param_types;
}

function urlChanged(step: TrajectoryStep): boolean {
  return step.pre_state.url_template !== step.post_state.url_template;
}

function newLandmarks(step: TrajectoryStep): string[] {
  const pre = new Set(step.pre_state.visible_landmarks ?? []);
  return (step.post_state.visible_landmarks ?? []).filter((l) => !pre.has(l));
}

function signalMentions(
  signals: string[] | undefined,
  ...needles: string[]
): boolean {
  if (!signals) return false;
  const joined = signals.join(" ").toLowerCase();
  return needles.some((n) => joined.includes(n.toLowerCase()));
}

function sanitizeTemplate(value: string): string {
  if (looksLikeTenantLiteral(value) && !hasTemplateHoles(value)) {
    return "{observed_text}";
  }
  return value;
}

function pickPreferredLandmark(landmarks: string[]): string | undefined {
  const preferred = ["form", "main", "dialog", "navigation", "banner"];
  for (const p of preferred) {
    if (landmarks.includes(p)) return p;
  }
  return landmarks[0];
}

function landmarkAsLocator(
  landmark: string | undefined,
): CompiledLocator | undefined {
  if (!landmark) return undefined;
  return { strategy: "role_name", role: landmark };
}

function stripTenantFlagForTarget(locator: CompiledLocator): CompiledLocator {
  if (locator.strategy === "topology_only") {
    return { strategy: "structural", structural_path: "body" };
  }
  const { tenant_scoped: _t, ...rest } = locator;
  return rest;
}

interface SynthesisContext {
  trajectory: Trajectory;
  step: TrajectoryStep;
  locatorChain: CompiledLocator[];
}

/** Synthesize one post-condition; expected values are templates with typed holes. */
export function synthesizeAssertion(ctx: SynthesisContext): Assertion {
  const { trajectory, step, locatorChain } = ctx;
  const hint = step.assertion_hint;
  const primary = pickPrimaryLocator(locatorChain);
  const assertionId = `assert-${trajectory.task_key}-step-${step.step_index}`;

  const suggested =
    hint?.suggested_type && ASSERTION_TYPES.has(hint.suggested_type as AssertionType)
      ? (hint.suggested_type as AssertionType)
      : undefined;

  const preferHintElement =
    suggested === "element-visible" &&
    (signalMentions(
      hint?.observed_signals,
      "visible",
      "appeared",
      "form",
      "login",
    ) ||
      newLandmarks(step).length > 0 ||
      primary !== undefined);

  if (
    suggested === "text-matches" ||
    signalMentions(
      hint?.observed_signals,
      "toast",
      "saved",
      "success",
      "notification",
    )
  ) {
    const template = "{success_message}";
    return {
      schema_version: SCHEMA_VERSION,
      assertion_id: assertionId,
      type: "text-matches",
      strength: "strong",
      expected: {
        template,
        param_types: { success_message: "string" },
        regex_template: templateToRegex(template),
      },
      timeout_ms: 5000,
      failure_classification: "assertion_failed",
      notes:
        "Recorder signalled toast/success copy. Expected text is a typed hole ({success_message}) — never a tenant/product-message literal. Strong when the runner binds a success-pattern allowlist; otherwise runtime bind quality is MED confidence.",
    };
  }

  if (
    suggested === "count-equals" ||
    signalMentions(hint?.observed_signals, "count", "rows", "items")
  ) {
    return {
      schema_version: SCHEMA_VERSION,
      assertion_id: assertionId,
      type: "count-equals",
      strength: "weak",
      target: {
        count_scope: primary?.css ?? primary?.structural_path ?? "main",
      },
      expected: {
        count: 0,
        template: "{item_count}",
        param_types: { item_count: "integer" },
      },
      timeout_ms: 5000,
      failure_classification: "assertion_failed",
      notes:
        "Count asserted via template hole. expected.count=0 is a schema placeholder until B2 emits structured counts in post_state; runner must bind the observed count. Labelled weak: absolute counts drift. Not a gate metric.",
    };
  }

  const wantsElement =
    preferHintElement ||
    suggested === "element-visible" ||
    newLandmarks(step).length > 0 ||
    signalMentions(hint?.observed_signals, "visible", "appeared", "form") ||
    (primary !== undefined &&
      ["click", "fill", "select", "check", "uncheck"].includes(
        step.action.type,
      ));

  /**
   * A click that changes the URL is evidenced by where it landed, not by the
   * control that was clicked.
   *
   * Asserting the clicked control is still visible is frequently *false*: the
   * transition routinely hides the surface the control lived on (submitting a
   * login form, closing a modal, navigating away). The post_state landmark
   * fallback does not rescue it either — `visible_landmarks` is collected by
   * walking the DOM without a visibility filter, so a hidden landmark still
   * appears there.
   *
   * Falling through to `url-matches` is both correct and stronger: the branch
   * below labels a URL-changing click `strong`.
   *
   * Caught by tests/integration/pipeline.test.ts, which replayed a compiled
   * login step against the fixture and timed out waiting for the submit button
   * to stay visible after it had been clicked.
   */
  const clickChangedUrl = step.action.type === "click" && urlChanged(step);

  if (wantsElement && !clickChangedUrl) {
    const landmarkPick =
      pickPreferredLandmark(newLandmarks(step)) ??
      (preferHintElement
        ? pickPreferredLandmark(step.post_state.visible_landmarks ?? [])
        : undefined);
    const locator = primary ?? landmarkAsLocator(landmarkPick);

    if (locator !== undefined || preferHintElement) {
      let strength: Assertion["strength"] = "weak";
      let notes =
        "Element visibility from hint/post-state; labelled weak unless stronger signals apply.";

      if (step.action.type === "fill" || step.action.type === "select") {
        strength = "weak";
        notes =
          "Fill/select cannot assert the typed value (values are param slots, never stored). Visibility of the target control is only weakly consistent with a successful fill.";
      } else if (
        newLandmarks(step).length > 0 &&
        suggested !== "element-visible"
      ) {
        strength = "weak";
        notes =
          "New landmark(s) in post_state are coarse structural signals — consistent with success but not unambiguous proof. Labelled weak.";
      }

      if (
        step.action.type === "navigate" &&
        (signalMentions(hint?.observed_signals, "form", "login") ||
          suggested === "element-visible")
      ) {
        strength = "strong";
        notes =
          "Presence of the login/control surface after navigate is strong evidence we reached the intended page (chrome locator, not tenant content).";
      }

      const resolved =
        locator ??
        ({ strategy: "role_name", role: "form" } satisfies CompiledLocator);

      return {
        schema_version: SCHEMA_VERSION,
        assertion_id: assertionId,
        type: "element-visible",
        strength,
        target: { locator: stripTenantFlagForTarget(resolved) },
        expected: { visible: true },
        timeout_ms: 5000,
        failure_classification: "assertion_failed",
        notes,
      };
    }
  }

  if (urlChanged(step) || suggested === "url-matches") {
    const url_template = sanitizeTemplate(step.post_state.url_template);
    const param_types = extractParamTypes(url_template, trajectory.parameters);
    const strong =
      step.action.type === "navigate" ||
      (urlChanged(step) && step.action.type === "click");

    const expected: NonNullable<Assertion["expected"]> = {
      template: url_template,
      regex_template: templateToRegex(url_template),
    };
    if (param_types) expected.param_types = param_types;

    return {
      schema_version: SCHEMA_VERSION,
      assertion_id: assertionId,
      type: "url-matches",
      strength: strong ? "strong" : "weak",
      target: { url_template },
      expected,
      timeout_ms: 5000,
      failure_classification: "assertion_failed",
      notes: strong
        ? "URL template changed (or navigate completed); matching post_state.url_template is strong evidence the step reached the intended surface."
        : "URL match observed but action type does not strongly imply navigation; labelled weak.",
    };
  }

  if (suggested === "network-idle" || step.post_state.network_idle === true) {
    return {
      schema_version: SCHEMA_VERSION,
      assertion_id: assertionId,
      type: "network-idle",
      strength: "weak",
      timeout_ms: 5000,
      failure_classification: "timeout",
      notes:
        "network_idle in post_state is weakly consistent with success — idle also occurs on error pages and no-ops. Labelled weak.",
    };
  }

  return {
    schema_version: SCHEMA_VERSION,
    assertion_id: assertionId,
    type: "custom",
    strength: "weak",
    expected: {
      custom_predicate_id: "post_digest_changed_or_stable",
      template: "{dom_digest}",
      param_types: { dom_digest: "string" },
    },
    timeout_ms: 5000,
    failure_classification: "unknown",
    notes:
      "No URL/landmark/toast/count/network signal strong enough to specialize. Weak custom digest check — blind spot: digests are not semantic assertions.",
  };
}

export function templateToRegex(template: string): string {
  const parts: string[] = [];
  let i = 0;
  while (i < template.length) {
    if (template[i] === "{") {
      const end = template.indexOf("}", i);
      if (end === -1) {
        parts.push(escapeRegex(template.slice(i)));
        break;
      }
      parts.push("[^/?#]+");
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < template.length && template[j] !== "{") j++;
    parts.push(escapeRegex(template.slice(i, j)));
    i = j;
  }
  return `^${parts.join("")}$`;
}

function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
