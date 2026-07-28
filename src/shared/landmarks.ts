/**
 * The one landmark enumeration. Both capture sites run this and nothing else.
 *
 * `visible_landmarks` is a `contracts/trajectory.schema.json` field, written by
 * `src/recorder/fingerprint.ts` and mirrored by `src/runner/page-state.ts` into
 * `RepairContext.page_state`. ADR-0007 made both sites share the visibility
 * **predicate** and left them enumerating different elements: the recorder
 * walked the tree with implicit roles against an 8-role set, `page-state`
 * checked 6 `[role=]` selectors with tag fallbacks for only `main`/`nav`/`form`.
 * On semantic markup they disagreed by `banner`, `complementary`, `contentinfo`
 * — issue #74. Two copies of the walk is what produced that; this module exists
 * so there is one.
 *
 * ## Why a JS source string and not a TypeScript function
 *
 * Both sites hand their evaluate body to the browser as **text** — the recorder
 * via `new Function`, `page-state` via `page.evaluate("...")` — because esbuild
 * (through tsx and vitest) applies `keepNames`, which wraps named function
 * expressions in `__name(...)`. That helper does not exist in the browser, so a
 * serialized callback throws `ReferenceError: __name is not defined` (PR #73).
 * Sharing a real TS function would reintroduce that crash, and CI could not see
 * it: the runner's only caller is the repair loop, which the gate:matrix exit-2
 * guard keeps unreached. So the shared unit is a string. Guarded by
 * `tests/unit/page-state.test.ts` and `tests/unit/landmarks.test.ts`.
 *
 * ## Why `src/shared/`
 *
 * `src/runner/` importing from `src/recorder/` would invert the pipeline
 * dependency; the reverse is no better. `contracts/` holds language-neutral JSON
 * Schemas and is outside `tsconfig.json`'s `include`, so a `.ts` file there
 * would go untypechecked. This package is deliberately narrow: in-page source
 * strings needed by more than one capture site, nothing else.
 */

/**
 * ARIA landmark roles that count towards `visible_landmarks`. The recorder's
 * 8-role set, kept as-is: it writes the contract field, so it is the authority.
 *
 * `search` and `region` have no entry in the implicit map below — they are
 * reached through an explicit `role=` attribute only. See the open question in
 * ADR-0007 about `<search>` and named `<section>`.
 */
export const LANDMARK_ROLES = [
  "banner",
  "navigation",
  "main",
  "contentinfo",
  "complementary",
  "form",
  "search",
  "region",
] as const;

/** Tag name to implicit ARIA landmark role, for markup with no `role=`. */
export const IMPLICIT_LANDMARK_ROLE_BY_TAG: ReadonlyArray<readonly [string, string]> = [
  ["FORM", "form"],
  ["MAIN", "main"],
  ["NAV", "navigation"],
  ["HEADER", "banner"],
  ["FOOTER", "contentinfo"],
  ["ASIDE", "complementary"],
];

/**
 * JS **statements** defining the enumeration in the enclosing scope:
 *
 * - `paragentIsVisible(el)`     — the ADR-0007 predicate
 * - `paragentRoleOf(el)`        — explicit `role=`, else implicit by tag, else null
 * - `paragentWalk(root, visit)` — the one tree traversal
 * - `paragentVisibleLandmarks(root)` — visible landmark roles, in DOM order
 *
 * The role vocabulary is injected with `JSON.stringify` from the exports above,
 * so the TypeScript constants and the browser-side copy cannot drift.
 *
 * `visibilityProperty`/`contentVisibilityAuto` are NOT optional. With default
 * options `checkVisibility()` returns TRUE for a `visibility: hidden` element,
 * while Playwright's `isVisible()` — which the runner asserts with, and which
 * records `post_action_target_visible` — returns false. Measured in Chromium:
 *
 *   CSS                 default   with flags   playwright
 *   display:none        false     false        false
 *   visibility:hidden   TRUE      false        false   <- the disagreement
 *   opacity:0           true      true         true
 *   [hidden]            false     false        false
 *
 * The `getClientRects()` fallback shares the blind spot, so it consults computed
 * style first.
 * https://developer.mozilla.org/en-US/docs/Web/API/Element/checkVisibility
 * access_date: 2026-07-26
 *
 * Keep prose OUT of the template literal below: a stray backtick or `${`
 * terminates it. That is a build break, not a runtime one.
 */
export const LANDMARK_ENUMERATION_JS = `
const paragentLandmarkRoles = new Set(${JSON.stringify(LANDMARK_ROLES)});
const paragentImplicitRoles = new Map(${JSON.stringify(IMPLICIT_LANDMARK_ROLE_BY_TAG)});
const paragentIsVisible = (el) => {
  if (typeof el.checkVisibility === "function") {
    return el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true });
  }
  const cs = window.getComputedStyle(el);
  if (cs && (cs.visibility === "hidden" || cs.display === "none")) return false;
  return el.getClientRects().length > 0;
};
const paragentRoleOf = (el) =>
  el.getAttribute("role") || paragentImplicitRoles.get(el.tagName) || null;
const paragentWalk = (root, visit) => {
  if (!root) return;
  visit(root);
  const children = root.children;
  for (let i = 0; i < children.length; i++) paragentWalk(children[i], visit);
};
const paragentVisibleLandmarks = (root) => {
  const found = [];
  paragentWalk(root, (el) => {
    const role = paragentRoleOf(el);
    if (
      role &&
      paragentLandmarkRoles.has(role) &&
      found.indexOf(role) === -1 &&
      paragentIsVisible(el)
    ) {
      found.push(role);
    }
  });
  return found;
};
`;

/**
 * A self-contained JS **expression** evaluating to the visible landmark list of
 * the current document, in DOM order. Pass it to `page.evaluate` as a string —
 * see the note above on why it must not become a callback.
 */
export const VISIBLE_LANDMARKS_EXPRESSION_JS = `(() => {
${LANDMARK_ENUMERATION_JS}
return paragentVisibleLandmarks(document.body);
})()`;
