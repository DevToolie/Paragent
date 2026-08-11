/**
 * #145 — every browser-driven suite goes through one launch helper.
 *
 * The helper is what gives a launch an explicit ceiling and a named failure.
 * None of that is worth anything if the next browser test copies the raw
 * Playwright launch call out of an existing file, which is how all eleven of
 * them came to have one. So the convention is enforced here rather than
 * documented and hoped for.
 *
 * The runner-level half of #145 — the worker cap that stops browsers
 * outnumbering cores — lives in `vitest.config.ts`; there is no useful unit
 * test for "the machine is not oversubscribed", so its reasoning is written
 * there instead.
 */

import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BROWSER_LAUNCH_TIMEOUT_MS,
  BrowserLaunchError,
  launchTestBrowser,
} from "../helpers/browser.js";

const TESTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function testFiles(): Promise<string[]> {
  const out: string[] = [];
  for (const dir of ["unit", "integration", "canary"]) {
    const entries = await readdir(path.join(TESTS_DIR, dir), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".test.ts")) {
        out.push(path.join(dir, entry.name));
      }
    }
  }
  return out;
}

/**
 * Built by concatenation so this file does not contain the literal it looks
 * for, and therefore does not flag itself.
 *
 * The same trick, for the same reason, as the `cookie-header` pattern in
 * `scripts/secret-scan.mjs` — which also scans a tree it is part of. The
 * alternative, excluding this file from its own scan, opens a hole in exactly
 * the file where a hole is least visible.
 */
const DIRECT_LAUNCH = new RegExp("chromium\\s*\\.\\s*" + "launch\\s*\\(");

describe("browser launches go through the helper (#145)", () => {
  it("no test file calls the browser launcher directly", async () => {
    const files = await testFiles();
    // A discovery that finds nothing would make every assertion below vacuous.
    expect(files.length).toBeGreaterThan(10);

    const offenders = files.filter((rel) =>
      DIRECT_LAUNCH.test(readFileSync(path.join(TESTS_DIR, rel), "utf8")),
    );
    expect(
      offenders,
      "use launchTestBrowser() from tests/helpers/browser.ts — it sets the " +
        "launch ceiling and reports an environment failure as one",
    ).toEqual([]);
  });

  it("at least one suite actually drives a browser", async () => {
    // The counter-direction: the assertion above also passes in a tree with no
    // browser tests at all, which is not the property being claimed.
    const files = await testFiles();
    const users = files.filter((rel) =>
      readFileSync(path.join(TESTS_DIR, rel), "utf8").includes("launchTestBrowser"),
    );
    expect(users.length).toBeGreaterThanOrEqual(10);
  });
});

describe("launchTestBrowser", () => {
  it("launches headless and closes cleanly", async () => {
    const browser = await launchTestBrowser();
    try {
      expect(browser.isConnected()).toBe(true);
    } finally {
      await browser.close();
    }
  });

  it("reports an unlaunchable browser as an environment failure", async () => {
    // An executable path that cannot exist: the failure a contributor hits when
    // `npx playwright install chromium` has not been run. Before the helper it
    // surfaced inside whichever assertion ran first.
    await expect(
      launchTestBrowser({ executablePath: "/nonexistent/chromium-for-this-test" }),
    ).rejects.toBeInstanceOf(BrowserLaunchError);

    await expect(
      launchTestBrowser({ executablePath: "/nonexistent/chromium-for-this-test" }),
    ).rejects.toThrow(/playwright install/);
  });

  it("carries the original failure rather than swallowing it", async () => {
    const err = await launchTestBrowser({
      executablePath: "/nonexistent/chromium-for-this-test",
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BrowserLaunchError);
    expect((err as BrowserLaunchError).cause).toBeDefined();
    expect(BROWSER_LAUNCH_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
