/**
 * The repair model's context budget (ADR-0012, issue #125).
 *
 * `RepairContext.page_state` used to be exactly one thing: `url`, `title`,
 * `network_idle`, and a list of ARIA **landmark role names** — `["main",
 * "navigation"]`. The task set for the model was: given a failed locator, a
 * URL, a title and the string `"main"`, produce a corrected locator that
 * resolves on a page it cannot see.
 *
 * That is not a hard task, it is an underdetermined one. #125's argument is the
 * reason this module exists: on a cache miss the system pays replay **plus**
 * repair **plus** the fresh run it still has to do, so a repair that reliably
 * fails is worse than never having cached. And PRD §9's kill line is a *ratio*
 * — `mean repair cost ≥ 70% of fresh` — so a structurally impossible repair
 * does not merely score badly, it pushes the project toward FAIL for a reason
 * that is a design parameter rather than a property of the thesis under test.
 *
 * ## The levels
 *
 * | Level | Adds | Status |
 * | --- | --- | --- |
 * | `landmarks` | landmark role names | the pre-#125 behaviour, kept as the floor |
 * | `interactive` | role + accessible name of interactive elements | **the chosen default** |
 * | `tree` | the above, plus non-interactive structure, values stripped | available, not default |
 *
 * A fourth level — a DOM excerpt with allowlisted attributes — was considered
 * and **rejected** in ADR-0012 rather than left unimplemented-but-blessed. See
 * that ADR for why; the short version is that it is the first level whose
 * output cannot be reviewed by reading a fixed field list.
 *
 * ## What every level excludes, unconditionally
 *
 * No text content, no input values, no attribute values other than the
 * allowlisted structural ones, no cookies, no storage. The capture reads
 * `role`, accessible `name`, and a small set of state flags — and an element's
 * *value* is never read, at any level, which is what keeps a filled password
 * field from becoming context. `stripValues` is not a setting.
 *
 * ## Why a JS source string
 *
 * Same reason as `src/shared/landmarks.ts`, and the reason is load-bearing:
 * esbuild (through tsx and vitest) applies `keepNames`, which wraps named
 * function expressions in `__name(...)`. That helper does not exist in the
 * browser, so a serialized callback throws `ReferenceError: __name is not
 * defined` (PR #73). The shared unit is text, not a function.
 */

import { VISIBILITY_PREDICATE_JS } from "./landmarks.js";

/** Context levels, ordered by increasing capability and increasing exposure. */
export const CONTEXT_LEVELS = ["landmarks", "interactive", "tree"] as const;

export type ContextLevel = (typeof CONTEXT_LEVELS)[number];

/**
 * What a repair gets unless a caller says otherwise.
 *
 * `interactive` rather than `landmarks`: a corrected **locator** is a role plus
 * an accessible name, so a context carrying no role/name pairs cannot contain
 * the answer the model is asked to produce. At `landmarks` that is true by
 * construction — `elements` is empty — which is a property of the design, not a
 * measurement, and ADR-0012 states it that way.
 *
 * `interactive` rather than `tree`: measured on live Grafana 9.5.21
 * (ADR-0012), `tree` found **no target the `interactive` level did not** on
 * either page sampled, while adding 19% to the payload on `/dashboard/new` and
 * 63% on the home page. A repair proposes an action against something
 * actionable; non-interactive structure is orientation the model did not need
 * to locate any of the task's targets.
 */
export const DEFAULT_CONTEXT_LEVEL: ContextLevel = "interactive";

/** One interactive element, as the model is allowed to see it. */
export interface ContextElement {
  role: string;
  /** Accessible name. Never an input's value — see the module note. */
  name: string;
  /** Present only when the element is disabled/checked/expanded. */
  state?: string[];
}

/**
 * Attributes the capture may read to compute a role or an accessible name.
 *
 * An allowlist rather than a denylist, and a short one: everything here is
 * structural or ARIA. `value`, `placeholder`, `title` and `alt` are absent on
 * purpose — each can carry user- or tenant-authored text, and `placeholder` in
 * particular is a real locator strategy the compiler uses, which makes it
 * tempting and wrong to include here.
 */
export const CONTEXT_ATTRIBUTE_ALLOWLIST: readonly string[] = [
  "role",
  "aria-label",
  "aria-labelledby",
  "aria-disabled",
  "aria-checked",
  "aria-expanded",
  "disabled",
  "type",
];

/**
 * Browser-side capture, as text.
 *
 * Returns `ContextElement[]`. Visibility is `VISIBILITY_PREDICATE_JS`,
 * interpolated from `landmarks.ts` rather than restated — a repair shown
 * elements the recorder never saw is the ADR-0007 bug in a new place, and a
 * second copy of the predicate is the #74 bug in a new place.
 *
 * That import is also why this file must not spell the DOM API name in prose:
 * `tests/unit/landmarks.test.ts` greps `src/` for it and asserts exactly one
 * carrier. The guard caught a real second copy here during #125 and then caught
 * this comment — narrow, but it is the narrowness that makes it hold.
 *
 * The `level` argument is interpolated by the caller, not read from scope: the
 * body is serialized into a page that has no access to this module.
 */
export function contextExpression(level: ContextLevel): string {
  // Interactive roles a repair could plausibly target. Deliberately not "every
  // element": a corrected action clicks, fills or selects something.
  const interactiveSelector = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    "summary",
    "[role=button]",
    "[role=link]",
    "[role=textbox]",
    "[role=combobox]",
    "[role=checkbox]",
    "[role=radio]",
    "[role=tab]",
    "[role=menuitem]",
    "[role=switch]",
    "[role=option]",
  ].join(",");

  // Structural roles added at `tree`. Non-interactive, so they cannot be the
  // target of a corrected action — they are orientation only.
  const structuralSelector = [
    "[role=heading]",
    "h1",
    "h2",
    "h3",
    "[role=tablist]",
    "[role=dialog]",
    "[role=list]",
  ].join(",");

  const selector =
    level === "tree" ? `${interactiveSelector},${structuralSelector}` : interactiveSelector;

  return `(() => {
    if (${level === "landmarks" ? "true" : "false"}) return [];
    ${VISIBILITY_PREDICATE_JS}
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll(${JSON.stringify(selector)})) {
      if (!paragentIsVisible(el)) continue;

      // Role: explicit first, then a small implicit map. No text is read here.
      let role = el.getAttribute("role");
      if (!role) {
        const tag = el.tagName.toLowerCase();
        if (tag === "a") role = "link";
        else if (tag === "button" || tag === "summary") role = "button";
        else if (tag === "select") role = "combobox";
        else if (tag === "textarea") role = "textbox";
        else if (tag === "h1" || tag === "h2" || tag === "h3") role = "heading";
        else if (tag === "input") {
          const t = (el.getAttribute("type") || "text").toLowerCase();
          role = t === "checkbox" ? "checkbox"
               : t === "radio" ? "radio"
               : t === "submit" || t === "button" ? "button"
               : "textbox";
        } else role = tag;
      }

      // Accessible name: aria-label, then the referenced label, then the
      // associated <label>, then trimmed text for elements whose name comes
      // from content. An input's VALUE is never read — that is the line this
      // capture does not cross, at any level.
      let name = el.getAttribute("aria-label") || "";
      if (!name) {
        const ref = el.getAttribute("aria-labelledby");
        if (ref) {
          const labelled = ref.split(/\\s+/).map((id) => {
            const n = document.getElementById(id);
            return n ? (n.textContent || "").trim() : "";
          }).filter(Boolean).join(" ");
          if (labelled) name = labelled;
        }
      }
      if (!name && el.id) {
        const lab = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (lab) name = (lab.textContent || "").trim();
      }
      if (!name) {
        const closestLabel = el.closest("label");
        if (closestLabel) name = (closestLabel.textContent || "").trim();
      }
      if (!name && (role === "button" || role === "link" || role === "heading" || role === "tab" || role === "menuitem" || role === "option")) {
        name = (el.textContent || "").trim();
      }
      name = name.replace(/\\s+/g, " ").slice(0, 120);

      const state = [];
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") state.push("disabled");
      if (el.getAttribute("aria-checked") === "true") state.push("checked");
      if (el.getAttribute("aria-expanded") === "true") state.push("expanded");

      // Collapse duplicates: a list of forty identical "Delete" buttons tells
      // the model nothing it does not learn from one.
      const key = role + "\\u0000" + name;
      if (seen.has(key)) continue;
      seen.add(key);

      const entry = { role: role, name: name };
      if (state.length > 0) entry.state = state;
      out.push(entry);
      if (out.length >= 120) break;
    }
    return out;
  })()`;
}
