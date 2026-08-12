/**
 * Packaging invariants (#134).
 *
 * Every bug this file guards was found by actually installing the tarball into
 * an empty directory and running the commands the README tells a visitor to
 * run. None of them is visible from inside the repo, which is the point: in a
 * clone, `process.cwd()` is the repo root, every devDependency is present, and
 * `src/recorder/fixtures/` sits next to its module. All three stop being true
 * the moment someone types `npx paragent`.
 *
 * These assertions are cheap and static. They do not replace publishing a
 * release candidate and installing it — they catch the regressions that would
 * otherwise be caught only by a user.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface Manifest {
  name: string;
  version: string;
  private?: boolean;
  bin?: Record<string, string>;
  files?: string[];
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

const pkg = JSON.parse(
  readFileSync(path.join(ROOT, "package.json"), "utf8"),
) as Manifest;

describe("the package can be published at all", () => {
  it("is not marked private", () => {
    expect(pkg.private).toBeUndefined();
  });

  it("declares a licence, and the file it names exists", () => {
    expect(pkg.license).toBeTruthy();
    expect(existsSync(path.join(ROOT, "LICENSE"))).toBe(true);
  });

  it("exposes exactly one binary, so there is one name to learn", () => {
    expect(Object.keys(pkg.bin ?? {})).toEqual(["paragent"]);
  });

  it("points its binary at compiled output, not at TypeScript", () => {
    // Consumers must not need `tsx` at runtime. A `bin` pointing into `src/`
    // would work in the repo (where tsx is a devDependency) and fail on install.
    const target = pkg.bin!["paragent"]!;
    expect(target).toMatch(/^dist\//);
    expect(target.endsWith(".ts")).toBe(false);
  });
});

describe("what ships", () => {
  it("uses an allowlist, so a new top-level directory does not ship by accident", () => {
    expect(Array.isArray(pkg.files)).toBe(true);
    expect(pkg.files!.length).toBeGreaterThan(0);
  });

  it("ships the compiled binary, the contracts, and nothing from tests", () => {
    // `contracts/` is read at runtime by the compiler's validator, so it is not
    // documentation — leaving it out makes `paragent compile` fail on install.
    const files = pkg.files!;
    expect(files).toContain("dist/src/");
    expect(files).toContain("contracts/");
    for (const entry of files) {
      expect(entry.startsWith("tests")).toBe(false);
      expect(entry.startsWith("experiments")).toBe(false);
    }
  });

  it("builds the runtime assets tsc does not emit", () => {
    // `tsc` emits .js for .ts and nothing else. The recorder resolves its
    // fixture pages next to its own module, so without an explicit copy the
    // published `--fixture` path — the one the README leads with — is broken.
    expect(pkg.scripts?.["build"]).toContain("copy-package-assets");
    expect(existsSync(path.join(ROOT, "scripts/copy-package-assets.mjs"))).toBe(true);
  });

  it("rebuilds before packing, so a stale dist cannot be published", () => {
    expect(pkg.scripts?.["prepack"]).toBeTruthy();
  });
});

describe("runtime dependencies are actually dependencies", () => {
  /**
   * Modules `src/` imports that must be installed for a consumer.
   *
   * `ajv` and `ajv-formats` were devDependencies and are imported by
   * `src/compiler/validate.ts` at runtime — so `paragent compile` crashed with
   * MODULE_NOT_FOUND on a clean install while every test in the repo passed.
   */
  const RUNTIME = ["playwright", "ajv", "ajv-formats"];

  it.each(RUNTIME)("%s is a dependency, not a devDependency", (name) => {
    expect(pkg.dependencies?.[name]).toBeTruthy();
    expect(pkg.devDependencies?.[name]).toBeUndefined();
  });

  it("keeps tsx out of the runtime set", () => {
    // The whole point of shipping compiled JS.
    expect(pkg.dependencies?.["tsx"]).toBeUndefined();
    expect(pkg.dependencies?.["typescript"]).toBeUndefined();
  });
});

describe("nothing under src/ resolves a package path from the working directory", () => {
  it("the compiler's schema loader does not use process.cwd() as a base", () => {
    // It did, which is correct exactly when the process was started from the
    // repo root. An installed user running `paragent compile` from their own
    // project got ENOENT on a path inside *their* directory — a packaging
    // failure reported as a missing file they never had.
    const source = readFileSync(path.join(ROOT, "src/compiler/validate.ts"), "utf8");
    expect(source).not.toContain("path.resolve(process.cwd(), rel)");
    expect(source).toContain("packageRoot()");
  });
});
