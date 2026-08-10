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
 * Generated or vendored trees. `out` holds run artifacts and is gitignored
 * (`.gitignore:58`), so nothing in it is committable — which is what this
 * check is for. Note the interaction with discovery, since it is not obvious
 * from either rule alone: a correctly-shaped recording under
 * `experiments/gate-v1/out/` is **not** discovered, by design, because it
 * cannot enter the tree. `tests/unit/trajectory-guard.test.ts` pins that.
 */
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "archive", "out"]);

/**
 * Whether a parsed JSON document is a trajectory, judged by its own shape.
 *
 * `trajectory_id` + a `steps` array is the identifying pair, and it separates a
 * recording from every other JSON artifact in the tree: a compiled program has
 * `steps` but no `trajectory_id` (`experiments/gate-v1/fixtures/compiled-program.json`),
 * and a compiled bundle has neither — it carries `source_trajectory_id` and
 * `rows`. A `$schema`/`$id` pointing at the trajectory schema also counts, so a
 * document that declares itself is taken at its word even if it is missing the
 * required fields — that is exactly the file validation should be shouting
 * about, not skipping.
 */
function looksLikeTrajectory(doc) {
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) return false;
  const declared = typeof doc.$schema === "string" ? doc.$schema : "";
  if (declared.includes("trajectory.schema.json")) return true;
  return typeof doc.trajectory_id === "string" && Array.isArray(doc.steps);
}

/**
 * Every trajectory artifact that must stay schema-valid, discovered by **shape**
 * rather than by location (#99, #116).
 *
 * This was a hand-maintained array, then a hand-maintained location convention:
 * `*.json` whose parent directory is named `trajectories`. Both leave the same
 * hole — the guarantee depends on someone remembering something, rather than on
 * the data. `src/recorder/cli.ts` takes `--out` to an arbitrary path and only
 * defaults to `experiments/gate-v1/trajectories/`, so a recording written to
 * `experiments/gate-v2/recordings/` was committable and permanently unchecked,
 * including against `additionalProperties: false` — the mechanism that makes an
 * accidental `cookies` field *unrepresentable* rather than merely discouraged.
 *
 * So: every `*.json` under `experiments/` is read, and anything trajectory-shaped
 * is validated. A file in a `trajectories/` directory is included **regardless
 * of shape**, which is not a fallback to the old rule but a second, stricter
 * one: a file sitting in the canonical location that does not parse, or does not
 * look like a recording, is a finding — it should fail loudly rather than be
 * quietly dropped for not matching the shape test.
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
      const rel = path.relative(root, full).split(path.sep).join("/");
      if (path.basename(dir) === "trajectories") {
        found.push(rel);
        continue;
      }
      // Unparseable is not trajectory-shaped, and outside the canonical
      // directory there is nothing to say it was meant to be one. main() reads
      // and reports on what discovery returns; this pass only classifies.
      let doc;
      try {
        doc = JSON.parse(await readFile(full, "utf8"));
      } catch {
        continue;
      }
      if (looksLikeTrajectory(doc)) found.push(rel);
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
      `no trajectory-shaped .json found under ${TRAJECTORY_ROOT}/ — ` +
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
