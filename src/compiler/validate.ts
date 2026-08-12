import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Assertion, CacheRow, CompiledTrajectoryBundle } from "./types.js";

const require = createRequire(import.meta.url);
// Ajv draft-2020-12: https://github.com/ajv-validator/ajv/blob/v8.17.1/docs/json-schema.md
// (accessed 2026-07-25)
const Ajv2020 = require("ajv/dist/2020.js") as new (opts?: {
  allErrors?: boolean;
  strict?: boolean;
}) => {
  compile: (schema: object) => ((data: unknown) => boolean) & { errors?: unknown };
};
const addFormats = require("ajv-formats") as (ajv: unknown) => unknown;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Directory holding `contracts/`, found by walking up from this module (#134).
 *
 * This used to resolve against `process.cwd()`, which is correct exactly when
 * the process was started from the repo root and wrong everywhere else. It
 * survived because every caller was an npm script. An installed user running
 * `paragent compile` from their own directory got `ENOENT` on a path inside
 * *their* project — a packaging failure reported as a missing file they never
 * had.
 *
 * Walking up rather than resolving a fixed number of `..` segments, because the
 * depth differs between the two layouts this file runs in: `src/compiler/` in
 * the repo, `dist/src/compiler/` in the published package.
 */
function packageRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, "contracts", "cache-row.schema.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Last resort: the old behaviour, so a repo-root invocation still works even
  // if the layout changes in a way this walk does not anticipate.
  return process.cwd();
}

async function loadSchema(rel: string): Promise<object> {
  const abs = path.resolve(packageRoot(), rel);
  return JSON.parse(await readFile(abs, "utf8")) as object;
}

export async function validateCompiledBundle(
  bundle: CompiledTrajectoryBundle,
): Promise<ValidationResult> {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const cacheSchema = await loadSchema("contracts/cache-row.schema.json");
  const assertionSchema = await loadSchema("contracts/assertion.schema.json");
  const validateRow = ajv.compile(cacheSchema);
  const validateAssertion = ajv.compile(assertionSchema);

  const errors: string[] = [];

  if (bundle.bundle_kind !== "compiled_trajectory") {
    errors.push(
      `bundle_kind must be compiled_trajectory, got ${String(bundle.bundle_kind)}`,
    );
  }
  if (!Array.isArray(bundle.rows) || bundle.rows.length === 0) {
    errors.push("bundle.rows must be a non-empty array");
  }

  for (const [i, row] of bundle.rows.entries()) {
    if (!validateRow(row)) {
      errors.push(
        `row[${i}] cache-row invalid: ${JSON.stringify(validateRow.errors)}`,
      );
    }
    const assertion = (row as CacheRow).assertion as Assertion;
    if (!validateAssertion(assertion)) {
      errors.push(
        `row[${i}] assertion invalid: ${JSON.stringify(validateAssertion.errors)}`,
      );
    }
    if (!assertion?.strength) {
      errors.push(`row[${i}] assertion missing strength`);
    }
  }

  return { ok: errors.length === 0, errors };
}
