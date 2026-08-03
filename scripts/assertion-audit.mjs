#!/usr/bin/env node
/**
 * Assertion-audit counts for docs/gate/assertion-audit.md — issue #61.
 *
 * The audit's central column ("would this assertion catch a silent no-op?")
 * is judgment applied to each row and is not computed here. What *is*
 * computed, mechanically, from the committed bundle: the strength tally and
 * the load-bearing fraction, so the numbers in the doc are never hand-typed
 * or hand-recounted after an edit.
 *
 * Usage: node scripts/assertion-audit.mjs [bundle-path]
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_BUNDLE = path.join(
  ROOT,
  "artifacts/compiled/traj-gate-live-create-stat-dashboard-from-testdata-9.5.21.bundle.json",
);

/**
 * Steps whose post-condition would fail if the step's action silently did
 * nothing. This is the audit's judgment call (docs/gate/assertion-audit.md
 * table, column 5) — not derivable from the bundle alone, because "would it
 * fail" depends on reading what the target/expected actually pins down, not
 * just its `strength` label. Recorded here, once, so the count in the doc and
 * the count printed by this script cannot drift apart.
 *
 * Verified empirically for step 0 and step 3 against a live 9.5.21 instance —
 * see the "Empirical verification" section of the audit doc.
 */
const LOAD_BEARING_STEP_INDICES = new Set([0, 1, 3, 7, 10, 11]);

function main() {
  const bundlePath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_BUNDLE;
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  const rows = [...bundle.rows].sort((a, b) => a.step_index - b.step_index);

  console.log(`bundle: ${path.relative(ROOT, bundlePath)}`);
  console.log(`rows: ${rows.length}\n`);

  console.log("step_index\taction\tassertion_type\tstrength\tload_bearing");
  let strong = 0;
  let weak = 0;
  let loadBearing = 0;
  for (const r of rows) {
    const strength = r.assertion.strength;
    if (strength === "strong") strong += 1;
    else weak += 1;
    const bearing = LOAD_BEARING_STEP_INDICES.has(r.step_index);
    if (bearing) loadBearing += 1;
    console.log(
      [
        r.step_index,
        r.compiled_action.type,
        r.assertion.type,
        strength,
        bearing ? "yes" : "no",
      ].join("\t"),
    );
  }

  console.log(`\nstrength tally: ${strong} strong / ${weak} weak / ${rows.length} total`);
  console.log(
    `load-bearing step count: ${loadBearing}/${rows.length} ` +
      `(catches a silent no-op per docs/gate/assertion-audit.md)`,
  );

  if (strong !== loadBearing) {
    console.log(
      "\nnote: strong-count and load-bearing-count differ — the audit's premise " +
        "(a weak label can still be load-bearing, or a strong one might not be) " +
        "is live for this bundle. Re-check the per-step table.",
    );
  }
}

main();
