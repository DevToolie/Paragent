import { writeFile } from "node:fs/promises";
import type { Locator, Page } from "playwright";
import { captureFingerprint } from "./fingerprint.js";
import { collectLocatorCandidates } from "./locators.js";
import {
  assertNoLiteralSecrets,
  inferParamType,
  resolveTemplate,
  templatizeUrl,
} from "./redact.js";
import {
  TRAJECTORY_SCHEMA_VERSION,
  type AssertionHint,
  type ParamType,
  type RecordSessionOptions,
  type Step,
  type Trajectory,
} from "./types.js";

export const PACKAGE = "recorder" as const;
export const RECORDER_VERSION = "0.1.0-b2" as const;

/**
 * Instruments a Playwright Page into contracts/trajectory.schema.json.
 * Typed values drive Playwright only — never written to JSON.
 */
export class TrajectoryRecorder {
  readonly page: Page;
  private readonly options: RecordSessionOptions;
  private readonly parameters: Record<string, ParamType>;
  private readonly bindings: Record<string, string | number | boolean>;
  private readonly steps: Step[] = [];
  private readonly startedAt = Date.now();
  private stepIndex = 0;

  constructor(page: Page, options: RecordSessionOptions) {
    this.page = page;
    this.options = options;
    this.parameters = { ...(options.parameters ?? {}) };
    this.bindings = { ...(options.bindings ?? {}) };
  }

  declareParam(name: string, type: ParamType, binding?: string | number | boolean): void {
    this.parameters[name] = type;
    if (binding !== undefined) this.bindings[name] = binding;
  }

  private ensureParam(name: string, sample?: unknown): void {
    if (!(name in this.parameters)) {
      this.parameters[name] = inferParamType(name, sample);
    }
  }

  private offsetMs(): number {
    return Math.max(0, Date.now() - this.startedAt);
  }

  private async fingerprint(awaitNetworkIdle = false) {
    return captureFingerprint(this.page, {
      bindings: this.bindings,
      awaitNetworkIdle,
    });
  }

  private async recordStep(args: {
    intent: string;
    action: Step["action"];
    locator?: Locator;
    run: () => Promise<void>;
    assertion_hint?: AssertionHint;
    awaitNetworkIdle?: boolean;
  }): Promise<void> {
    const started = this.offsetMs();
    const pre_state = await this.fingerprint(false);
    const locator_candidates = args.locator
      ? await collectLocatorCandidates(args.locator)
      : [];
    await args.run();

    // ADR-0007: observe whether the acted-on control survived the action, before
    // anything else can change the page. Playwright's isVisible() is used rather
    // than a DOM predicate because src/runner/assertions.ts later checks this
    // same target with waitFor({ state: "hidden" | "visible" }) — recording the
    // observation the runner will make is what keeps the two honest.
    // A control that hides itself (dismiss, close, collapse) is otherwise
    // indistinguishable from one that stays, and gets asserted as still visible.
    let post_action_target_visible: boolean | undefined;
    if (args.locator) {
      post_action_target_visible = await args.locator
        .isVisible()
        .catch(() => false);
    }

    const post_state = await this.fingerprint(args.awaitNetworkIdle ?? true);
    const duration_ms = Math.max(0, this.offsetMs() - started);
    const step: Step = {
      step_index: this.stepIndex++,
      intent: args.intent,
      action: args.action,
      locator_candidates,
      pre_state,
      post_state,
      timing_ms: { started_offset_ms: started, duration_ms },
    };
    if (args.assertion_hint) step.assertion_hint = args.assertion_hint;
    if (post_action_target_visible !== undefined) {
      step.post_action_target_visible = post_action_target_visible;
    }
    this.steps.push(step);
  }

  async navigate(urlTemplate: string, intent: string, paramRefs: string[] = []): Promise<void> {
    for (const p of paramRefs) this.ensureParam(p);
    const resolved = resolveTemplate(urlTemplate, this.bindings);
    const holeRefs = [...urlTemplate.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)].map((m) => m[1]!);
    const refs = [...new Set([...paramRefs, ...holeRefs])];
    for (const p of refs) this.ensureParam(p);
    await this.recordStep({
      intent,
      action: { type: "navigate", url_template: urlTemplate, param_refs: refs },
      awaitNetworkIdle: true,
      assertion_hint: {
        suggested_type: "url-matches",
        observed_signals: ["navigation completed"],
      },
      run: async () => {
        await this.page.goto(resolved, { waitUntil: "domcontentloaded" });
      },
    });
  }

  async click(locator: Locator, intent: string): Promise<void> {
    await this.recordStep({
      intent,
      action: { type: "click" },
      locator,
      assertion_hint: {
        suggested_type: "element-visible",
        observed_signals: ["click target resolved"],
      },
      run: async () => {
        await locator.click();
      },
    });
  }

  async fill(locator: Locator, paramName: string, value: string, intent: string): Promise<void> {
    this.ensureParam(paramName, value);
    await this.recordStep({
      intent,
      action: { type: "fill", param_refs: [paramName] },
      locator,
      assertion_hint: {
        suggested_type: "element-value-bound",
        observed_signals: [`param slot ${paramName} filled`],
      },
      run: async () => {
        await locator.fill(value);
      },
    });
  }

  async select(locator: Locator, paramName: string, value: string, intent: string): Promise<void> {
    this.ensureParam(paramName, value);
    await this.recordStep({
      intent,
      action: { type: "select", param_refs: [paramName] },
      locator,
      run: async () => {
        await locator.selectOption(value);
      },
    });
  }

  async check(locator: Locator, intent: string): Promise<void> {
    await this.recordStep({
      intent,
      action: { type: "check" },
      locator,
      run: async () => {
        await locator.check();
      },
    });
  }

  async uncheck(locator: Locator, intent: string): Promise<void> {
    await this.recordStep({
      intent,
      action: { type: "uncheck" },
      locator,
      run: async () => {
        await locator.uncheck();
      },
    });
  }

  async press(key: string, intent: string, locator?: Locator): Promise<void> {
    const args: {
      intent: string;
      action: Step["action"];
      locator?: Locator;
      run: () => Promise<void>;
    } = {
      intent,
      action: { type: "press", key },
      run: async () => {
        if (locator) await locator.press(key);
        else await this.page.keyboard.press(key);
      },
    };
    if (locator) args.locator = locator;
    await this.recordStep(args);
  }

  async hover(locator: Locator, intent: string): Promise<void> {
    await this.recordStep({
      intent,
      action: { type: "hover" },
      locator,
      run: async () => {
        await locator.hover();
      },
    });
  }

  async wait(intent: string, ms: number): Promise<void> {
    await this.recordStep({
      intent,
      action: { type: "wait" },
      awaitNetworkIdle: false,
      run: async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, ms));
      },
    });
  }

  currentUrlTemplate(): string {
    return templatizeUrl(this.page.url(), this.bindings).template;
  }

  toTrajectory(): Trajectory {
    if (this.steps.length === 0) throw new Error("Cannot emit trajectory with zero steps");
    const provenance = { ...this.options.provenance };
    if (!provenance.recorder) provenance.recorder = RECORDER_VERSION;
    return {
      schema_version: TRAJECTORY_SCHEMA_VERSION,
      trajectory_id: this.options.trajectory_id,
      site_key: this.options.site_key,
      task_key: this.options.task_key,
      recorded_at: new Date().toISOString(),
      base_url_template: this.options.base_url_template,
      provenance,
      parameters: { ...this.parameters },
      steps: this.steps.map((s) => structuredClone(s)),
    };
  }

  async write(outPath: string): Promise<Trajectory> {
    const traj = this.toTrajectory();
    const text = `${JSON.stringify(traj, null, 2)}\n`;
    assertNoLiteralSecrets(text);
    await writeFile(outPath, text, "utf8");
    return traj;
  }
}
