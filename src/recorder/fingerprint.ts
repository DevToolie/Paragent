import type { Page } from "playwright";
import type { Fingerprint } from "./types.js";
import { digestSignals, templatizeUrl } from "./redact.js";
import { LANDMARK_ENUMERATION_JS } from "../shared/landmarks.js";

export interface FingerprintContext {
  bindings: Record<string, string | number | boolean>;
  awaitNetworkIdle?: boolean;
}

interface StructuralSignals {
  landmark_roles: string[];
  role_counts: Record<string, number>;
  form_count: number;
  heading_count: number;
  link_count: number;
  button_count: number;
  input_count: number;
}

/**
 * Capture page state for B3 assertion synthesis. No cookies/storage/typed values.
 * Sources: https://playwright.dev/docs/api/class-page — access_date: 2026-07-25
 * Evaluate body is a string to avoid tsx `__name` helpers in the browser VM.
 */
export async function captureFingerprint(
  page: Page,
  ctx: FingerprintContext,
): Promise<Fingerprint> {
  let networkIdle = false;
  if (ctx.awaitNetworkIdle) {
    try {
      await page.waitForLoadState("networkidle", { timeout: 5_000 });
      networkIdle = true;
    } catch {
      networkIdle = false;
    }
  }

  const rawUrl = page.url();
  const rawTitle = await page.title();
  const { template: url_template } = templatizeUrl(rawUrl, ctx.bindings);

  let title_template = rawTitle;
  const host = ctx.bindings.host != null ? String(ctx.bindings.host) : undefined;
  if (host && title_template.includes(host)) {
    title_template = title_template.split(host).join("{host}");
  }

  // ADR-0007: visible_landmarks must mean visible. The enumeration — role
  // vocabulary, implicit roles, visibility predicate, and which elements get
  // tested — lives in src/shared/landmarks.ts and is shared verbatim with
  // src/runner/page-state.ts (#74). Do not re-inline it here; two copies is
  // what made the two sites disagree in the first place.
  //
  // Still a string body, not a callback: esbuild's keepNames wraps named
  // function expressions in __name(...), which does not exist in the browser.
  //
  // Keep prose OUT of the string below: it is a template literal, so a stray
  // backtick or ${ terminates it. That is a build break, not a runtime one.
  const EXTRACT_PAGE_SIGNALS = new Function(`
    ${LANDMARK_ENUMERATION_JS}
    const roleCounts = {};
    // Counts stay DOM-wide on purpose (ADR-0007): they are structural signals,
    // not visibility claims, and no field name promises otherwise. Same walk
    // and same role resolution as the landmark pass, unfiltered.
    paragentWalk(document.body, (el) => {
      const role = paragentRoleOf(el);
      if (role) roleCounts[role] = (roleCounts[role] || 0) + 1;
    });
    return {
      landmark_roles: paragentVisibleLandmarks(document.body),
      role_counts: roleCounts,
      form_count: document.querySelectorAll("form").length,
      heading_count: document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role='heading']").length,
      link_count: document.querySelectorAll("a, [role='link']").length,
      button_count: document.querySelectorAll("button, [role='button']").length,
      input_count: document.querySelectorAll("input, textarea, select").length,
    };
  `) as () => StructuralSignals;

  const signals = (await page.evaluate(EXTRACT_PAGE_SIGNALS)) as StructuralSignals;

  return {
    url_template,
    title_template,
    dom_digest: digestSignals(signals),
    visible_landmarks: signals.landmark_roles,
    network_idle: networkIdle,
  };
}
