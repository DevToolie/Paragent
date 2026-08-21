import { checkLocatorTaint } from "../cache/taint.js";
import type { TaintReason } from "../cache/types.js";
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
 * The authority's taint vocabulary, expressed in the compiler's reason union.
 *
 * `TaintReason` (src/cache/types.ts) is finer-grained than the schema-visible
 * `PoolIneligibleReason`, so the mapping is lossy on purpose — the boolean is
 * what `writeCacheRow` compares, and the reason is for a human reading the row.
 */
const TAINT_REASON_TO_POOL_REASON: Record<TaintReason, PoolIneligibleReason> = {
  caller_marked_tenant: "tenant_locator_text",
  free_text: "tenant_locator_text",
  aria_or_name_tenant: "tenant_locator_text",
  role_text_tenant: "tenant_locator_text",
  non_vocab_role: "non_vocab_role",
  non_vocab_testid: "tainted_attribute",
  non_vocab_attr: "tainted_attribute",
  structural_free_text: "tainted_attribute",
};

/**
 * Mirror of B5's `assertionHasTenantLiteral` (src/cache/write.ts).
 *
 * Three checks, and all three have to be here because the authority runs all
 * three. Anything left in `expected.template` after the holes are removed is
 * treated as a literal.
 *
 * Found by routing the live bundle through the write path (issue #25): the
 * compiler called every `url-matches` row poolable and B5 refused all four,
 * because a URL template's residue is its *path*. Whether refusing a path is
 * right is B5's call and a separate question — see docs/gate/compiler.md. The
 * compiler's job is to agree with it.
 */
function assertionLiteralReason(assertion: Assertion): PoolIneligibleReason | null {
  const expectedTemplate = assertion.expected?.template;
  if (expectedTemplate !== undefined) {
    const residue = expectedTemplate
      .replace(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, "")
      .trim();
    if (residue.length > 0 && !isChromeLabel(residue) && !isChromeLabel(expectedTemplate)) {
      return "literal_in_assertion";
    }
  }

  // The assertion's own target locator goes through the *authority's* checker,
  // not the prose heuristics below (#170). `assertionHasTenantLiteral` runs
  // `checkLocatorTaint(assertion.target.locator)`, which is a vocabulary
  // allowlist — and a value like `testid: "dismiss-notice"` is a plain kebab
  // string that no prose rule flags but `isPoolSafeTestId` rejects outright.
  //
  // This gap predates #170. It was unreachable while the pre-check refused any
  // chain containing a `tenant_scoped` locator, because the fixture rows that
  // hit it were already refused a step earlier for a different reason. Removing
  // that blanket refusal (correctly) exposed it, and the pre-check went
  // *looser* than the authority — which `writeCacheRow` answers with a
  // `CacheWriteRejectedError`, crashing record -> compile -> cache.
  const targetLocator = assertion.target?.locator;
  if (targetLocator && checkLocatorTaint(targetLocator as CompiledLocator).tainted) {
    return "literal_in_assertion";
  }

  // Key-aware on purpose: an assertion target can embed the same selector the
  // locator chain carries (`structural_path`, `count_scope`), and judging a CSS
  // path by the prose rule marked a live row `literal_in_assertion` for owning
  // a long DOM path — see looksLikeTenantSelector.
  const payload = { target: assertion.target, expected: assertion.expected };
  for (const { key, value } of collectStringEntries(payload)) {
    const tainted = SELECTOR_KEYS.has(key)
      ? looksLikeTenantSelector(value)
      : looksLikeTenantLiteral(value);
    if (tainted) return "literal_in_assertion";
  }

  return null;
}

/**
 * Fail-closed pool eligibility. Scans locator chain + assertion target/expected
 * only (not notes / ids). B5 is authoritative; this is the compiler pre-check.
 *
 * **This pre-check must never be more permissive than the authority.**
 * `writeCacheRow` throws `CacheWriteRejectedError` when a caller claims
 * `pool_eligible` and B5 disagrees, so a permissive pre-check is a crash, not a
 * leak — but a crash in the one path that has to work.
 *
 * The way it stays aligned (#170 / ADR-0019) is by calling the authority's own
 * `checkLocatorTaint` rather than re-deriving the vocabulary here. Before that,
 * three separate approximations had drifted: a strategy-based strip that missed
 * non-vocabulary `testid`s, an assertion check that skipped the target locator,
 * and a topology branch keyed off the wrong field. Branch order below mirrors
 * `buildPoolRow` so the reported reason matches too, not just the boolean.
 */
export function decidePoolEligibility(args: {
  chain: CompiledLocator[];
  assertion: Assertion;
  /**
   * Retained for the caller's benefit, deliberately unread.
   *
   * `buildLocatorFallbackChain` sets this `true` only in the branch that also
   * appends the `topology_only` sentinel to `chain` (src/compiler/locators.ts),
   * so it is exactly equivalent to a property of `chain` — and the chain is
   * what the authority sees. Branching on the flag instead is how the first cut
   * of #170 ended up asking a different question than `buildPoolRow` does.
   */
  topologyOnly: boolean;
  /**
   * Whether the row will carry `flow_topology`. The authority degrades an
   * all-tainted chain to a locator-less `topology_only` pool row only when this
   * is present (`buildPoolRow`, src/cache/write.ts), so the pre-check cannot
   * assume it. `compileStep` computes `flow_topology` before deciding and
   * passes the answer in.
   */
  hasFlowTopology?: boolean;
}): PoolDecision {
  const { chain, assertion, hasFlowTopology = false } = args;

  // 1. Assertion first — same order as `buildPoolRow`, so a row that fails both
  //    the assertion check and the locator check reports the assertion reason.
  const assertionReason = assertionLiteralReason(assertion);
  if (assertionReason) {
    return { pool_eligible: false, pool_ineligible_reason: assertionReason };
  }

  // 2. Classify the chain with the authority's predicate. A `topology_only`
  //    sentinel is untainted by definition (`createTaintChecker` short-circuits
  //    on it), so a chain the compiler degraded lands in `poolSafe` here and in
  //    `classifyLocators` there — the two agree by construction rather than by
  //    a rule written twice.
  const taints = chain.map((locator) => checkLocatorTaint(locator));
  if (taints.some((t) => !t.tainted)) {
    return { pool_eligible: true, pool_ineligible_reason: null };
  }

  // 3. Nothing pool-safe survived. The authority still pools when it can
  //    degrade to a locator-less topology row.
  if (hasFlowTopology) {
    return { pool_eligible: true, pool_ineligible_reason: null };
  }

  // 4. Refuse, naming the first taint the way the authority does.
  const firstReason = taints.flatMap((t) => t.reasons)[0];
  return {
    pool_eligible: false,
    pool_ineligible_reason: firstReason
      ? TAINT_REASON_TO_POOL_REASON[firstReason]
      : chain.length === 0
        ? "topology_only_degraded"
        : "other",
  };
}
