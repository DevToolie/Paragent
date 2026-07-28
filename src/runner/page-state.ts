/**
 * Privacy-safe page state capture — no cookies, storage, or raw HTML.
 * Aligns with trajectory fingerprint posture (contracts/trajectory.schema.json).
 */

import type { Page } from "playwright";
import type { PageStateSnapshot } from "./types.js";
import { VISIBLE_LANDMARKS_EXPRESSION_JS } from "../shared/landmarks.js";

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
  // #74: this used to enumerate its own 6 `[role=]` selectors with tag fallbacks
  // for only main/nav/form, so on markup without redundant `role=` attributes it
  // silently missed banner/complementary/contentinfo that the recorder reported.
  // Now it runs the recorder's enumeration verbatim, from src/shared/landmarks.ts.
  // Do not re-inline a local copy — that is the bug this closed.
  //
  // The body stays a STRING, exactly as src/recorder/fingerprint.ts does it, and
  // for the same reason: esbuild (via tsx and vitest) applies keepNames, which
  // wraps named function expressions in __name(...). Playwright serializes the
  // callback source into the browser, where __name does not exist, and every call
  // throws `ReferenceError: __name is not defined`. Nothing caught it because the
  // only caller is the repair loop, which the gate:matrix exit-2 guard keeps
  // unreached. Guarded now by tests/unit/page-state.test.ts.
  const visible_landmarks = (await page.evaluate(
    VISIBLE_LANDMARKS_EXPRESSION_JS,
  )) as string[];

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
