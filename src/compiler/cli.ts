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

function usage(): never {
  console.log(`paragent compiler (B3)

Usage:
  paragent compile --in <trajectory.json> [--out <bundle.json>] [--no-validate]
  npm run compile -- --in <trajectory.json> [--out <bundle.json>]   (from a clone)

Reads a trajectory conforming to contracts/trajectory.schema.json and emits a
compiled_trajectory bundle (one cache-row per step).`);
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
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
