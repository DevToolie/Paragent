import type { Locator } from "playwright";
import type { LocatorCandidate } from "./types.js";

/**
 * Preference order: role_name > label > testid > structural > text
 * Sources: https://playwright.dev/docs/locators — access_date: 2026-07-25
 */

interface ElementLocatorSignals {
  role: string | null;
  accessibleName: string | null;
  label: string | null;
  testid: string | null;
  placeholder: string | null;
  text: string | null;
  structuralPath: string;
}

function truncate(s: string | null | undefined, max = 80): string | null {
  if (s == null) return null;
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Built at runtime so tsx/esbuild cannot inject `__name` into the browser VM. */
const EXTRACT_LOCATOR_SIGNALS = new Function(
  "el",
  `
    const implicitRole = () => {
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (tag === "a" && el.hasAttribute("href")) return "link";
      if (tag === "button") return "button";
      if (tag === "input") {
        if (type === "checkbox") return "checkbox";
        if (type === "radio") return "radio";
        if (type === "submit" || type === "button") return "button";
        if (type === "password" || type === "email" || type === "text" || type === "search" || type === "")
          return "textbox";
      }
      if (tag === "textarea") return "textbox";
      if (tag === "select") return "combobox";
      if (["h1","h2","h3","h4","h5","h6"].includes(tag)) return "heading";
      return el.getAttribute("role");
    };
    const labelledBy = el.getAttribute("aria-labelledby");
    let labelText = null;
    if (labelledBy) {
      labelText = labelledBy.split(/\\s+/).map((id) => {
        const node = document.getElementById(id);
        return node ? (node.textContent || "") : "";
      }).join(" ").trim();
    }
    if (!labelText && el.labels && el.labels.length) {
      labelText = Array.from(el.labels).map((l) => l.textContent || "").join(" ").trim();
    }
    if (!labelText) labelText = el.getAttribute("aria-label");
    const accessibleName =
      el.getAttribute("aria-label") || labelText || el.placeholder ||
      (el.textContent || "").trim() || null;
    const pathParts = [];
    let cur = el;
    while (cur && cur !== document.body && pathParts.length < 12) {
      const parent = cur.parentElement;
      if (!parent) break;
      const tag = cur.tagName.toLowerCase();
      const sameTag = Array.from(parent.children).filter((c) => c.tagName.toLowerCase() === tag);
      const idx = sameTag.indexOf(cur) + 1;
      pathParts.unshift(sameTag.length > 1 ? tag + ":nth-of-type(" + idx + ")" : tag);
      cur = parent;
    }
    return {
      role: el.getAttribute("role") || implicitRole(),
      accessibleName,
      label: labelText,
      testid: el.getAttribute("data-testid"),
      placeholder: el.getAttribute("placeholder"),
      text: (el.textContent || "").trim().slice(0, 120) || null,
      structuralPath: pathParts.length ? "body > " + pathParts.join(" > ") : "body",
    };
  `,
) as (el: unknown) => ElementLocatorSignals;

export async function collectLocatorCandidates(
  locator: Locator,
): Promise<LocatorCandidate[]> {
  const signals = (await locator.evaluate(EXTRACT_LOCATOR_SIGNALS)) as ElementLocatorSignals;

  const candidates: LocatorCandidate[] = [];
  let rank = 1;
  const name = truncate(signals.accessibleName);
  const label = truncate(signals.label);
  const text = truncate(signals.text);
  const placeholder = truncate(signals.placeholder);

  if (signals.role && name) {
    candidates.push({
      strategy: "role_name",
      rank: rank++,
      role: signals.role,
      name,
      tenant_scoped: true,
    });
  }
  if (label) {
    candidates.push({ strategy: "label", rank: rank++, label, tenant_scoped: true });
  }
  if (signals.testid) {
    candidates.push({
      strategy: "testid",
      rank: rank++,
      testid: signals.testid,
      tenant_scoped: false,
    });
  }
  candidates.push({
    strategy: "structural",
    rank: rank++,
    structural_path: signals.structuralPath,
    tenant_scoped: false,
  });
  if (text && text !== name && text !== label) {
    candidates.push({ strategy: "text", rank: rank++, text, tenant_scoped: true });
  }
  if (placeholder) {
    candidates.push({
      strategy: "placeholder",
      rank: rank++,
      name: placeholder,
      tenant_scoped: true,
    });
  }
  return candidates;
}
