/**
 * Selector taint-checking — named rules so mutation tests can disable one.
 * Sources: Wave pack Agent B5; contracts/cache-row.schema.json; allowlist.ts
 */

import {
  ALLOWED_CSS_ATTR_NAMES,
  DENIED_CSS_ATTR_NAMES,
  isAllowedRole,
  isAllowedTestId,
  isChromeName,
  isPoolSafeAccessibleName,
  isPoolSafeStructuralPath,
  isPoolSafeTestId,
  isTemplateOnly,
} from "./allowlist.js";
import type { CompiledLocator, LocatorTaintResult, TaintReason } from "./types.js";

export interface TaintRule {
  id: string;
  description: string;
  check: (locator: CompiledLocator) => TaintReason | null;
}

const ATTR_IN_CSS_RE = /\[([a-zA-Z_:][\w:.-]*)/g;

function cssAttrNames(css: string): string[] {
  const names: string[] = [];
  ATTR_IN_CSS_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_IN_CSS_RE.exec(css)) !== null) {
    const name = m[1];
    if (name) names.push(name.toLowerCase());
  }
  return names;
}

function accessibleStrings(locator: CompiledLocator): string[] {
  const out: string[] = [];
  if (locator.name !== undefined) out.push(locator.name);
  if (locator.label !== undefined) out.push(locator.label);
  if (locator.text !== undefined) out.push(locator.text);
  return out;
}

export const DEFAULT_TAINT_RULES: readonly TaintRule[] = [
  {
    id: "caller_marked_tenant",
    description: "Honor explicit tenant_scoped=true from upstream.",
    check: (loc) => (loc.tenant_scoped === true ? "caller_marked_tenant" : null),
  },
  {
    id: "free_text_strategy",
    description: "strategy=text is always tenant-scoped.",
    check: (loc) => {
      if (loc.strategy === "text" || loc.strategy === "placeholder") {
        const value = loc.text ?? loc.name ?? loc.label ?? "";
        if (value.length === 0) return "free_text";
        if (!isTemplateOnly(value) && !isChromeName(value)) return "free_text";
        if (loc.strategy === "text") return "free_text";
      }
      return null;
    },
  },
  {
    id: "non_vocab_css_attr",
    description: "Non-allowlisted CSS attrs (e.g. data-account-id) are tainted.",
    check: (loc) => {
      if (loc.strategy !== "css_vocab" && loc.css === undefined) return null;
      const css = loc.css ?? "";
      if (!css) return loc.strategy === "css_vocab" ? "non_vocab_attr" : null;
      const attrs = cssAttrNames(css);
      if (attrs.length === 0) {
        if (/data-account|data-user|data-tenant|data-customer/i.test(css)) {
          return "non_vocab_attr";
        }
        return null;
      }
      for (const attr of attrs) {
        if (DENIED_CSS_ATTR_NAMES.has(attr)) return "non_vocab_attr";
        if (!ALLOWED_CSS_ATTR_NAMES.has(attr)) return "non_vocab_attr";
      }
      const valueRe = /\[\s*[\w:.-]+\s*(?:=|\*=|\^=|\$=|~=|\|=)\s*(['"])(.*?)\1/g;
      let vm: RegExpExecArray | null;
      while ((vm = valueRe.exec(css)) !== null) {
        const val = vm[2] ?? "";
        if (val && !isChromeName(val) && !isTemplateOnly(val) && !isAllowedTestId(val)) {
          return "non_vocab_attr";
        }
      }
      return null;
    },
  },
  {
    id: "aria_label_or_name_tenant",
    description:
      "Accessible names/labels not chrome, template, or known pinned-version vendor vocabulary (#126) are tainted.",
    check: (loc) => {
      if (loc.strategy !== "role_name" && loc.strategy !== "label") return null;
      for (const s of accessibleStrings(loc)) {
        if (!isPoolSafeAccessibleName(s)) return "aria_or_name_tenant";
      }
      return null;
    },
  },
  {
    id: "role_text_tenant",
    description: "role_name with non-chrome, non-vendor-vocabulary text field is tainted.",
    check: (loc) => {
      if (loc.strategy !== "role_name") return null;
      if (loc.text !== undefined && !isPoolSafeAccessibleName(loc.text)) {
        return "role_text_tenant";
      }
      return null;
    },
  },
  {
    id: "non_vocab_role",
    description: "ARIA roles outside the fixed vocabulary are tainted.",
    check: (loc) => {
      if (loc.role === undefined) return null;
      if (!isAllowedRole(loc.role)) return "non_vocab_role";
      return null;
    },
  },
  {
    id: "non_vocab_testid",
    description: "testid values outside chrome / vendor vocabulary are tainted.",
    check: (loc) => {
      if (loc.strategy !== "testid" && loc.testid === undefined) return null;
      const id = loc.testid ?? "";
      if (!id || !isPoolSafeTestId(id)) return "non_vocab_testid";
      return null;
    },
  },
  {
    id: "structural_free_text",
    description: "Structural paths must not embed free text or attr selectors.",
    check: (loc) => {
      if (loc.strategy !== "structural" && loc.structural_path === undefined) return null;
      const path = loc.structural_path ?? "";
      if (!path || !isPoolSafeStructuralPath(path)) return "structural_free_text";
      return null;
    },
  },
];

export function createTaintChecker(
  rules: readonly TaintRule[] = DEFAULT_TAINT_RULES,
): (locator: CompiledLocator) => LocatorTaintResult {
  return (locator: CompiledLocator): LocatorTaintResult => {
    if (locator.strategy === "topology_only") {
      return { tainted: false, reasons: [], rulesFired: [] };
    }
    const reasons: TaintReason[] = [];
    const rulesFired: string[] = [];
    for (const rule of rules) {
      const reason = rule.check(locator);
      if (reason) {
        reasons.push(reason);
        rulesFired.push(rule.id);
      }
    }
    return { tainted: reasons.length > 0, reasons, rulesFired };
  };
}

export const checkLocatorTaint = createTaintChecker(DEFAULT_TAINT_RULES);

export function taintRulesWithout(ruleId: string): TaintRule[] {
  return DEFAULT_TAINT_RULES.filter((r) => r.id !== ruleId);
}
