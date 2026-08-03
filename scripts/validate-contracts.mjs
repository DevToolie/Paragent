#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js");
const addFormats = require("ajv-formats");

const ROOT = process.cwd();

const pairs = [
  ["contracts/trajectory.schema.json", "contracts/examples/trajectory.example.json"],
  ["contracts/assertion.schema.json", "contracts/examples/assertion.example.json"],
  ["contracts/cache-row.schema.json", "contracts/examples/cache-row.example.json"],
];

/** Where recordings live. Any `trajectories/` directory below this is walked. */
const TRAJECTORY_ROOT = "experiments";

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "archive", "out"]);

/**
 * Every trajectory artifact that must stay schema-valid, discovered rather than
 * listed (#99).
 *
 * This used to be a hand-maintained array. A newly recorded trajectory that
 * nobody remembered to add was never schema-checked in CI — including against
 * `additionalProperties: false`, which is the mechanism that makes an
 * accidental `cookies` field *unrepresentable* rather than merely discouraged.
 * The failure mode was silent and grew with every recording.
 *
 * Sorted so a failure names files in a stable order, and so two runs over the
 * same tree produce the same output.
 */
export async function discoverTrajectories(root = ROOT) {
  /** @type {string[]} */
  const found = [];
  /** @param {string} dir */
  const walk = async (dir) => {
    /** @type {import("node:fs").Dirent[]} */
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // directory absent is not an error; "found nothing" is caught below
    }
    for (const ent of entries) {
      if (SKIP_DIRS.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (
        ent.isFile() &&
        ent.name.endsWith(".json") &&
        path.basename(dir) === "trajectories"
      ) {
        found.push(path.relative(root, full).split(path.sep).join("/"));
      }
    }
  };
  await walk(path.join(root, TRAJECTORY_ROOT));
  return found.sort();
}

async function loadJson(rel) {
  return JSON.parse(await readFile(path.join(ROOT, rel), "utf8"));
}

async function main() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  for (const [schemaRel, exampleRel] of pairs) {
    const schema = await loadJson(schemaRel);
    const example = await loadJson(exampleRel);
    const validate = ajv.compile(schema);
    const ok = validate(example);
    if (!ok) {
      console.error(`INVALID: ${exampleRel} against ${schemaRel}`);
      console.error(validate.errors);
      process.exit(1);
    }
    console.log(`ok: ${exampleRel}`);
  }

  const trajSchema = await loadJson("contracts/trajectory.schema.json");
  // Reuse validator compiled from the pairs loop when available; else compile once.
  const validateTraj =
    ajv.getSchema("https://paragent.dev/contracts/trajectory.schema.json") ??
    ajv.compile(trajSchema);
  const extraTrajectories = await discoverTrajectories();
  // Discovering zero is not "nothing to do" — it means the walk broke and
  // trajectories silently stopped being validated, which is the exact failure
  // the hand-maintained list had. Fail loudly instead.
  if (extraTrajectories.length === 0) {
    console.error(
      `no trajectories found under ${TRAJECTORY_ROOT}/**/trajectories/*.json — ` +
        "discovery is broken, or the recordings moved. Refusing to report clean.",
    );
    process.exit(1);
  }
  for (const rel of extraTrajectories) {
    const example = await loadJson(rel);
    if (!validateTraj(example)) {
      console.error(`INVALID: ${rel} against trajectory.schema.json`);
      console.error(validateTraj.errors);
      process.exit(1);
    }
    console.log(`ok: ${rel}`);
  }

  const metricsSchema = await loadJson("contracts/metrics.schema.json");
  const metricsExample = await loadJson("contracts/examples/metrics.example.json");
  const validateMetric = ajv.compile(metricsSchema);
  if (!Array.isArray(metricsExample)) {
    console.error("metrics.example.json must be an array");
    process.exit(1);
  }
  for (const [i, row] of metricsExample.entries()) {
    if (!validateMetric(row)) {
      console.error(`INVALID metrics row ${i}`);
      console.error(validateMetric.errors);
      process.exit(1);
    }
  }
  console.log("ok: contracts/examples/metrics.example.json");
}

/** Only run as a CLI — importing this for tests must not validate the repo. */
const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
