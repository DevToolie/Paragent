/**
 * FreshBaselineRunner (#39) — the orchestration layer around any
 * `FreshBaselineClient`, tested with a hand-written fake so none of this
 * needs the Anthropic SDK or a browser (that's `fresh-baseline-anthropic.test.ts`).
 *
 * What these guard:
 *
 * 1. **Cost mapping** — a client's `FreshBaselineAttempt` becomes a `Cost` with
 *    the measured wall-clock spliced in (the client never sees its own clock).
 * 2. **`model_id` propagation** onto the emitted row.
 * 3. **A failed attempt emits zeros with an explicit note — never partial
 *    garbage** — the case issue #39 calls out by name.
 * 4. **The row shape**: honest zeros on the fields that do not apply to a
 *    fresh attempt (`steps_total`, `cost_replay`, `cost_repair`), and that
 *    `cost_fresh` — not `cost_replay` — carries the measured cost.
 */

import { describe, expect, it } from "vitest";
import { FreshBaselineRunner } from "../../src/runner/fresh-baseline-runner.js";
import { StubFreshBaselineClient, type FreshBaselineAttempt, type FreshBaselineClient, type FreshBaselineContext } from "../../src/runner/fresh-baseline.js";
import { MetricsEmitter } from "../../src/metrics/emitter.js";
import type { RunMetric } from "../../src/metrics/types.js";

function baseContext(overrides: Partial<Parameters<FreshBaselineRunner["run"]>[0]> = {}) {
  return {
    site_key: "grafana-oss@9.5.21",
    task_key: "create-stat-dashboard-from-testdata",
    testbed_version: "9.5.21",
    task_goal: "build and save a dashboard",
    base_url: "http://127.0.0.1:3000",
    ...overrides,
  };
}

/** A client whose next `attempt()` result (or throw) is configured per test. */
class FakeClient implements FreshBaselineClient {
  constructor(
    private readonly behavior: (ctx: FreshBaselineContext) => Promise<FreshBaselineAttempt>,
  ) {}
  attempt(ctx: FreshBaselineContext): Promise<FreshBaselineAttempt> {
    return this.behavior(ctx);
  }
}

function onlyRow(emitter: MetricsEmitter): RunMetric {
  const rows = emitter.getRows();
  expect(rows.length).toBe(1);
  return rows[0] as RunMetric;
}

describe("cost mapping", () => {
  it("maps a client's reported tokens onto cost_fresh, with the runner's own measured wall-clock", async () => {
    const client = new FakeClient(async () => ({
      task_success: true,
      tokens_in: 1234,
      tokens_out: 567,
      model_id: "claude-opus-5",
      turns: 4,
      notes: "done on turn 4",
    }));
    const emitter = new MetricsEmitter();
    const runner = new FreshBaselineRunner({ client, metrics: emitter });
    const result = await runner.run(baseContext());

    expect(result.cost_fresh.tokens_in).toBe(1234);
    expect(result.cost_fresh.tokens_out).toBe(567);
    // Measured by the runner around the call, not supplied by the client.
    expect(result.cost_fresh.wall_clock_ms).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.cost_fresh.wall_clock_ms)).toBe(true);
    expect(result.turns).toBe(4);
    expect(result.task_success).toBe(true);

    const row = onlyRow(emitter);
    expect(row.cost_fresh.tokens_in).toBe(1234);
    expect(row.cost_fresh.tokens_out).toBe(567);
    expect(row.cost_fresh.model_id).toBe("claude-opus-5");
  });

  it("clamps a malformed client response instead of letting garbage into a Cost", async () => {
    const client = new FakeClient(async () => ({
      task_success: false,
      tokens_in: -5,
      tokens_out: Number.NaN,
      turns: -1,
    }));
    const emitter = new MetricsEmitter();
    const runner = new FreshBaselineRunner({ client, metrics: emitter });
    const result = await runner.run(baseContext());
    expect(result.cost_fresh.tokens_in).toBe(0);
    expect(result.cost_fresh.tokens_out).toBe(0);
    expect(result.turns).toBe(0);
  });
});

describe("model_id propagation", () => {
  it("carries model_id from the attempt onto the emitted RunMetric row", async () => {
    const client = new FakeClient(async () => ({
      task_success: true,
      tokens_in: 10,
      tokens_out: 5,
      model_id: "claude-opus-5",
      turns: 1,
    }));
    const emitter = new MetricsEmitter();
    const runner = new FreshBaselineRunner({ client, metrics: emitter });
    await runner.run(baseContext());
    expect(onlyRow(emitter).cost_fresh.model_id).toBe("claude-opus-5");
  });

  it("omits model_id rather than inventing one when the client did not report it", async () => {
    const client = new FakeClient(async () => ({
      task_success: false,
      tokens_in: 0,
      tokens_out: 0,
      turns: 0,
    }));
    const emitter = new MetricsEmitter();
    const runner = new FreshBaselineRunner({ client, metrics: emitter });
    await runner.run(baseContext());
    expect(onlyRow(emitter).cost_fresh.model_id).toBeUndefined();
  });
});

describe("a failed fresh run emits zeros with an explicit note, never partial garbage", () => {
  it("a client that throws produces an all-zero cost_fresh and a note explaining why", async () => {
    const client = new FakeClient(async () => {
      throw new Error("page crashed mid-attempt");
    });
    const emitter = new MetricsEmitter();
    const runner = new FreshBaselineRunner({ client, metrics: emitter });
    const result = await runner.run(baseContext());

    expect(result.task_success).toBe(false);
    expect(result.cost_fresh).toEqual({ tokens_in: 0, tokens_out: 0, wall_clock_ms: 0 });
    expect(result.turns).toBe(0);
    expect(result.notes).toContain("threw before it could be measured");
    expect(result.notes).toContain("page crashed mid-attempt");

    const row = onlyRow(emitter);
    expect(row.cost_fresh).toEqual({ tokens_in: 0, tokens_out: 0, wall_clock_ms: 0 });
    expect(row.task_success).toBe(false);
    // The note is never on the schema-strict row — RunMetric has no field for
    // free text. It lives only in the return value, for the caller's ledger.
    expect(Object.keys(row)).not.toContain("notes");
  });

  it("StubFreshBaselineClient's own honest failure is zeros too — never a silent success", async () => {
    const emitter = new MetricsEmitter();
    const runner = new FreshBaselineRunner({ client: new StubFreshBaselineClient(), metrics: emitter });
    const result = await runner.run(baseContext());
    expect(result.task_success).toBe(false);
    expect(result.cost_fresh).toEqual({ tokens_in: 0, tokens_out: 0, wall_clock_ms: 0 });
    expect(result.notes).toContain("no model wired");
  });

  it("a rejected promise (not an Error instance) still produces zeros, not a crash", async () => {
    const client = new FakeClient(async () => {
      throw "a bare string rejection";
    });
    const emitter = new MetricsEmitter();
    const runner = new FreshBaselineRunner({ client, metrics: emitter });
    const result = await runner.run(baseContext());
    expect(result.cost_fresh).toEqual({ tokens_in: 0, tokens_out: 0, wall_clock_ms: 0 });
    expect(result.notes).toContain("a bare string rejection");
  });
});

describe("the emitted row shape", () => {
  it("carries the measured cost on cost_fresh, and honest zeros on cost_replay/cost_repair — a fresh attempt is not a replay", async () => {
    const client = new FakeClient(async () => ({
      task_success: true,
      tokens_in: 900,
      tokens_out: 100,
      turns: 6,
    }));
    const emitter = new MetricsEmitter();
    const runner = new FreshBaselineRunner({ client, metrics: emitter });
    await runner.run(baseContext());
    const row = onlyRow(emitter);

    expect(row.cost_fresh.tokens_in).toBe(900);
    expect(row.cost_replay).toEqual({ tokens_in: 0, tokens_out: 0, wall_clock_ms: 0 });
    expect(row.cost_repair).toEqual({ tokens_in: 0, tokens_out: 0, wall_clock_ms: 0 });
    expect(row.repair_count).toBe(0);
    expect(row.steps_total).toBe(0);
    expect(row.steps_replay_valid).toBe(0);
    expect(row.self_healed).toBe(false);
    expect(row.metric_kind).toBe("run");
    expect(row.site_key).toBe("grafana-oss@9.5.21");
    expect(row.task_key).toBe("create-stat-dashboard-from-testdata");
    expect(row.testbed_version).toBe("9.5.21");
  });

  it("wall_clock_total_ms mirrors cost_fresh.wall_clock_ms — the whole attempt IS the fresh cost", async () => {
    const client = new FakeClient(async () => ({
      task_success: true,
      tokens_in: 1,
      tokens_out: 1,
      turns: 1,
    }));
    const emitter = new MetricsEmitter();
    const runner = new FreshBaselineRunner({ client, metrics: emitter });
    await runner.run(baseContext());
    const row = onlyRow(emitter);
    expect(row.wall_clock_total_ms).toBe(row.cost_fresh.wall_clock_ms);
  });

  it("uses the caller-supplied run_id when given one, else generates one", async () => {
    const client = new FakeClient(async () => ({
      task_success: true,
      tokens_in: 1,
      tokens_out: 1,
      turns: 1,
    }));
    const emitter = new MetricsEmitter();
    const runner = new FreshBaselineRunner({ client, metrics: emitter });
    const result = await runner.run(baseContext(), "explicit-run-id");
    expect(result.run_id).toBe("explicit-run-id");
    expect(onlyRow(emitter).run_id).toBe("explicit-run-id");
  });
});

describe("defaults", () => {
  it("defaults to StubFreshBaselineClient and its own MetricsEmitter", async () => {
    const runner = new FreshBaselineRunner();
    const result = await runner.run(baseContext());
    expect(result.task_success).toBe(false);
    expect(runner.getMetricsEmitter().getRows().length).toBe(1);
  });
});
