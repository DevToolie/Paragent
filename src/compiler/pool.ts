import { collectStringLeaves, looksLikeTenantLiteral } from "./literals.js";
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

  const payload = {
    target: assertion.target,
    expected: assertion.expected,
  };
  for (const leaf of collectStringLeaves(payload)) {
    if (looksLikeTenantLiteral(leaf)) {
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
