/**
 * #74 — the recorder and the runner must enumerate the same landmarks, not just
 * apply the same visibility predicate.
 *
 * ADR-0007 shared the predicate and left the enumeration split: the recorder
 * walked the tree with implicit roles against an 8-role set, `page-state`
 * checked 6 `[role=]` selectors with tag fallbacks for only main/nav/form. The
 * in-tree fixture `src/recorder/fixtures/grafana-gate-login.html` cannot show
 * the gap because it puts an explicit `role=` on every landmark, so both paths
 * find everything through the `[role=]` branch and agree by accident.
 *
 * Every page below is therefore semantic markup with NO redundant `role=`.
 * These run a real browser because the enumeration runs in the browser.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, type Page } from "playwright";
import { launchTestBrowser } from "../helpers/browser.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { captureFingerprint } from "../../src/recorder/fingerprint.js";
import { capturePageState } from "../../src/runner/page-state.js";
import {
  LANDMARK_ENUMERATION_JS,
  LANDMARK_ROLES,
  VISIBLE_LANDMARKS_EXPRESSION_JS,
} from "../../src/shared/landmarks.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** No `role=` anywhere: the case that used to make the two sites disagree. */
const SEMANTIC_PAGE = `
  <header>h</header>
  <nav>n</nav>
  <main>m<aside>a</aside></main>
  <form>f</form>
  <footer>x</footer>`;

describe("shared landmark enumeration (#74)", () => {
  let browser: Browser;
  let page: Page;

  const bothSites = async () => ({
    recorder: (await captureFingerprint(page, { bindings: {} })).visible_landmarks,
    pageState: (await capturePageState(page)).visible_landmarks,
  });

  beforeAll(async () => {
    browser = await launchTestBrowser();
    page = await browser.newPage();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it("agrees on semantic markup with no redundant role attributes", async () => {
    await page.setContent(SEMANTIC_PAGE);
    const { recorder, pageState } = await bothSites();

    // Named in full, not just compared to each other: two sites that both
    // returned [] would agree, and prove nothing.
    expect(recorder).toEqual([
      "banner",
      "navigation",
      "main",
      "complementary",
      "form",
      "contentinfo",
    ]);
    expect(pageState).toEqual(recorder);
  });

  it("agrees when the same landmarks carry redundant role attributes", async () => {
    // The shape the in-tree fixture has. Both sites found these before #74 too;
    // this asserts the fix did not regress the case that already worked.
    await page.setContent(`
      <header role="banner">h</header>
      <nav role="navigation">n</nav>
      <main role="main">m<aside role="complementary">a</aside></main>
      <form role="form">f</form>
      <footer role="contentinfo">x</footer>`);
    const { recorder, pageState } = await bothSites();
    expect(pageState).toEqual(recorder);
    expect(recorder).toContain("banner");
    expect(recorder).toContain("complementary");
  });

  it("agrees on which semantic landmarks are hidden", async () => {
    await page.setContent(`
      <header style="visibility:hidden">h</header>
      <nav hidden>n</nav>
      <main>m<aside style="display:none">a</aside></main>
      <footer>x</footer>`);
    const { recorder, pageState } = await bothSites();
    expect(recorder).toEqual(["main", "contentinfo"]);
    expect(pageState).toEqual(recorder);
  });

  it("agrees on roles reachable only through an explicit role attribute", async () => {
    // `search` and `region` have no implicit tag mapping in either site.
    await page.setContent(`
      <main>m</main>
      <div role="search">s</div>
      <div role="region" aria-label="r">r</div>
      <div role="button">not a landmark</div>`);
    const { recorder, pageState } = await bothSites();
    expect(recorder).toEqual(["main", "search", "region"]);
    expect(pageState).toEqual(recorder);
    expect(pageState).not.toContain("button");
  });

  it("agrees on the in-tree recorder fixture", async () => {
    const fixture = path.join(ROOT, "src/recorder/fixtures/grafana-gate-login.html");
    await page.goto(`file://${fixture.replace(/\\/g, "/")}`);
    const { recorder, pageState } = await bothSites();
    expect(pageState).toEqual(recorder);
  });

  it("orders both lists by DOM position", async () => {
    // page-state used to return its own fixed role-array order regardless of
    // the document. Sharing the walk makes both DOM-ordered; a set comparison
    // would hide a divergence that a downstream diff would not.
    await page.setContent(`<footer>x</footer><main>m</main><nav>n</nav>`);
    const { recorder, pageState } = await bothSites();
    expect(recorder).toEqual(["contentinfo", "main", "navigation"]);
    expect(pageState).toEqual(recorder);
  });

  it("keeps the predicate in exactly one place under src/", async () => {
    // The structural half of the guard. Behavioural agreement can always be
    // restored by editing two copies in step; this fails the moment a second
    // copy exists at all, which is what #74 asked for.
    const src = path.join(ROOT, "src");
    const entries = await readdir(src, { recursive: true, withFileTypes: true });
    const carriers: string[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      const file = path.join(entry.parentPath, entry.name);
      if ((await readFile(file, "utf8")).includes("checkVisibility")) {
        carriers.push(path.relative(src, file).replace(/\\/g, "/"));
      }
    }
    expect(carriers).toEqual(["shared/landmarks.ts"]);
  });

  it("derives the browser-side role vocabulary from the exported constants", async () => {
    // The JS string is generated from LANDMARK_ROLES, so the TypeScript copy
    // and the copy that actually runs cannot drift.
    for (const role of LANDMARK_ROLES) {
      expect(LANDMARK_ENUMERATION_JS).toContain(`"${role}"`);
    }
    expect(VISIBLE_LANDMARKS_EXPRESSION_JS).toContain(LANDMARK_ENUMERATION_JS);
    // Backtick or ${ inside the snippet breaks the template literals it is
    // embedded in — a build break, so assert it directly.
    expect(LANDMARK_ENUMERATION_JS).not.toContain("`");
    expect(LANDMARK_ENUMERATION_JS).not.toContain("${");
  });
});
