#!/usr/bin/env node
/**
 * Copy non-TypeScript runtime assets into `dist/` (#134).
 *
 * `tsc` emits `.js` for `.ts` and nothing else, so anything the shipped code
 * reads off disk at runtime has to be placed beside its compiled module by
 * something other than the compiler.
 *
 * Today that is exactly one thing: `src/recorder/fixtures/*.html`.
 * `src/recorder/fixture.ts` resolves them as
 * `path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures")` — i.e.
 * *next to the module*. In the repo that is `src/recorder/fixtures`; in the
 * published package it is `dist/src/recorder/fixtures`, and without this step
 * that directory does not exist. The failure would be invisible until an
 * installed user ran `paragent record --fixture` — the one command the README
 * tells a first-time visitor to try.
 *
 * `contracts/` is **not** copied. It ships at the package root via the `files`
 * field and is read by tooling, not by a compiled module resolving a relative
 * path, so copying it would create a second copy that could drift.
 *
 * Missing sources are an error, not a warning. A silently empty fixture
 * directory produces a package that installs cleanly and fails on first use.
 */

import { cp, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** `from` is repo-relative; it lands at `dist/<from>`, mirroring tsc's layout. */
const ASSETS = [{ from: "src/recorder/fixtures", description: "recorder --fixture pages" }];

async function main() {
  const copied = [];
  for (const asset of ASSETS) {
    const src = path.join(ROOT, asset.from);
    const dest = path.join(ROOT, "dist", asset.from);

    let entries;
    try {
      entries = await readdir(src);
    } catch {
      throw new Error(
        `copy-package-assets: ${asset.from} does not exist. It is required at ` +
          `runtime (${asset.description}); a package built without it installs ` +
          "cleanly and fails on first use.",
      );
    }
    if (entries.length === 0) {
      throw new Error(`copy-package-assets: ${asset.from} is empty (${asset.description}).`);
    }

    await mkdir(path.dirname(dest), { recursive: true });
    await cp(src, dest, { recursive: true });
    copied.push({ asset: asset.from, files: entries.length });
  }

  // Fail loudly if the compiler has not run: copying assets into a dist/ with
  // no JavaScript in it produces a package whose bin does not exist.
  const binary = path.join(ROOT, "dist", "src", "cli.js");
  try {
    await stat(binary);
  } catch {
    throw new Error(
      "copy-package-assets: dist/src/cli.js is missing — run `tsc` before " +
        "copying assets (npm run build does both, in order).",
    );
  }

  console.log(`copy-package-assets: ${JSON.stringify(copied)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
