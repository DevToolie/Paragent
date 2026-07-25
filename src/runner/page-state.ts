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
  // ADR-0007: same visibility predicate as src/recorder/fingerprint.ts. These
  // two must agree — this snapshot becomes RepairContext.page_state, so a
  // divergence would hand the repair model a different page than the recorder
  // saw. querySelector alone matched hidden nodes and reported them as visible.
  const visible_landmarks = await page.evaluate(() => {
    type ElLike = {
      checkVisibility?: () => boolean;
      getClientRects: () => { length: number };
    };
    type DocLike = { querySelectorAll: (sel: string) => ArrayLike<ElLike> };
    const doc = (globalThis as unknown as { document: DocLike }).document;
    const isVisible = (el: ElLike): boolean =>
      typeof el.checkVisibility === "function"
        ? el.checkVisibility()
        : el.getClientRects().length > 0;
    const anyVisible = (sel: string): boolean =>
      Array.prototype.some.call(doc.querySelectorAll(sel), isVisible) as boolean;

    const roles = ["banner", "navigation", "main", "contentinfo", "form", "search"];
    const found: string[] = [];
    for (const role of roles) {
      if (anyVisible(`[role="${role}"]`)) found.push(role);
    }
    if (!found.includes("main") && anyVisible("main")) found.push("main");
    if (!found.includes("navigation") && anyVisible("nav")) found.push("navigation");
    if (!found.includes("form") && anyVisible("form")) found.push("form");
    return found;
  });

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
