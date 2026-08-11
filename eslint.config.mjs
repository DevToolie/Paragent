import path from "node:path";
import { fileURLToPath } from "node:url";
import { includeIgnoreFile } from "@eslint/compat";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const gitignorePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".gitignore",
);

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  /**
   * Whatever git ignores, eslint ignores (#144).
   *
   * `npm run ci` used to fail at `lint` on any machine that had run
   * `npm run gate:matrix` or the demo driver, because `experiments/gate-v1/out/`
   * is gitignored but was still being linted. A clean checkout does not contain
   * those files, so CI stayed green and the failure only ever hit a contributor
   * — which is the worst kind of broken check, since `npm run ci` is what
   * CONTRIBUTING tells people to run before opening a PR.
   *
   * Reading `.gitignore` rather than restating parts of it means the next
   * generated directory is covered the day it is added, instead of the day
   * someone notices. The invariant that makes this safe: if git ignores a path,
   * it holds no tracked source, so nothing CI would lint can be hidden here.
   */
  includeIgnoreFile(gitignorePath),

  {
    /**
     * The one exclusion `.gitignore` cannot supply: `archive/` is **tracked**
     * (9 files), deliberately kept as historical record and deliberately not
     * linted. Gitignoring it would delete it from the repo's history-keeping;
     * linting it would fail on code nobody intends to maintain. So it stays
     * here, as a named exception rather than a list that grows.
     */
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
