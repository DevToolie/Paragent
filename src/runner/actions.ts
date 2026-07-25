/**
 * Action execution with locator fallback.
 * Sources: contracts/cache-row.schema.json; Playwright actions docs — access_date: 2026-07-24
 */

import type { Page } from "playwright";
import {
  LocatorNotFoundError,
  resolveWithFallback,
} from "./locators.js";
import { interpolate } from "./templates.js";
import type { CompiledAction, ParamBindings } from "./types.js";

export interface ActionResult {
  ok: boolean;
  outcome?: "LOCATOR_NOT_FOUND" | "TIMEOUT" | "PAGE_ERROR";
  message?: string;
}

function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name.toLowerCase();
  const msg = err.message.toLowerCase();
  return name.includes("timeout") || msg.includes("timeout");
}

function firstParam(
  action: CompiledAction,
  params: ParamBindings,
): string | number | boolean | undefined {
  const refs = action.param_refs ?? [];
  for (const ref of refs) {
    if (Object.prototype.hasOwnProperty.call(params, ref)) return params[ref];
  }
  return undefined;
}

export async function executeAction(
  page: Page,
  action: CompiledAction,
  params: ParamBindings = {},
): Promise<ActionResult> {
  try {
    switch (action.type) {
      case "navigate": {
        if (!action.url_template) {
          return {
            ok: false,
            outcome: "PAGE_ERROR",
            message: "navigate missing url_template",
          };
        }
        const url = interpolate(action.url_template, params);
        await page.goto(url, { waitUntil: "domcontentloaded" });
        return { ok: true };
      }

      case "click": {
        const loc = await resolveWithFallback(
          page,
          action.locator_fallback_chain,
        );
        await loc.click();
        return { ok: true };
      }

      case "fill": {
        const loc = await resolveWithFallback(
          page,
          action.locator_fallback_chain,
        );
        const value = firstParam(action, params);
        if (value === undefined) {
          return {
            ok: false,
            outcome: "PAGE_ERROR",
            message: "fill missing bound param value",
          };
        }
        await loc.fill(String(value));
        return { ok: true };
      }

      case "select": {
        const loc = await resolveWithFallback(
          page,
          action.locator_fallback_chain,
        );
        const value = firstParam(action, params);
        if (value === undefined) {
          return {
            ok: false,
            outcome: "PAGE_ERROR",
            message: "select missing bound param value",
          };
        }
        await loc.selectOption(String(value));
        return { ok: true };
      }

      case "check": {
        const loc = await resolveWithFallback(
          page,
          action.locator_fallback_chain,
        );
        await loc.check();
        return { ok: true };
      }

      case "uncheck": {
        const loc = await resolveWithFallback(
          page,
          action.locator_fallback_chain,
        );
        await loc.uncheck();
        return { ok: true };
      }

      case "press": {
        const key = action.key ? interpolate(action.key, params) : undefined;
        if (!key) {
          return {
            ok: false,
            outcome: "PAGE_ERROR",
            message: "press missing key",
          };
        }
        if (action.locator_fallback_chain.length > 0) {
          const loc = await resolveWithFallback(
            page,
            action.locator_fallback_chain,
          );
          await loc.press(key);
        } else {
          await page.keyboard.press(key);
        }
        return { ok: true };
      }

      case "hover": {
        const loc = await resolveWithFallback(
          page,
          action.locator_fallback_chain,
        );
        await loc.hover();
        return { ok: true };
      }

      case "wait": {
        const msRaw = firstParam(action, params);
        const ms =
          typeof msRaw === "number"
            ? msRaw
            : msRaw !== undefined
              ? Number(msRaw)
              : 0;
        if (Number.isFinite(ms) && ms > 0) {
          await page.waitForTimeout(ms);
        } else {
          await page.waitForLoadState("networkidle");
        }
        return { ok: true };
      }

      case "upload": {
        const loc = await resolveWithFallback(
          page,
          action.locator_fallback_chain,
        );
        const pathValue = firstParam(action, params);
        if (pathValue === undefined) {
          return {
            ok: false,
            outcome: "PAGE_ERROR",
            message: "upload missing file path param",
          };
        }
        await loc.setInputFiles(String(pathValue));
        return { ok: true };
      }

      case "custom": {
        return {
          ok: false,
          outcome: "PAGE_ERROR",
          message: `custom action not wired: ${action.custom_op ?? "unknown"}`,
        };
      }

      default: {
        const _exhaustive: never = action.type;
        return {
          ok: false,
          outcome: "PAGE_ERROR",
          message: `unknown action type: ${String(_exhaustive)}`,
        };
      }
    }
  } catch (err) {
    if (err instanceof LocatorNotFoundError) {
      return { ok: false, outcome: "LOCATOR_NOT_FOUND", message: err.message };
    }
    if (isTimeoutError(err)) {
      return {
        ok: false,
        outcome: "TIMEOUT",
        message: err instanceof Error ? err.message : String(err),
      };
    }
    return {
      ok: false,
      outcome: "PAGE_ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
