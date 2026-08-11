/**
 * The one place a test launches a browser (#145).
 *
 * Eleven suites drive real Chromium. Every one of them called
 * `chromium.launch({ headless: true })` directly, which meant three things were
 * left to Playwright's defaults and to luck:
 *
 * 1. **A launch that never returns had no ceiling of ours.** Playwright's own
 *    default is 30 s, which is fine — but it was inherited rather than chosen,
 *    and nothing said so.
 * 2. **A launch failure read as a test failure.** A missing browser binary
 *    (`npx playwright install chromium` not run) surfaced inside whichever
 *    assertion happened to be first, which is a confusing place to learn that
 *    the environment is wrong rather than the code.
 * 3. **Nothing marked a suite as browser-driven.** The runner had no way to know
 *    which files launch a browser, so it could not treat them differently — see
 *    `vitest.config.ts` for why that matters.
 *
 * Using this helper is enforced by `tests/unit/browser-launch.test.ts`: a test
 * file that calls `chromium.launch` directly fails the build. That is what keeps
 * the marker honest, rather than a hand-maintained list of "the browser suites"
 * that goes stale the first time somebody adds one.
 */

import { chromium, type Browser, type LaunchOptions } from "playwright";

/**
 * Ceiling on a browser launch.
 *
 * Playwright's default is 30 s; this is deliberately more generous, because on
 * a loaded machine a launch legitimately takes a while and a *slow* launch is
 * not the failure worth reporting. What this bounds is a launch that never
 * completes at all — a missing binary, an exhausted process table, a sandbox
 * that refuses. Those do not get faster with waiting.
 */
export const BROWSER_LAUNCH_TIMEOUT_MS = 60_000;

/**
 * A browser that could not be started — an environment problem, not a test
 * failure, and named so nobody has to work that out from a stack trace inside
 * an unrelated assertion.
 */
export class BrowserLaunchError extends Error {
  readonly code = "BROWSER_LAUNCH" as const;
  constructor(cause: unknown) {
    const detail = cause instanceof Error ? cause.message.split("\n")[0] : String(cause);
    super(
      `could not launch Chromium within ${BROWSER_LAUNCH_TIMEOUT_MS}ms: ${detail}\n` +
        "This is the environment, not the code under test. Most often: " +
        "`npx playwright install --with-deps chromium` has not been run, or the " +
        "machine is out of processes/memory because too many browsers are already up.",
    );
    this.name = "BrowserLaunchError";
    this.cause = cause;
  }
}

/**
 * Launch Chromium for a test.
 *
 * Always headless: a test that opens a window is a test that behaves
 * differently in CI, and every one of these suites asserts on page state rather
 * than on anything a human needs to watch.
 */
export async function launchTestBrowser(
  options: LaunchOptions = {},
): Promise<Browser> {
  try {
    return await chromium.launch({
      headless: true,
      timeout: BROWSER_LAUNCH_TIMEOUT_MS,
      ...options,
    });
  } catch (err) {
    throw new BrowserLaunchError(err);
  }
}
