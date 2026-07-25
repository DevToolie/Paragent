import { looksLikeTenantLiteral } from "./literals.js";
import {
  LOCATOR_PREFERENCE,
  type CompiledLocator,
  type LocatorCandidate,
  type LocatorStrategy,
} from "./types.js";

function preferenceIndex(strategy: LocatorStrategy): number {
  if (strategy === "topology_only") return LOCATOR_PREFERENCE.length + 1;
  const idx = LOCATOR_PREFERENCE.indexOf(strategy);
  return idx === -1 ? LOCATOR_PREFERENCE.length : idx;
}

/** Sort candidates into B2 preference order, then by recorder rank ascending. */
export function orderLocatorCandidates(
  candidates: LocatorCandidate[],
): LocatorCandidate[] {
  return [...candidates].sort((a, b) => {
    const pref = preferenceIndex(a.strategy) - preferenceIndex(b.strategy);
    if (pref !== 0) return pref;
    return a.rank - b.rank;
  });
}

function candidateToCompiled(c: LocatorCandidate): CompiledLocator {
  const out: CompiledLocator = { strategy: c.strategy };
  if (c.role !== undefined) out.role = c.role;
  if (c.name !== undefined) out.name = c.name;
  if (c.label !== undefined) out.label = c.label;
  if (c.testid !== undefined) out.testid = c.testid;
  if (c.structural_path !== undefined) out.structural_path = c.structural_path;
  if (c.text !== undefined) out.text = c.text;
  if (c.css !== undefined) out.css = c.css;
  if (c.tenant_scoped !== undefined) out.tenant_scoped = c.tenant_scoped;
  return out;
}

function locatorFieldsLookTainted(loc: CompiledLocator): boolean {
  const fields = [
    loc.name,
    loc.label,
    loc.text,
    loc.testid,
    loc.css,
    loc.structural_path,
  ];
  for (const f of fields) {
    if (f !== undefined && looksLikeTenantLiteral(f)) return true;
  }
  return loc.tenant_scoped === true;
}

/**
 * Build ordered locator_fallback_chain.
 * Empty candidates (navigate/wait) → empty chain (valid).
 * All candidates tainted → keep them marked + append topology_only.
 */
export function buildLocatorFallbackChain(
  candidates: LocatorCandidate[],
): { chain: CompiledLocator[]; topologyOnly: boolean } {
  if (candidates.length === 0) {
    return { chain: [], topologyOnly: false };
  }

  const ordered = orderLocatorCandidates(candidates);
  const chain: CompiledLocator[] = [];

  for (const c of ordered) {
    const compiled = candidateToCompiled(c);
    if (
      looksLikeTenantLiteral(c.name ?? "") ||
      looksLikeTenantLiteral(c.label ?? "") ||
      looksLikeTenantLiteral(c.text ?? "")
    ) {
      compiled.tenant_scoped = true;
    }
    if (
      compiled.strategy === "css_vocab" &&
      compiled.css !== undefined &&
      looksLikeTenantLiteral(compiled.css)
    ) {
      compiled.tenant_scoped = true;
    }
    chain.push(compiled);
  }

  const allTainted = chain.every(locatorFieldsLookTainted);
  if (allTainted) {
    return {
      chain: [...chain, { strategy: "topology_only", tenant_scoped: false }],
      topologyOnly: true,
    };
  }

  return { chain, topologyOnly: false };
}

export function pickPrimaryLocator(
  chain: CompiledLocator[],
): CompiledLocator | undefined {
  return (
    chain.find(
      (l) => l.strategy !== "topology_only" && l.tenant_scoped !== true,
    ) ?? chain.find((l) => l.strategy !== "topology_only")
  );
}
