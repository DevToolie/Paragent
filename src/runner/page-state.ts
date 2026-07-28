/**
 * Privacy-safe page state capture — no cookies, storage, or raw HTML.
 * Aligns with trajectory fingerprint posture (contracts/trajectory.schema.json).
 */

import type { Page } from "playwright";
import type { PageStateSnapshot } from "./types.js";

export function emptyPageState(
  overrides: Partial<PageStateSnapshot> = {},
): PageStateSnapshot {
  return {
    url: overrides.url ?? "",
    title: overrides.title ?? "",
    visible_landmarks: overrides.visible_landmarks ?? [],
    network_idle: overrides.network_idle ?? false,
    captured_at: overrides.captured_at ?? new Date().toISOString(),
  };
}

export async function capturePageState(page: Page): Promise<PageStateSnapshot> {
  const url = page.url();
  const title = await page.title();
  // ADR-0007: visibility-filtered. querySelector alone matched hidden nodes and
  // reported them as visible, and this snapshot becomes RepairContext.page_state
  // — so the repair model would be shown a page the recorder never saw.
  //
  // The body is a STRING, exactly as src/recorder/fingerprint.ts does it, and for
  // the same reason: esbuild (via tsx and vitest) applies keepNames, which wraps
  // named function expressions in __name(...). Playwright serializes the callback
  // source into the browser, where __name does not exist, and every call throws
  // `ReferenceError: __name is not defined`. Nothing caught it because the only
  // caller is the repair loop, which the gate:matrix exit-2 guard keeps unreached.
  // Guarded now by tests/unit/page-state.test.ts.
  //
  // visibilityProperty/contentVisibilityAuto are required: with default options
  // checkVisibility() returns TRUE for `visibility: hidden`, while Playwright's
  // isVisible() — which the runner asserts with — returns false. Measured in
  // Chromium; the flags make the two agree on display:none, visibility:hidden,
  // opacity:0 and [hidden].
  // https://developer.mozilla.org/en-US/docs/Web/API/Element/checkVisibility
  // access_date: 2026-07-26
  const visible_landmarks = (await page.evaluate(`(() => {
    var isVisible = function (el) {
      if (typeof el.checkVisibility === "function") {
        return el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true });
      }
      var cs = window.getComputedStyle(el);
      if (cs && (cs.visibility === "hidden" || cs.display === "none")) return false;
      return el.getClientRects().length > 0;
    };
    var anyVisible = function (sel) {
      return Array.prototype.some.call(document.querySelectorAll(sel), isVisible);
    };
    var roles = ["banner", "navigation", "main", "contentinfo", "form", "search"];
    var found = [];
    for (var i = 0; i < roles.length; i++) {
      if (anyVisible('[role="' + roles[i] + '"]')) found.push(roles[i]);
    }
    if (found.indexOf("main") === -1 && anyVisible("main")) found.push("main");
    if (found.indexOf("navigation") === -1 && anyVisible("nav")) found.push("navigation");
    if (found.indexOf("form") === -1 && anyVisible("form")) found.push("form");
    return found;
  })()`)) as string[];

  // Best-effort idle probe without inventing success — false if check fails.
  let network_idle = false;
  try {
    await page.waitForLoadState("networkidle", { timeout: 250 });
    network_idle = true;
  } catch {
    // Probe failed — leave it false rather than inventing success.
  }

  return {
    url,
    title,
    visible_landmarks,
    network_idle,
    captured_at: new Date().toISOString(),
  };
}
