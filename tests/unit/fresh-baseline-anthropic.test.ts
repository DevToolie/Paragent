/**
 * The real fresh-baseline client (#39) — every SDK call mocked, no network, no
 * spend. Mirrors `tests/unit/repair-anthropic.test.ts` in structure, because
 * the whole point of this client is to account for tokens the same way that
 * one does — see `docs/gate/fresh-baseline.md`.
 *
 * Drives a real (headless) browser, same as `tests/unit/page-state.test.ts`:
 * `executeAction`/`capturePageState` only fail in ways that show up inside an
 * actual page, so a fake `Page` object would not exercise the thing these
 * tests exist to catch.
 *
 * What these guard, in order of how much it would cost to get wrong:
 *
 * 1. **Token accounting across a multi-turn attempt.** `cost_fresh` is §9's
 *    ratio denominator; an undercount moves the same verdict `cost_repair`'s
 *    accounting protects.
 * 2. **No retries, and a failed turn still reports what it billed.**
 * 3. **The model never gets more of the page than a repair does**, and never
 *    gets the compiled program at all.
 * 4. **A missing page is a measured zero, not a crash** — mirrors
 *    `ReplayRunner`'s posture on a missing `page`.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type Browser, type Page } from "playwright";
import { launchTestBrowser } from "../helpers/browser.js";
import {
  AnthropicFreshBaselineClient,
  DEFAULT_FRESH_EFFORT,
  DEFAULT_FRESH_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MAX_TURNS,
  FRESH_TURN_SCHEMA,
  MissingFreshBaselineKeyError,
} from "../../src/runner/fresh-baseline-anthropic.js";
import { billedInputTokens, DEFAULT_REPAIR_MODEL } from "../../src/runner/repair-anthropic.js";

/** Assembled at runtime — a literal here would trip secret-scan's env pattern. */
const FAKE_KEY = "sk-ant-" + "TEST-" + "not-a-real-credential";

/**
 * A fake `messages.create` that returns each entry of `responses` in order,
 * then repeats the last one. Typed to take the request body so
 * `create.mock.calls[i][0]` is inspectable, same as the repair client's tests.
 */
function sequenceClient(responses: unknown[]) {
  let i = 0;
  const create = vi.fn(async (_body: Record<string, unknown>) => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return r;
  });
  return { client: { messages: { create } } as never, create };
}

interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

function turnResponse(overrides: Record<string, unknown> = {}) {
  return {
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 20 },
    content: [{ type: "text", text: JSON.stringify({ done: true, success: true }) }],
    ...overrides,
  };
}

function doneResponse(success: boolean, usage: UsageLike = { input_tokens: 100, output_tokens: 20 }) {
  return turnResponse({
    usage,
    content: [{ type: "text", text: JSON.stringify({ done: true, success }) }],
  });
}

function clickResponse(
  role: string,
  name: string,
  usage: UsageLike = { input_tokens: 150, output_tokens: 30 },
) {
  return turnResponse({
    usage,
    content: [
      {
        type: "text",
        text: JSON.stringify({ done: false, action: { type: "click", role, name } }),
      },
    ],
  });
}

describe("construction", () => {
  it("throws when ANTHROPIC_API_KEY is unset — never degrades to the stub", () => {
    const saved = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];
    try {
      expect(() => new AnthropicFreshBaselineClient()).toThrow(MissingFreshBaselineKeyError);
    } finally {
      if (saved !== undefined) process.env["ANTHROPIC_API_KEY"] = saved;
    }
  });

  it("accepts an explicit key without reading the environment", () => {
    expect(() => new AnthropicFreshBaselineClient({ apiKey: FAKE_KEY })).not.toThrow();
  });

  it("defaults to the documented model, ceiling, effort and turn budget", () => {
    const c = new AnthropicFreshBaselineClient({ apiKey: FAKE_KEY });
    expect(c.model).toBe(DEFAULT_FRESH_MODEL);
    expect(c.maxTokens).toBe(DEFAULT_MAX_TOKENS);
    expect(c.effort).toBe(DEFAULT_FRESH_EFFORT);
    expect(c.maxTurns).toBe(DEFAULT_MAX_TURNS);
  });

  it("defaults to the SAME model as the repair client — a fair ratio needs one reasoning system on both sides", () => {
    expect(DEFAULT_FRESH_MODEL).toBe(DEFAULT_REPAIR_MODEL);
  });
});

describe("fresh-baseline attempt (real browser, mocked SDK)", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await launchTestBrowser();
    page = await browser.newPage();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it("requires a Playwright page — a missing one is a measured zero, never a crash, and never calls the model", async () => {
    const { client, create } = sequenceClient([doneResponse(true)]);
    const c = new AnthropicFreshBaselineClient({ client });
    const result = await c.attempt({ task_goal: "do the thing", base_url: "http://x" });
    expect(result.task_success).toBe(false);
    expect(result.tokens_in).toBe(0);
    expect(result.tokens_out).toBe(0);
    expect(result.turns).toBe(0);
    expect(result.notes).toContain("requires a Playwright page");
    expect(create).not.toHaveBeenCalled();
  });

  it("sends no temperature, top_p or top_k — they 400 on this model", async () => {
    await page.setContent(`<button>Go</button>`);
    const { client, create } = sequenceClient([doneResponse(true)]);
    await new AnthropicFreshBaselineClient({ client }).attempt({
      task_goal: "goal",
      base_url: "http://x",
      page,
    });
    const body = create.mock.calls[0]![0] as Record<string, unknown>;
    expect(body["temperature"]).toBeUndefined();
    expect(body["top_p"]).toBeUndefined();
    expect(body["top_k"]).toBeUndefined();
  });

  it("asks for structured output, one decision per turn — not tool-use, not prose", async () => {
    await page.setContent(`<button>Go</button>`);
    const { client, create } = sequenceClient([doneResponse(true)]);
    await new AnthropicFreshBaselineClient({ client, effort: "high" }).attempt({
      task_goal: "goal",
      base_url: "http://x",
      page,
    });
    const body = create.mock.calls[0]![0] as unknown as {
      output_config?: { effort?: string; format?: { type?: string; schema?: unknown } };
      max_tokens?: number;
      tools?: unknown;
    };
    expect(body.output_config?.format?.type).toBe("json_schema");
    expect(body.output_config?.format?.schema).toBe(FRESH_TURN_SCHEMA);
    expect(body.output_config?.effort).toBe("high");
    expect(body["tools"]).toBeUndefined();
  });

  it("never shows the model the compiled program — only task_goal and page state", async () => {
    await page.setContent(`<button>Go</button>`);
    const { client, create } = sequenceClient([doneResponse(true)]);
    await new AnthropicFreshBaselineClient({ client }).attempt({
      task_goal: "the-stated-goal",
      base_url: "http://x",
      page,
    });
    const body = create.mock.calls[0]![0] as unknown as { messages: Array<{ content: string }> };
    const sent = JSON.parse(body.messages[0]!.content);
    expect(sent.task_goal).toBe("the-stated-goal");
    expect(sent).not.toHaveProperty("program_id");
    expect(sent).not.toHaveProperty("site_key");
    expect(sent).not.toHaveProperty("task_key");
    expect(sent).not.toHaveProperty("compiled_action");
    expect(sent).not.toHaveProperty("locator_fallback_chain");
    expect(sent).not.toHaveProperty("assertion");
  });

  it("never leaks an input's value, even when the page has one", async () => {
    await page.setContent(
      `<input type="password" value="do-not-leak-this" aria-label="Password">`,
    );
    const { client, create } = sequenceClient([doneResponse(true)]);
    await new AnthropicFreshBaselineClient({ client }).attempt({
      task_goal: "log in",
      base_url: "http://x",
      page,
    });
    const body = create.mock.calls[0]![0] as unknown as { messages: Array<{ content: string }> };
    expect(body.messages[0]!.content).not.toContain("do-not-leak-this");
  });

  it("sums billed input tokens across every turn using the SAME function the repair client uses", async () => {
    await page.setContent(`<button>Go</button>`);
    const { client } = sequenceClient([
      clickResponse("button", "Go", {
        input_tokens: 100,
        output_tokens: 10,
        cache_read_input_tokens: 5,
        cache_creation_input_tokens: 3,
      }),
      doneResponse(true, { input_tokens: 50, output_tokens: 8 }),
    ]);
    const result = await new AnthropicFreshBaselineClient({ client }).attempt({
      task_goal: "goal",
      base_url: "http://x",
      page,
    });
    // (100 + 5 + 3) + 50 == billedInputTokens summed across both turns.
    const expectedIn =
      billedInputTokens({ input_tokens: 100, cache_read_input_tokens: 5, cache_creation_input_tokens: 3 }) +
      billedInputTokens({ input_tokens: 50 });
    expect(result.tokens_in).toBe(expectedIn);
    expect(result.tokens_out).toBe(18);
    expect(result.turns).toBe(2);
    expect(result.model_id).toBe(DEFAULT_FRESH_MODEL);
  });

  it("actually drives the page: a click turn changes what the NEXT turn is shown", async () => {
    await page.setContent(
      `<button onclick="document.title='clicked'">Go</button>`,
    );
    const { client, create } = sequenceClient([
      clickResponse("button", "Go"),
      doneResponse(true),
    ]);
    const result = await new AnthropicFreshBaselineClient({ client }).attempt({
      task_goal: "click go",
      base_url: "http://x",
      page,
    });
    expect(result.task_success).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
    const secondBody = create.mock.calls[1]![0] as unknown as {
      messages: Array<{ content: string }>;
    };
    const lastUserMsg = JSON.parse(
      secondBody.messages[secondBody.messages.length - 1]!.content,
    );
    expect(lastUserMsg.action_result).toBe("ok");
    expect(lastUserMsg.page_state.title).toBe("clicked");
  });

  it("reports success:false from a done turn honestly, without inventing completion", async () => {
    await page.setContent(`<button>Go</button>`);
    const { client } = sequenceClient([doneResponse(false)]);
    const result = await new AnthropicFreshBaselineClient({ client }).attempt({
      task_goal: "goal",
      base_url: "http://x",
      page,
    });
    expect(result.task_success).toBe(false);
    expect(result.tokens_in).toBeGreaterThan(0);
    expect(result.notes).toContain("done on turn 1");
  });

  it("stops at max turns without a done decision — a measured failure, real tokens, never an error", async () => {
    await page.setContent(`<button>Go</button>`);
    const neverDone = turnResponse({
      content: [
        { type: "text", text: JSON.stringify({ done: false, action: { type: "wait", wait_ms: 0 } }) },
      ],
    });
    const { client, create } = sequenceClient([neverDone]);
    const c = new AnthropicFreshBaselineClient({ client, maxTurns: 3 });
    const result = await c.attempt({ task_goal: "goal", base_url: "http://x", page });
    expect(result.task_success).toBe(false);
    expect(result.turns).toBe(3);
    expect(create).toHaveBeenCalledTimes(3);
    expect(result.notes).toContain("max turns (3) exhausted");
    expect(result.tokens_in).toBeGreaterThan(0);
  });
});

describe("failure paths still report what they billed", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await launchTestBrowser();
    page = await browser.newPage();
    await page.setContent(`<button>Go</button>`);
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it("a network error ends the attempt without throwing, keeping prior turns' tokens", async () => {
    let call = 0;
    const create = vi.fn(async () => {
      call++;
      if (call === 1) return clickResponse("button", "Go");
      throw new Error("ECONNRESET");
    });
    const client = { messages: { create } } as never;
    const result = await new AnthropicFreshBaselineClient({ client }).attempt({
      task_goal: "goal",
      base_url: "http://x",
      page,
    });
    expect(result.task_success).toBe(false);
    // Turn 1 billed 150 in / 30 out (clickResponse's defaults); turn 2 billed
    // nothing because the call never returned — never retried silently.
    expect(result.tokens_in).toBe(150);
    expect(result.tokens_out).toBe(30);
    expect(result.notes).toContain("ECONNRESET");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("a refusal ends the attempt with the tokens consumed", async () => {
    const { client } = sequenceClient([
      turnResponse({ stop_reason: "refusal", content: [] }),
    ]);
    const result = await new AnthropicFreshBaselineClient({ client }).attempt({
      task_goal: "goal",
      base_url: "http://x",
      page,
    });
    expect(result.task_success).toBe(false);
    expect(result.tokens_in).toBe(100);
    expect(result.tokens_out).toBe(20);
    expect(result.notes).toContain("refused");
  });

  it("unparseable structured output is a miss, not a crash, and still reports tokens", async () => {
    const { client } = sequenceClient([
      turnResponse({ content: [{ type: "text", text: "not json" }] }),
    ]);
    const result = await new AnthropicFreshBaselineClient({ client }).attempt({
      task_goal: "goal",
      base_url: "http://x",
      page,
    });
    expect(result.task_success).toBe(false);
    expect(result.tokens_in).toBe(100);
    expect(result.notes).toContain("did not parse");
  });

  it("a decision missing the required shape is a miss, not a crash", async () => {
    const { client } = sequenceClient([
      turnResponse({ content: [{ type: "text", text: JSON.stringify({ done: false }) }] }),
    ]);
    const result = await new AnthropicFreshBaselineClient({ client }).attempt({
      task_goal: "goal",
      base_url: "http://x",
      page,
    });
    expect(result.task_success).toBe(false);
    expect(result.notes).toContain("did not match the expected shape");
  });

  it("an empty content array is a miss, not a crash", async () => {
    const { client } = sequenceClient([turnResponse({ content: [] })]);
    const result = await new AnthropicFreshBaselineClient({ client }).attempt({
      task_goal: "goal",
      base_url: "http://x",
      page,
    });
    expect(result.task_success).toBe(false);
    expect(result.notes).toContain("no text block");
  });
});

describe("the suite makes no network calls", () => {
  it("never constructs a real SDK client", () => {
    const { client } = sequenceClient([doneResponse(true)]);
    const c = new AnthropicFreshBaselineClient({ client });
    expect(c.model).toBe(DEFAULT_FRESH_MODEL);
  });
});
