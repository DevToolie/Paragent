/**
 * Assertion evaluation → StepOutcome.
 * Source: contracts/assertion.schema.json; contracts/metrics.schema.json
 * Playwright: https://playwright.dev/docs/locators — access_date: 2026-07-24
 */

import type { Page } from "playwright";
import type { StepOutcome } from "../metrics/types.js";
import { LocatorNotFoundError, resolveLocator } from "./locators.js";
import { interpolate } from "./templates.js";
import type { Assertion, ParamBindings } from "./types.js";

export interface AssertionEvalResult {
  outcome: StepOutcome;
  message?: string;
}

function classificationToOutcome(
  assertion: Assertion,
  fallback: StepOutcome = "ASSERTION_FAILED",
): StepOutcome {
  switch (assertion.failure_classification) {
    case "locator_not_found":
      return "LOCATOR_NOT_FOUND";
    case "timeout":
      return "TIMEOUT";
    case "page_error":
    case "network_error":
      return "PAGE_ERROR";
    case "assertion_failed":
    case "unknown":
      return fallback;
    default:
      return fallback;
  }
}

function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name.toLowerCase();
  const msg = err.message.toLowerCase();
  return name.includes("timeout") || msg.includes("timeout");
}

function templateToRegex(template: string): RegExp {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withHoles = escaped.replace(/\\\{[A-Za-z_][A-Za-z0-9_]*\\\}/g, ".+");
  return new RegExp(`^${withHoles}$`);
}

export async function evaluateAssertion(
  page: Page,
  assertion: Assertion,
  params: ParamBindings = {},
): Promise<AssertionEvalResult> {
  const timeout = assertion.timeout_ms;

  try {
    switch (assertion.type) {
      case "element-visible": {
        const locSpec = assertion.target?.locator;
        if (!locSpec) {
          return {
            outcome: "ASSERTION_FAILED",
            message: "element-visible missing target.locator",
          };
        }
        let loc;
        try {
          loc = resolveLocator(page, locSpec);
        } catch (err) {
          if (err instanceof LocatorNotFoundError) {
            return { outcome: "LOCATOR_NOT_FOUND", message: err.message };
          }
          throw err;
        }
        const wantVisible = assertion.expected?.visible ?? true;
        await loc.first().waitFor({
          state: wantVisible ? "visible" : "hidden",
          timeout,
        });
        const visible = await loc.first().isVisible();
        if (visible === wantVisible) return { outcome: "PASS" };
        return {
          outcome: classificationToOutcome(assertion),
          message: `visibility expected ${wantVisible}, got ${visible}`,
        };
      }

      case "text-matches": {
        const locSpec = assertion.target?.locator;
        if (!locSpec) {
          return {
            outcome: "ASSERTION_FAILED",
            message: "text-matches missing target.locator",
          };
        }
        let loc;
        try {
          loc = resolveLocator(page, locSpec);
        } catch (err) {
          if (err instanceof LocatorNotFoundError) {
            return { outcome: "LOCATOR_NOT_FOUND", message: err.message };
          }
          throw err;
        }
        await loc.first().waitFor({ state: "attached", timeout });
        const text = (await loc.first().innerText()).trim();
        const regexTpl = assertion.expected?.regex_template;
        const tpl = assertion.expected?.template;
        if (regexTpl) {
          const re = new RegExp(interpolate(regexTpl, params));
          if (re.test(text)) return { outcome: "PASS" };
          return {
            outcome: classificationToOutcome(assertion),
            message: `text ${JSON.stringify(text)} !~ /${regexTpl}/`,
          };
        }
        if (tpl) {
          const expected = interpolate(tpl, params);
          if (text === expected || templateToRegex(tpl).test(text)) {
            return { outcome: "PASS" };
          }
          return {
            outcome: classificationToOutcome(assertion),
            message: `text ${JSON.stringify(text)} !~ template ${JSON.stringify(tpl)}`,
          };
        }
        return {
          outcome: "ASSERTION_FAILED",
          message: "text-matches missing expected.template/regex_template",
        };
      }

      case "url-matches": {
        const urlTpl =
          assertion.target?.url_template ?? assertion.expected?.template;
        const regexTpl = assertion.expected?.regex_template;
        const url = page.url();
        if (regexTpl) {
          const re = new RegExp(interpolate(regexTpl, params));
          if (re.test(url)) return { outcome: "PASS" };
          return {
            outcome: classificationToOutcome(assertion),
            message: `url ${JSON.stringify(url)} !~ /${regexTpl}/`,
          };
        }
        if (urlTpl) {
          const expected = interpolate(urlTpl, params);
          if (url === expected || templateToRegex(urlTpl).test(url)) {
            return { outcome: "PASS" };
          }
          return {
            outcome: classificationToOutcome(assertion),
            message: `url ${JSON.stringify(url)} !~ template ${JSON.stringify(urlTpl)}`,
          };
        }
        return {
          outcome: "ASSERTION_FAILED",
          message: "url-matches missing url_template/regex_template",
        };
      }

      case "count-equals": {
        const expected = assertion.expected?.count;
        if (expected === undefined) {
          return {
            outcome: "ASSERTION_FAILED",
            message: "count-equals missing expected.count",
          };
        }
        const scope =
          assertion.target?.count_scope ??
          assertion.target?.locator?.css ??
          assertion.target?.locator?.structural_path;
        if (!scope && !assertion.target?.locator) {
          return {
            outcome: "ASSERTION_FAILED",
            message: "count-equals missing count_scope/locator",
          };
        }
        let count: number;
        if (assertion.target?.locator) {
          const loc = resolveLocator(page, assertion.target.locator);
          count = await loc.count();
        } else {
          count = await page.locator(scope!).count();
        }
        if (count === expected) return { outcome: "PASS" };
        return {
          outcome: classificationToOutcome(assertion),
          message: `count expected ${expected}, got ${count}`,
        };
      }

      case "network-idle": {
        await page.waitForLoadState("networkidle", { timeout });
        return { outcome: "PASS" };
      }

      case "custom": {
        return {
          outcome: classificationToOutcome(assertion, "ASSERTION_FAILED"),
          message: `custom assertion not wired: ${assertion.expected?.custom_predicate_id ?? assertion.assertion_id}`,
        };
      }

      default: {
        const _exhaustive: never = assertion.type;
        return {
          outcome: "PAGE_ERROR",
          message: `unknown assertion type: ${String(_exhaustive)}`,
        };
      }
    }
  } catch (err) {
    if (err instanceof LocatorNotFoundError) {
      return { outcome: "LOCATOR_NOT_FOUND", message: err.message };
    }
    if (isTimeoutError(err)) {
      return {
        outcome: "TIMEOUT",
        message: err instanceof Error ? err.message : String(err),
      };
    }
    return {
      outcome: "PAGE_ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
