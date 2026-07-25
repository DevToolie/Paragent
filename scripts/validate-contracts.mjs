#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js");
const addFormats = require("ajv-formats");

const ROOT = process.cwd();

const pairs = [
  ["contracts/trajectory.schema.json", "contracts/examples/trajectory.example.json"],
  ["contracts/assertion.schema.json", "contracts/examples/assertion.example.json"],
  ["contracts/cache-row.schema.json", "contracts/examples/cache-row.example.json"],
];

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
