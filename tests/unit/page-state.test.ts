/**
 * capturePageState had no test at all, which is why a `ReferenceError: __name
 * is not defined` regression reached review: its only caller is the repair loop
 * in ReplayRunner, and the gate:matrix exit-2 guard keeps that unreached, so
 * every suite stayed green while the function was completely broken.
 *
 * These run a real browser because the bug only exists in the browser: the
 * failure is in how the evaluate callback is serialized, so nothing short of
 * executing it can catch it.
 */

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { capturePageState, emptyPageState } from "../../src/runner/page-state.js";

describe("capturePageState", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it("executes in the browser without a serialization error", async () => {
    await page.setContent(`<main role="main">m</main><form role="form">f</form>`);
    // The regression guard. Before the string-body fix this threw outright.
    const state = await capturePageState(page);
    expect(state.visible_landmarks).toEqual(["main", "form"]);
    expect(state.url).toBeTypeOf("string");
    expect(state.captured_at).toBeTypeOf("string");
  });

  it("omits landmarks that are present but hidden", async () => {
    await page.setContent(`
      <main role="main">m</main>
      <nav role="navigation" hidden>n</nav>
      <header role="banner" style="display:none">h</header>`);
    const { visible_landmarks } = await capturePageState(page);
    expect(visible_landmarks).toEqual(["main"]);
    expect(visible_landmarks).not.toContain("navigation");
    expect(visible_landmarks).not.toContain("banner");
  });

  it("agrees with Playwright on visibility:hidden", async () => {
    // checkVisibility() with DEFAULT options returns true here, while
    // Playwright's isVisible() returns false. The runner asserts with
    // Playwright, so the capture must match Playwright, not the default.
    await page.setContent(`
      <main role="main">m</main>
      <form role="form" style="visibility:hidden">f</form>`);
    const { visible_landmarks } = await capturePageState(page);
    expect(await page.locator('[role="form"]').isVisible()).toBe(false);
    expect(visible_landmarks).not.toContain("form");
  });

  it("captures no cookies, storage, or raw HTML", async () => {
    await page.setContent(`<main role="main">secret-body-text</main>`);
    const serialized = JSON.stringify(await capturePageState(page));
    expect(serialized).not.toContain("secret-body-text");
    expect(serialized).not.toMatch(/cookie|localStorage|sessionStorage|<main/i);
  });

  it("emptyPageState needs no page", () => {
    expect(emptyPageState().visible_landmarks).toEqual([]);
  });
});
