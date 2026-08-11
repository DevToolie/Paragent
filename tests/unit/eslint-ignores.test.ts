/**
 * #144 — the lint config and `.gitignore` must not drift apart.
 *
 * `experiments/gate-v1/out/` was gitignored from the day the harness was built
 * and never added to the hand-written `ignores` list, so `npm run ci` failed at
 * the lint step for anyone who had run `npm run gate:matrix`, while CI stayed
 * green because a clean checkout has no such files.
 *
 * The fix reads `.gitignore` directly, which closes that gap and opens a
 * different one: an over-broad ignore would make lint pass by checking less.
 * So this asserts **both directions** — generated output is ignored, and every
 * tracked source root is still linted. A test that only checked the first would
 * pass just as happily if the config ignored the whole repo.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** One instance: constructing ESLint loads and validates the flat config. */
const eslint = new ESLint({ cwd: ROOT });

const ignored = (relative: string): Promise<boolean> =>
  eslint.isPathIgnored(path.join(ROOT, relative));

describe("eslint ignores what git ignores (#144)", () => {
  it("ignores generated harness output", async () => {
    // The specific gap that broke `npm run ci` locally.
    expect(await ignored("experiments/gate-v1/out/demo/demo.ts")).toBe(true);
    expect(await ignored("experiments/gate-v1/out/metrics.ndjson")).toBe(true);
  });

  it("ignores the other generated and never-commit paths", async () => {
    for (const p of [
      "dist/index.js",
      "node_modules/whatever/index.js",
      "archive/old.ts",
      "pool.jsonl",
      ".cache/tenant.jsonl",
    ]) {
      expect(await ignored(p), `${p} should be ignored`).toBe(true);
    }
  });

  it("still lints every source root", async () => {
    // The counter-direction. Ignoring more is the cheapest way to make lint
    // pass, and it would look identical to a fix from the exit code alone.
    for (const p of [
      "src/runner/replay.ts",
      "src/session/store.ts",
      "tests/unit/eslint-ignores.test.ts",
      "scripts/secret-scan.mjs",
      "experiments/gate-v1/run-matrix.ts",
      "eslint.config.mjs",
    ]) {
      expect(await ignored(p), `${p} should be linted`).toBe(false);
    }
  });

  it("derives the ignores from .gitignore rather than a second list", async () => {
    // Pins the mechanism, not just its current output: a future edit that goes
    // back to hand-maintaining the list would pass every assertion above on the
    // day it landed and drift again afterwards, which is the whole bug.
    const config = readFileSync(path.join(ROOT, "eslint.config.mjs"), "utf8");
    expect(config).toContain("includeIgnoreFile");
    expect(config).toContain(".gitignore");
  });
});
