import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";

/**
 * Ceiling on how many test files run at once — and therefore on how many
 * Chromium instances exist at once (#145).
 *
 * Eleven of these suites launch a real browser. Vitest's default is roughly one
 * worker per core, so on a developer laptop `npm test` could have eight or more
 * browsers up simultaneously, each with its own renderer and GPU processes.
 * Observed consequence: `recorder-preamble.test.ts` reported **944 seconds** for
 * a test that takes 3.1 s when the suite runs alone — same commit, same machine,
 * minutes apart.
 *
 * **A per-test timeout cannot save you from this, and it is worth being precise
 * about why.** Vitest enforces its timeout with a timer, and a timer needs the
 * event loop to run. Measured here: a hung test *does* fail promptly at its
 * deadline (2007 ms against a 2000 ms limit, both for a bare pending promise and
 * for a stuck Playwright call), so the mechanism works — but only while the
 * worker gets CPU. Starve the worker badly enough and the timer that was
 * supposed to bound the test is itself waiting behind everything else. Which is
 * exactly the 944 s: not a hang the timeout failed to catch, but a machine on
 * which nothing, including the timeout, was running.
 *
 * So the timeouts below are the ceiling on a *stuck* test, and this cap is the
 * ceiling on the load that makes a timeout meaningless. Both are needed; only
 * one of them is a fix.
 *
 * Four is a judgement call, not a measurement: enough to keep the fast suites
 * parallel, few enough that browsers do not outnumber cores on any machine this
 * repo is developed on. `PARAGENT_TEST_WORKERS` overrides it for anyone who
 * wants to trade the guarantee for wall-clock.
 */
const DEFAULT_MAX_WORKERS = 4;

function maxWorkers(): number {
  const override = Number(process.env.PARAGENT_TEST_WORKERS);
  if (Number.isFinite(override) && override >= 1) return Math.floor(override);
  // `- 1` leaves a core for the machine itself; CI runners with 2 cores land on
  // 1, which is the right answer there rather than a degenerate one.
  return Math.max(1, Math.min(DEFAULT_MAX_WORKERS, availableParallelism() - 1));
}

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    reporters: ["default"],
    maxWorkers: maxWorkers(),

    /**
     * Chosen rather than inherited.
     *
     * Vitest's defaults are 5 s per test and 10 s per hook, which every
     * browser-driven suite here already overrides file by file with an explicit
     * `}, 60_000)`. Setting them centrally means a new browser suite gets a
     * usable ceiling without remembering to ask for one, and — more to the point
     * — means the ceiling is a number this repo picked and can defend.
     *
     * 30 s per test: the slowest legitimate case in the tree is
     * `recorder-preamble`'s wrong-password path at ~11 s, which waits out a real
     * login failure. 60 s per hook: hooks are where browsers are launched, and
     * `BROWSER_LAUNCH_TIMEOUT_MS` is 60 s, so a launch that hits its own ceiling
     * reports `BrowserLaunchError` — the useful message — rather than being cut
     * off first by a hook timeout that can only say "timed out".
     */
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
