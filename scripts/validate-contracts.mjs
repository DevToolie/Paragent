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

/** Where recordings live. Every `*.json` below this is inspected. */
const TRAJECTORY_ROOT = "experiments";

/**
 * `out` is the gate harness's output directory and is gitignored
 * (`.gitignore`: `experiments/gate-v1/out/`), so nothing under it can be
 * committed and left permanently unvalidated — which is the failure mode this
 * discovery exists to remove. It stays skipped so a run does not re-read
 * whatever the last matrix run produced. The trade is stated rather than
 * implied, because the skip list and the discovery rule used to interact in a
 * way that was not obvious from either one alone (#116).
 */
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "archive", "out"]);

/**
 * Whether a parsed document *is* a trajectory, regardless of where it sits.
 *
 * `trajectory_id` + `steps` are the schema's identifying fields — `trajectory_id`
 * is what separates a recording from the other `steps`-carrying document in the
 * tree, a `CompiledProgram`, which has `program_id` instead. A `$schema` pointing
 * at the contract counts on its own, since a document that names the schema is
 * asking to be checked against it.
 *
 * Being permissive here is the safe direction: a false positive costs one extra
 * validation, while a false negative is a recording that is never checked.
 */
function looksLikeTrajectory(doc) {
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return false;
  if (typeof doc.$schema === "string" && doc.$schema.includes("trajectory.schema.json")) {
    return true;
  }
  return typeof doc.trajectory_id === "string" && Array.isArray(doc.steps);
}

/**
 * Every trajectory artifact that must stay schema-valid, discovered by **shape**
 * rather than by location or by a list (#99, #116).
 *
 * This began as a hand-maintained array: a newly recorded trajectory nobody
 * remembered to add was never schema-checked in CI — including against
 * `additionalProperties: false`, the mechanism that makes an accidental
 * `cookies` field *unrepresentable* rather than merely discouraged. #110 replaced
 * the list with a walk for `*.json` whose parent directory was named
 * `trajectories`, which swapped a hand-maintained list for a hand-maintained
 * *convention* — same root cause, one step removed. `src/recorder/cli.ts` takes
 * `--out` to an arbitrary path and only defaults to the canonical directory, so
 * a recording landing anywhere else was silently skipped through the supported
 * interface.
 *
 * A file is now collected when **either** rule fires:
 *
 * 1. it parses as a trajectory-shaped document, wherever it lives; or
 * 2. it is a `*.json` directly inside a `trajectories/` directory.
 *
 * Rule 2 is kept deliberately, and is not redundant. A recording that is
 * *malformed* — missing `trajectory_id`, or not valid JSON at all — fails rule 1
 * precisely because it is broken, and dropping it would turn "this file is
 * invalid" into "this file does not exist". Under rule 2 it is still collected
 * and still fails validation loudly, which is the point.
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
        continue;
      }
      if (!ent.isFile() || !ent.name.endsWith(".json")) continue;

      const canonical = path.basename(dir) === "trajectories";
      let shaped;
      try {
        shaped = looksLikeTrajectory(JSON.parse(await readFile(full, "utf8")));
      } catch {
        // Unreadable or unparseable. Rule 2 still applies: a broken file in the
        // canonical directory must reach the validator and fail there, not be
        // quietly dropped by the discovery step.
        shaped = false;
      }
      if (shaped || canonical) {
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
      `no trajectory-shaped documents found under ${TRAJECTORY_ROOT}/ — ` +
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
