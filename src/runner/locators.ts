/**
 * Locator resolution via Playwright preferred APIs.
 * Sources:
 * - contracts/cache-row.schema.json locator strategies
 * - https://playwright.dev/docs/locators — access_date: 2026-07-24
 */

import type { Locator, Page } from "playwright";
import type { LocatorSpec } from "./types.js";

export class LocatorNotFoundError extends Error {
  readonly chain: LocatorSpec[];

  constructor(message: string, chain: LocatorSpec[] = []) {
    super(message);
    this.name = "LocatorNotFoundError";
    this.chain = chain;
  }
}

export function resolveLocator(page: Page, spec: LocatorSpec): Locator {
  switch (spec.strategy) {
    case "role_name": {
      if (!spec.role) {
        throw new LocatorNotFoundError(
          "role_name locator missing role",
          [spec],
        );
      }
      const opts = spec.name !== undefined ? { name: spec.name } : undefined;
      return page.getByRole(
        spec.role as Parameters<Page["getByRole"]>[0],
        opts,
      );
    }
    case "label": {
      if (!spec.label) {
        throw new LocatorNotFoundError("label locator missing label", [spec]);
      }
      return page.getByLabel(spec.label);
    }
    case "testid": {
      if (!spec.testid) {
        throw new LocatorNotFoundError(
          "testid locator missing testid",
          [spec],
        );
      }
      return page.getByTestId(spec.testid);
    }
    case "text": {
      if (!spec.text) {
        throw new LocatorNotFoundError("text locator missing text", [spec]);
      }
      return page.getByText(spec.text);
    }
    case "placeholder": {
      if (!spec.text && !spec.name) {
        throw new LocatorNotFoundError(
          "placeholder locator missing text/name",
          [spec],
        );
      }
      return page.getByPlaceholder(spec.text ?? spec.name!);
    }
    case "structural": {
      if (!spec.structural_path) {
        throw new LocatorNotFoundError(
          "structural locator missing structural_path",
          [spec],
        );
      }
      return page.locator(spec.structural_path);
    }
    case "css_vocab": {
      if (!spec.css) {
        throw new LocatorNotFoundError(
          "css_vocab locator missing css",
          [spec],
        );
      }
      return page.locator(spec.css);
    }
    case "topology_only": {
      // Degraded pool-safe stub — no concrete selector (cache-row.schema.json).
      throw new LocatorNotFoundError(
        "topology_only has no concrete selector; cannot resolve",
        [spec],
      );
    }
    default: {
      const _exhaustive: never = spec.strategy;
      throw new LocatorNotFoundError(
        `unknown locator strategy: ${String(_exhaustive)}`,
        [spec],
      );
    }
  }
}

/**
 * Try each locator in order; return the first with count > 0.
 * Throws LocatorNotFoundError if the chain is empty or all fail.
 */
export async function resolveWithFallback(
  page: Page,
  chain: LocatorSpec[],
): Promise<Locator> {
  if (chain.length === 0) {
    throw new LocatorNotFoundError("empty locator_fallback_chain", chain);
  }
  const failures: string[] = [];
  for (const spec of chain) {
    try {
      const loc = resolveLocator(page, spec);
      const count = await loc.count();
      if (count > 0) return loc.first();
      failures.push(`${spec.strategy}: matched 0`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${spec.strategy}: ${msg}`);
    }
  }
  throw new LocatorNotFoundError(
    `no locator matched (${failures.join("; ")})`,
    chain,
  );
}
