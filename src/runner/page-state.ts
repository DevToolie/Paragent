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
  const visible_landmarks = await page.evaluate(() => {
    type DocLike = { querySelector: (sel: string) => unknown };
    const doc = (globalThis as unknown as { document: DocLike }).document;
    const roles = ["banner", "navigation", "main", "contentinfo", "form", "search"];
    const found: string[] = [];
    for (const role of roles) {
      if (doc.querySelector(`[role="${role}"]`)) found.push(role);
    }
    if (doc.querySelector("main") && !found.includes("main")) {
      found.push("main");
    }
    if (doc.querySelector("nav") && !found.includes("navigation")) {
      found.push("navigation");
    }
    if (doc.querySelector("form") && !found.includes("form")) {
      found.push("form");
    }
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
