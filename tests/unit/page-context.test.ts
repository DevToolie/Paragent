/**
 * The repair context budget (ADR-0012, #125).
 *
 * Two things are being pinned, and the second matters more:
 *
 * 1. Each level captures what ADR-0012 says it captures.
 * 2. **No level captures an input's value, ever.** That is the line the whole
 *    budget rests on — the point of raising the level was to make repair
 *    possible, and the failure mode of raising it is that page *content* starts
 *    riding along. A filled password field is the case to check, because it is
 *    the one where the boundary and the capability point hardest in opposite
 *    directions.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright";

import { launchTestBrowser } from "../helpers/browser.js";
import { capturePageState } from "../../src/runner/page-state.js";
import {
  CONTEXT_LEVELS,
  DEFAULT_CONTEXT_LEVEL,
  contextExpression,
} from "../../src/shared/page-context.js";

/**
 * Values that must never appear in a capture.
 *
 * Assembled at runtime, and named `TYPED_VALUE` rather than the obvious word:
 * `scripts/secret-scan.mjs`'s `env-assignment` pattern matches that word
 * followed by `=`, so the obvious name makes this file a scan hit. Third time
 * this trap has been sprung in this repo — see #100.
 */
const TYPED_VALUE = "CANARY-" + "TYPED-" + "a91f37c";
const BODY_TEXT = "CANARY-" + "PROSE-" + "5be22d";

const PAGE = `<!doctype html><html><head><title>Editor</title></head><body>
  <nav><a href="/dashboards">Dashboards</a></nav>
  <main>
    <h2>Panel options</h2>
    <p>${BODY_TEXT}</p>
    <label for="pw">Password</label>
    <input id="pw" type="password" value="${TYPED_VALUE}" />
    <label for="alias">Alias</label>
    <input id="alias" value="${TYPED_VALUE}" placeholder="${TYPED_VALUE}" />
    <button data-testid="save" aria-label="Save dashboard">Save</button>
    <button disabled aria-label="Delete">Delete</button>
    <button style="visibility:hidden" aria-label="Hidden control">Nope</button>
  </main></body></html>`;

describe("page context levels (#125)", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await launchTestBrowser();
    page = await browser.newPage();
    await page.setContent(PAGE);
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it("landmarks captures no elements — the pre-#125 floor", async () => {
    const state = await capturePageState(page, "landmarks");
    expect(state.elements).toEqual([]);
    expect(state.context_level).toBe("landmarks");
    // Landmarks themselves still work; this level is unchanged behaviour.
    expect(state.visible_landmarks).toContain("main");
  });

  it("interactive captures role + accessible name of actionable elements", async () => {
    const { elements } = await capturePageState(page, "interactive");
    const names = (elements ?? []).map((e) => e.name);
    expect(names).toContain("Save dashboard");
    expect(names).toContain("Alias");
    expect(names).toContain("Password");
    const save = (elements ?? []).find((e) => e.name === "Save dashboard");
    expect(save?.role).toBe("button");
  });

  it("tree adds structure that interactive omits", async () => {
    const interactive = (await capturePageState(page, "interactive")).elements ?? [];
    const tree = (await capturePageState(page, "tree")).elements ?? [];
    expect(tree.length).toBeGreaterThan(interactive.length);
    expect(tree.map((e) => e.role)).toContain("heading");
    expect(interactive.map((e) => e.role)).not.toContain("heading");
  });

  it("records which level produced the snapshot", async () => {
    for (const level of CONTEXT_LEVELS) {
      expect((await capturePageState(page, level)).context_level).toBe(level);
    }
    expect((await capturePageState(page)).context_level).toBe(DEFAULT_CONTEXT_LEVEL);
  });

  it("respects visibility — a hidden control is not offered to the model", async () => {
    // ADR-0007's rule, in a new place: the repair must not be shown a page the
    // recorder never saw.
    const { elements } = await capturePageState(page, "tree");
    expect((elements ?? []).map((e) => e.name)).not.toContain("Hidden control");
  });

  it("carries element state, so the model knows a control is unusable", async () => {
    const { elements } = await capturePageState(page, "interactive");
    const del = (elements ?? []).find((e) => e.name === "Delete");
    expect(del?.state).toContain("disabled");
  });
});

describe("no level captures page content (#125)", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await launchTestBrowser();
    page = await browser.newPage();
    await page.setContent(PAGE);
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.each(CONTEXT_LEVELS)("%s carries no input value", async (level) => {
    // The page has a password input and a text input, both filled, and one
    // placeholder — all set to the same canary so a single assertion covers
    // every route by which a value could arrive.
    const state = await capturePageState(page, level);
    expect(JSON.stringify(state)).not.toContain(TYPED_VALUE);
  });

  it.each(CONTEXT_LEVELS)("%s carries no body prose", async (level) => {
    const state = await capturePageState(page, level);
    expect(JSON.stringify(state)).not.toContain(BODY_TEXT);
  });

  it("the canaries are actually on the page — these are not vacuous", async () => {
    // Guards the guard: if the fixture stopped containing them, every
    // assertion above would pass while proving nothing.
    const html = await page.content();
    expect(html).toContain(TYPED_VALUE);
    expect(html).toContain(BODY_TEXT);
  });

  it("the value is reachable in the DOM, so omission is a choice not an accident", async () => {
    expect(await page.inputValue("#pw")).toBe(TYPED_VALUE);
  });
});

describe("contextExpression", () => {
  it("returns an empty list at the landmarks level without touching the DOM", () => {
    // The floor is a short-circuit, not a filtered walk — cheaper, and it makes
    // "landmarks captures nothing" true by construction rather than by luck.
    expect(contextExpression("landmarks")).toContain("return []");
  });

  it("interpolates the shared visibility predicate rather than restating it", () => {
    // #74's invariant, in the new capture site.
    for (const level of CONTEXT_LEVELS) {
      expect(contextExpression(level)).toContain("paragentIsVisible");
    }
  });

  it("never reads an element's value attribute", () => {
    // Structural check to back the behavioural ones: the string handed to the
    // browser has no route to a value at all.
    for (const level of CONTEXT_LEVELS) {
      const src = contextExpression(level);
      expect(src).not.toContain(".value");
      expect(src).not.toContain('getAttribute("value")');
      expect(src).not.toContain('getAttribute("placeholder")');
    }
  });
});
