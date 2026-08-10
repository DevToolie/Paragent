/**
 * A parameterless `wait` step used to call `page.waitForLoadState("networkidle")`
 * with no timeout, inheriting Playwright's 30s default — a number nobody in this
 * repo chose. On a page that never goes quiet the step burned the full 30s and
 * then failed: maximum latency for zero information.
 *
 * The seeded Grafana dashboard is **not** such a page — `networkidle` settles on
 * `/d/paragent-seed` in ~3ms (measured on 11.0.0, 2026-07-28), because the seed
 * sets no refresh interval and TestData is generated client-side. The worst case
 * is latent, reachable on any surface with continuous polling, streaming or
 * websockets, so these tests build one on purpose rather than borrowing the
 * test-bed.
 *
 * Two things are under test, and they need different instruments:
 *   - the bound is real — only the clock separates "bounded" from "unbounded";
 *   - reaching the bound does not fail the step, and therefore does not spend
 *     repair budget on a condition no `corrected_action` can fix.
 */

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  executeAction,
  NETWORK_IDLE_WAIT_MS,
} from "../../src/runner/actions.js";
import { ReplayRunner } from "../../src/runner/replay.js";
import type {
  CompiledAction,
  CompiledProgram,
} from "../../src/runner/types.js";

/** A page whose in-flight request never resolves, so networkidle never fires. */
async function startNeverIdleServer(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((req, res) => {
    if ((req.url ?? "/").startsWith("/hang")) {
      // Deliberately never responds and never ends the socket.
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(
      `<!doctype html><html><body><h1>busy</h1>
       <script>
         // Keep at least one connection in flight forever.
         fetch('/hang').catch(() => {});
         setInterval(() => { fetch('/hang').catch(() => {}); }, 200);
       </script></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

const waitAction: CompiledAction = {
  type: "wait",
  locator_fallback_chain: [],
};

describe("bounded networkidle wait", () => {
  let browser: Browser;
  let server: Server;
  let baseUrl: string;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    ({ server, baseUrl } = await startNeverIdleServer());
    page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it("gives up at the configured bound instead of Playwright's 30s default", async () => {
    const started = Date.now();
    const result = await executeAction(page, waitAction, {}, {
      networkIdleWaitMs: 1_000,
    });
    const elapsed = Date.now() - started;

    // Proceeds rather than failing: the hint went unanswered, which is not the
    // same as the step being wrong. The assertion after it is the post-condition.
    expect(result.ok).toBe(true);
    expect(result.settled).toBe(false);
    expect(result.message).toMatch(/networkidle not reached/);
    // The load-bearing assertion. Unbounded, this takes ~30s; the generous
    // ceiling here still fails loudly if the bound is ever removed.
    expect(elapsed).toBeLessThan(10_000);
  }, 60_000);

  it("honours the default bound when no override is supplied", async () => {
    const started = Date.now();
    const result = await executeAction(page, waitAction);
    const elapsed = Date.now() - started;

    expect(result.settled).toBe(false);
    expect(elapsed).toBeLessThan(NETWORK_IDLE_WAIT_MS + 5_000);
  }, 60_000);

  it("pins the default bound", () => {
    // Changing this changes which steps pass — see the note on the constant.
    expect(NETWORK_IDLE_WAIT_MS).toBe(5_000);
  });

  it("reports settled=true when the page does go quiet", async () => {
    // Positive control: without this, `settled: false` could be a constant.
    const quiet = await browser.newPage();
    try {
      await quiet.setContent("<!doctype html><h1>quiet</h1>");
      const result = await executeAction(quiet, waitAction, {}, {
        networkIdleWaitMs: 5_000,
      });
      expect(result.ok).toBe(true);
      expect(result.settled).toBe(true);
      expect(result.message).toBeUndefined();
    } finally {
      await quiet.close();
    }
  }, 60_000);

  it("does not spend repair budget on a page that never goes quiet", async () => {
    // The reason the classification matters. Routed through the repair loop,
    // this step would burn both attempts and land on REPAIR_EXHAUSTED — and no
    // corrected_action can make a polling page go quiet, so the run's
    // success_with_le_2_repairs would be reporting scaffolding, not churn.
    const program: CompiledProgram = {
      schema_version: "1.0.0",
      program_id: "bounded-wait-probe",
      site_key: "local-never-idle",
      task_key: "wait-then-assert",
      testbed_version: "n/a",
      steps: [
        {
          step_index: 0,
          compiled_action: waitAction,
          assertion: {
            schema_version: "1.0.0",
            assertion_id: "a0",
            type: "element-visible",
            strength: "strong",
            target: { locator: { strategy: "text", text: "busy" } },
            expected: { visible: true },
            timeout_ms: 5_000,
            failure_classification: "assertion_failed",
          },
        },
      ],
    };

    const runner = new ReplayRunner({ page, networkIdleWaitMs: 1_000 });
    const result = await runner.run(program);

    expect(result.repair_count).toBe(0);
    expect(result.task_success).toBe(true);
    expect(result.steps_replay_valid).toBe(1);
    expect(result.step_results[0]?.outcome).toBe("PASS");
    // Passing is not the same as pretending it settled.
    expect(result.step_results[0]?.notes).toMatch(/networkidle not reached/);
  }, 60_000);

  it("still uses a plain sleep when the step carries a positive duration", async () => {
    const started = Date.now();
    const result = await executeAction(
      page,
      { ...waitAction, param_refs: ["ms"] },
      { ms: 150 },
    );
    const elapsed = Date.now() - started;

    // Never touches networkidle, so the never-idle page is irrelevant here.
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(3_000);
  }, 30_000);

  // #83 / ADR-0008 — a recorded wait's duration used to be dropped, so replay
  // fell back to networkidle: a different condition than the one recorded.
  it("a recorded wait_ms replays as that sleep, not networkidle", async () => {
    const started = Date.now();
    const result = await executeAction(page, { ...waitAction, wait_ms: 150 });
    const elapsed = Date.now() - started;

    // No `settled` field means the networkidle branch never ran.
    expect(result.ok).toBe(true);
    expect(result.settled).toBeUndefined();
    expect(elapsed).toBeLessThan(3_000);
    // Avoiding the probe is not the whole claim — it slept the RECORDED
    // duration. Without this, a `wait_ms` that was read and then ignored
    // would still pass.
    expect(elapsed).toBeGreaterThanOrEqual(150);
  }, 30_000);

  it("prefers a recorded wait_ms over a same-action param binding", async () => {
    // Guards the precedence ADR-0008 chose: a recorded literal must not be
    // silently overridable by a runtime param that happens to share a slot.
    const started = Date.now();
    const result = await executeAction(
      page,
      { ...waitAction, wait_ms: 150, param_refs: ["ms"] },
      { ms: 10_000 },
    );
    const elapsed = Date.now() - started;

    expect(result.ok).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(150);
    expect(elapsed).toBeLessThan(3_000);
  }, 30_000);

  // Both schemas declare `minimum: 0` and `recorder.wait(intent, 0)` is a legal
  // call, so zero is a value the recorder can genuinely produce. Gating the
  // runner on `ms > 0` let it fall through to the networkidle probe — measured
  // at ~5s with `settled: false` on this fixture — which is the same semantic
  // drift ADR-0008 closes, surviving at the boundary the schema allows.
  it("replays a recorded wait_ms of 0 as an instant no-op, not networkidle", async () => {
    const started = Date.now();
    const result = await executeAction(page, { ...waitAction, wait_ms: 0 });
    const elapsed = Date.now() - started;

    expect(result.ok).toBe(true);
    // The load-bearing pair: the probe never ran, and the step did not spend
    // the bound waiting for a page that never goes quiet.
    expect(result.settled).toBeUndefined();
    expect(elapsed).toBeLessThan(1_000);
  }, 30_000);

  it("falls back to networkidle when wait_ms is not a usable duration", async () => {
    // A negative value is not an observation the recorder can produce; it can
    // only reach here from a hand-authored program, and it must not become a
    // silent `waitForTimeout(-1)`. Treated as "no duration recorded".
    const result = await executeAction(
      page,
      { ...waitAction, wait_ms: -1 },
      {},
      { networkIdleWaitMs: 1_000 },
    );

    expect(result.ok).toBe(true);
    expect(result.settled).toBe(false);
  }, 30_000);
});
