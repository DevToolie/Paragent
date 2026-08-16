#!/usr/bin/env node
/**
 * Compile a trajectory JSON file into a cache-row bundle.
 *
 * Usage:
 *   npm run compile -- --in contracts/examples/trajectory.example.json
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { compileTrajectory } from "./compile.js";
import type { Trajectory } from "./types.js";
import { validateCompiledBundle } from "./validate.js";
import { ingestBundle, type IngestableBundle } from "../cache/ingest.js";
import { CacheWriteRejectedError } from "../cache/write.js";
import { DEFAULT_CACHE_DIR, JsonlCacheStore } from "../cache/store.js";

function usage(): never {
  console.log(`paragent compiler (B3)

Usage:
  paragent compile --in <trajectory.json> [--out <bundle.json>] [--no-validate]
  paragent compile --in <trajectory.json> --to-cache <dir>
  npm run compile -- --in <trajectory.json> [--out <bundle.json>]   (from a clone)

Reads a trajectory conforming to contracts/trajectory.schema.json and emits a
compiled_trajectory bundle (one cache-row per step).

  --to-cache <dir>  Also write every row through the cache's write-time privacy
                    boundary into <dir> (#166) — the directory
                    \`gate:matrix --from-cache\` reads. Conventionally
                    ${DEFAULT_CACHE_DIR}. pool_eligible on disk is decided by
                    writeCacheRow(), not by the compiler's pre-check; a bundle
                    claiming eligibility the boundary refuses is rejected and
                    nothing is written.`);
  process.exit(0);
}

function getArg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    usage();
  }

  const inPath = getArg(args, "--in");
  if (!inPath) {
    console.error("Missing --in <trajectory.json>");
    process.exit(2);
  }

  const absIn = path.resolve(process.cwd(), inPath);
  const trajectory = JSON.parse(await readFile(absIn, "utf8")) as Trajectory;

  const bundle = compileTrajectory(trajectory, {
    inputPath: path.relative(process.cwd(), absIn).replace(/\\/g, "/"),
    compiledAt: "2026-07-25T00:00:00.000Z",
  });

  if (!args.includes("--no-validate")) {
    const result = await validateCompiledBundle(bundle);
    if (!result.ok) {
      console.error("Compiled bundle failed schema validation:");
      for (const e of result.errors) console.error(`  - ${e}`);
      process.exit(1);
    }
  }

  const defaultOut = path.join(
    "artifacts",
    "compiled",
    `${trajectory.trajectory_id}.bundle.json`,
  );
  const outPath = path.resolve(
    process.cwd(),
    getArg(args, "--out") ?? defaultOut,
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  console.log(
    `wrote ${path.relative(process.cwd(), outPath).replace(/\\/g, "/")}`,
  );
  console.log(
    `rows=${bundle.rows.length} pool_eligible=${bundle.rows.filter((r) => r.pool_eligible).length}`,
  );

  // #166: the compiled bundle is a file until something puts it where the
  // replay path looks. `writeCacheRow()` had no caller outside tests, so
  // `gate:matrix --from-cache` read a directory nothing populated.
  const cacheDir = getArg(args, "--to-cache");
  if (cacheDir !== undefined) {
    const absCache = path.resolve(process.cwd(), cacheDir);
    const store = new JsonlCacheStore({ dir: absCache });
    let summary;
    try {
      summary = ingestBundle(bundle as unknown as IngestableBundle, { store });
    } catch (err) {
      if (err instanceof CacheWriteRejectedError) {
        // Not a crash to smooth over: the compiler's pre-check claimed pool
        // eligibility the boundary refused, which is the one direction that is
        // never allowed. Nothing was written.
        console.error(`cache write refused (${err.reason}): ${err.message}`);
        console.error("  nothing was written — the whole bundle is rejected, not the row.");
        process.exit(1);
      }
      throw err;
    }
    const rel = path.relative(process.cwd(), absCache).replace(/\\/g, "/");
    console.log(
      `cached ${summary.steps} steps to ${rel} ` +
        `(${summary.pool_eligible} pool-eligible, ${summary.tenant_only.length} tenant-only)`,
    );
    if (summary.program_id) {
      console.log(
        `  resolve with: --from-cache ${rel} ` +
          `--site-key ${summary.site_key} --task-key ${summary.task_key}`,
      );
    }
    if (summary.widened.length > 0) {
      // Legal (a pre-check may be stricter) but worth saying out loud — it
      // means the flag the compiler wrote into the bundle file is more
      // conservative than the boundary itself.
      console.log(
        `  note: authority pooled ${summary.widened.length} step(s) the compiler ` +
          `pre-check did not: ${summary.widened.join(", ")}`,
      );
    }
    for (const t of summary.tenant_only) {
      console.log(`  step ${t.step_index}: tenant-only (${t.reason})`);
    }
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
