import path from "node:path";
import { fileURLToPath } from "node:url";
import { includeIgnoreFile } from "@eslint/compat";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Lint what git tracks, and nothing else.
 *
 * This used to be a hand-written `ignores` list, which meant two lists of
 * "files that are not source" and only one of them maintained. The gap was
 * `experiments/gate-v1/out/` — gitignored since the harness was built, never
 * added here — so `npm run ci` failed at the lint step on any machine that had
 * run `npm run gate:matrix`, while CI stayed green because a clean checkout has
 * no such files (#144).
 *
 * That is the worst shape for a check: it fails only for contributors, only
 * after they have used the tool the repo tells them to use, and never where it
 * would be noticed and fixed. `npm run ci` is what CONTRIBUTING asks people to
 * run before opening a PR, and a pre-PR check that cries wolf is one people
 * learn to read past.
 *
 * Reading `.gitignore` directly means the two cannot drift again: a new
 * generated-output directory is ignored by both the moment it is ignored by
 * either. `includeIgnoreFile` is ESLint's own converter, so gitignore semantics
 * — bare names matching at any depth, trailing-slash directories, `!`
 * negations — are honoured rather than approximated by hand.
 */
const gitignore = includeIgnoreFile(
  path.join(path.dirname(fileURLToPath(import.meta.url)), ".gitignore"),
);

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  gitignore,
  {
    // `archive/` is the one exclusion git does NOT make: it is tracked history,
    // kept deliberately (see `scripts/secret-scan.mjs`, which skips it for the
    // same reason) and not code anyone should be asked to keep lint-clean.
    ignores: ["archive/**"],
  },
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        // Node 20 globals used by the test-bed CI smoke assertion.
        Buffer: "readonly",
        URL: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
      },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
