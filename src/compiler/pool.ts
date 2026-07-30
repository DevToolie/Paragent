import {
  collectStringEntries,
  isChromeLabel,
  looksLikeTenantLiteral,
  looksLikeTenantSelector,
  SELECTOR_KEYS,
} from "./literals.js";
import type {
  Assertion,
  CompiledLocator,
  PoolIneligibleReason,
} from "./types.js";

export interface PoolDecision {
  pool_eligible: boolean;
  pool_ineligible_reason: PoolIneligibleReason | null;
}

/**
 * Fail-closed pool eligibility. Scans locator chain + assertion target/expected
 * only (not notes / ids). B5 is authoritative; this is the compiler pre-check.
 */
export function decidePoolEligibility(args: {
  chain: CompiledLocator[];
  assertion: Assertion;
  topologyOnly: boolean;
}): PoolDecision {
  const { chain, assertion, topologyOnly } = args;

  if (topologyOnly) {
    return {
      pool_eligible: false,
      pool_ineligible_reason: "topology_only_degraded",
    };
  }

  if (chain.some((l) => l.tenant_scoped === true)) {
    return {
      pool_eligible: false,
      pool_ineligible_reason: "tenant_locator_text",
    };
  }

  if (
    chain.some(
      (l) =>
        (l.strategy === "text" || l.strategy === "placeholder") &&
        (l.text !== undefined || l.name !== undefined),
    )
  ) {
    return {
      pool_eligible: false,
      pool_ineligible_reason: "tenant_locator_text",
    };
  }

  // Mirror of B5's `assertionHasTenantLiteral` (src/cache/write.ts): anything
  // left in `expected.template` after the holes are removed is treated as a
  // literal. This pre-check must never be *more permissive* than the authority
  // — `writeCacheRow` throws `CacheWriteRejectedError` when a caller claims
  // pool_eligible and B5 disagrees, so a permissive pre-check is a crash, not a
  // leak, but a crash in the one path that has to work.
  //
  // Found by routing the live bundle through the write path (issue #25): the
  // compiler called every `url-matches` row poolable and B5 refused all four,
  // because a URL template's residue is its *path*. Whether refusing a path is
  // right is B5's call and a separate question — see docs/gate/compiler.md. The
  // compiler's job is to agree with it.
  const expectedTemplate = assertion.expected?.template;
  if (expectedTemplate !== undefined) {
    const residue = expectedTemplate
      .replace(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, "")
      .trim();
    if (residue.length > 0 && !isChromeLabel(residue) && !isChromeLabel(expectedTemplate)) {
      return {
        pool_eligible: false,
        pool_ineligible_reason: "literal_in_assertion",
      };
    }
  }

  const payload = {
    target: assertion.target,
    expected: assertion.expected,
  };
  // Key-aware on purpose: an assertion target can embed the same selector the
  // locator chain carries (`structural_path`, `count_scope`), and judging a CSS
  // path by the prose rule marked a live row `literal_in_assertion` for owning
  // a long DOM path — see looksLikeTenantSelector.
  for (const { key, value } of collectStringEntries(payload)) {
    const tainted = SELECTOR_KEYS.has(key)
      ? looksLikeTenantSelector(value)
      : looksLikeTenantLiteral(value);
    if (tainted) {
      return {
        pool_eligible: false,
        pool_ineligible_reason: "literal_in_assertion",
      };
    }
  }

  const KNOWN_ROLES = new Set([
    "button",
    "textbox",
    "checkbox",
    "radio",
    "link",
    "menuitem",
    "tab",
    "option",
    "combobox",
    "searchbox",
    "main",
    "form",
    "navigation",
    "banner",
    "contentinfo",
    "complementary",
    "heading",
    "img",
    "list",
    "listitem",
    "dialog",
    "alertdialog",
    "alert",
    "status",
  ]);
  for (const loc of chain) {
    if (loc.strategy === "role_name" && loc.role && !KNOWN_ROLES.has(loc.role)) {
      return {
        pool_eligible: false,
        pool_ineligible_reason: "non_vocab_role",
      };
    }
  }

  return { pool_eligible: true, pool_ineligible_reason: null };
}
