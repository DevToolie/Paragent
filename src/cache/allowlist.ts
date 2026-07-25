/**
 * Positive allowlist for pool-eligible cache content.
 * Fail-closed: anything not listed here is tenant-scoped by default.
 * Sources: Wave pack Agent B5; contracts/cache-row.schema.json;
 * WAI-ARIA 1.2 https://www.w3.org/TR/wai-aria-1.2/#role_definitions (2026-07-24).
 */

export const ALLOWED_ARIA_ROLES: ReadonlySet<string> = new Set([
  "banner", "complementary", "contentinfo", "form", "main", "navigation",
  "region", "search", "article", "document", "feed", "figure", "group",
  "heading", "img", "list", "listitem", "math", "none", "note", "presentation",
  "separator", "table", "row", "cell", "columnheader", "rowheader", "grid",
  "gridcell", "toolbar", "tooltip", "alert", "alertdialog", "button",
  "checkbox", "combobox", "dialog", "link", "listbox", "menu", "menubar",
  "menuitem", "menuitemcheckbox", "menuitemradio", "option", "progressbar",
  "radio", "radiogroup", "scrollbar", "searchbox", "slider", "spinbutton",
  "status", "switch", "tab", "tablist", "tabpanel", "textbox", "timer",
  "tree", "treegrid", "treeitem",
]);

export const ALLOWED_CSS_ATTR_NAMES: ReadonlySet<string> = new Set([
  "role", "type", "name", "for", "href", "id", "class", "disabled", "readonly",
  "required", "checked", "selected", "hidden", "aria-disabled", "aria-expanded",
  "aria-selected", "aria-checked", "aria-pressed", "aria-current",
  "aria-haspopup", "aria-controls", "aria-labelledby", "data-testid",
  "data-test", "data-cy",
]);

export const DENIED_CSS_ATTR_NAMES: ReadonlySet<string> = new Set([
  "data-account-id", "data-account", "data-user-id", "data-user", "data-org-id",
  "data-tenant", "data-tenant-id", "data-customer", "data-customer-id",
  "data-email", "aria-label",
]);

export const UI_CHROME_NAMES: ReadonlySet<string> = new Set([
  "Username", "Password", "Email", "Email address", "Submit", "Log in", "Login",
  "Sign in", "Sign out", "Log out", "Cancel", "Save", "Delete", "Edit", "Create",
  "Add", "Remove", "Search", "Next", "Back", "Previous", "Close", "Open", "Home",
  "Settings", "Dashboard", "Dashboards", "Help", "Menu", "More", "Apply", "Reset",
  "Continue", "Confirm", "Yes", "No", "OK", "Skip", "Filter", "Sort", "Refresh",
  "Download", "Upload", "Copy", "Paste", "Share", "Export", "Import",
]);

export const ALLOWED_TESTID_VALUES: ReadonlySet<string> = new Set([
  "username-input", "password-input", "email-input", "login-button",
  "submit-button", "cancel-button", "search-input", "nav-main", "sidebar",
  "page-header", "modal-close",
]);

export const ALLOWED_LANDMARKS: ReadonlySet<string> = new Set([
  "banner", "complementary", "contentinfo", "form", "main", "navigation",
  "region", "search", "login", "dialog",
]);

export const TEMPLATE_HOLE_RE = /\{[a-zA-Z_][a-zA-Z0-9_]*\}/g;

export function isTemplateOnly(value: string): boolean {
  const stripped = value.replace(TEMPLATE_HOLE_RE, "").trim();
  return /^[\s\-_/.:]*$/.test(stripped);
}

export function isChromeName(value: string): boolean {
  return UI_CHROME_NAMES.has(value) || isTemplateOnly(value);
}

export function isAllowedRole(role: string): boolean {
  return ALLOWED_ARIA_ROLES.has(role);
}

export function isAllowedTestId(testid: string): boolean {
  return ALLOWED_TESTID_VALUES.has(testid) || isTemplateOnly(testid);
}

export function isPoolSafeStructuralPath(path: string): boolean {
  if (/['"]/.test(path)) return false;
  if (/\[[^\]]*\]/.test(path)) return false;
  const freeText = path.match(/[a-zA-Z_]{12,}/g);
  if (freeText) {
    for (const tok of freeText) {
      const lower = tok.toLowerCase();
      if (
        !ALLOWED_LANDMARKS.has(lower) &&
        !/^(nth|child|of|type|main|form|nav|header|footer|section|article|button|input|select|textarea|label|div|span|ul|ol|li|table|tr|td|th|a|p|h[1-6])$/.test(lower)
      ) {
        return false;
      }
    }
  }
  return true;
}
