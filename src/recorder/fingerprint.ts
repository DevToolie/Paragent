import type { Page } from "playwright";
import type { Fingerprint } from "./types.js";
import { digestSignals, templatizeUrl } from "./redact.js";

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

  const EXTRACT_PAGE_SIGNALS = new Function(`
    const landmarkRoles = new Set([
      "banner", "navigation", "main", "contentinfo",
      "complementary", "form", "search", "region",
    ]);
    const roleCounts = {};
    const landmarks = [];
    // ADR-0007: visible_landmarks must mean visible. checkVisibility() covers
    // display:none (which the hidden attribute maps to), visibility:hidden and
    // content-visibility. Fall back to client rects on engines without it.
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/checkVisibility
    // access_date: 2026-07-26
    const isVisible = (el) => {
      if (typeof el.checkVisibility === "function") return el.checkVisibility();
      return el.getClientRects().length > 0;
    };
    const implicit = (el) => {
      const tag = el.tagName;
      if (tag === "FORM") return "form";
      if (tag === "MAIN") return "main";
      if (tag === "NAV") return "navigation";
      if (tag === "HEADER") return "banner";
      if (tag === "FOOTER") return "contentinfo";
      if (tag === "ASIDE") return "complementary";
      return null;
    };
    const walk = (el) => {
      const role = el.getAttribute("role") || implicit(el);
      if (role) {
        // Counts stay DOM-wide on purpose (ADR-0007): they are structural, and
        // no field name promises they are visibility-scoped.
        roleCounts[role] = (roleCounts[role] || 0) + 1;
        if (landmarkRoles.has(role) && !landmarks.includes(role) && isVisible(el)) {
          landmarks.push(role);
        }
      }
      for (const child of Array.from(el.children)) walk(child);
    };
    walk(document.body);
    return {
      landmark_roles: landmarks,
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
