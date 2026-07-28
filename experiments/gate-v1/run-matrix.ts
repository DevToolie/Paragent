#!/usr/bin/env node
/**
 * Gate-v1 version matrix driver.
 *
 * The version list is `scripts/testbed/matrix.json` — the ADR-0003 pins — read
 * through `src/testbed/matrix.ts`. There is no second list. `versions.json`
 * used to hold a one-element placeholder (`pending-b1@placeholder`), so every
 * report generated from this harness was a report about nothing; it was deleted
 * rather than kept in sync (issue #26).
 *
 * Live Playwright runs are not enabled yet — --dry-run is required (exit 2
 * otherwise). That gating is deliberately unchanged here.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MetricsEmitter } from "../../src/metrics/emitter.js";
import { ReplayRunner } from "../../src/runner/replay.js";
import type { CompiledProgram } from "../../src/runner/types.js";
import type { StepOutcome } from "../../src/metrics/types.js";
import {
  isUnavailable,
  listVersions,
  loadMatrix,
  type MatrixVersion,
} from "../../src/testbed/matrix.js";
import programFixture from "./fixtures/compiled-program.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "out");

const DRY_RUN_NOTE = "dry-run — tokens remain 0; not a gate measurement";

interface Args {
  dryRun: boolean;
  help: boolean;
  /** Raw --versions value; `undefined` means "not passed" (defaults to all). */
  versions?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--versions") {
      const value = argv[++i];
      if (value === undefined) {
        throw new Error("--versions requires a value (comma-separated ids, or `all`)");
      }
      args.versions = value;
    } else if (a.startsWith("--versions=")) {
      args.versions = a.slice("--versions=".length);
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  return args;
}

function usage(): void {
  console.log(`Usage: npm run gate:matrix -- --dry-run [--versions <a,b,c>|all]

  --dry-run          Required for now. Emits zero-token metrics; no browser.
  --versions <list>  Comma-separated matrix ids, or "all" (default).
                     Unknown ids are rejected — never silently skipped.
  --help             Show this help.

Versions come from scripts/testbed/matrix.json (ADR-0003 pins). Versions marked
"status": "unavailable" there are skipped and recorded, never dropped silently.

Live matrix runs exit with code 2 until live wiring lands (issue #62).
Exits 1 if the selection walked zero versions — an empty NDJSON is a missing
denominator, not a successful run.
`);
}

/**
 * Resolve `--versions` against the matrix. Unknown ids are an error naming the
 * valid ids: falling through to a default is how a placeholder run gets
 * mistaken for a measurement.
 */
function selectVersions(
  selection: string | undefined,
  all: MatrixVersion[],
): { selected: MatrixVersion[]; selectionLabel: string | string[] } {
  if (selection === undefined || selection.trim() === "all") {
    return { selected: all, selectionLabel: "all" };
  }

  const requested = selection
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (requested.length === 0) {
    throw new Error("--versions was empty (use comma-separated ids, or `all`)");
  }

  const byId = new Map(all.map((v) => [v.id, v]));
  const unknown = requested.filter((id) => !byId.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `unknown version id(s): ${unknown.join(", ")}\n` +
        `valid ids (scripts/testbed/matrix.json): ${all.map((v) => v.id).join(", ")}`,
    );
  }

  // Dedupe while keeping the caller's order.
  const seen = new Set<string>();
  const selected: MatrixVersion[] = [];
  for (const id of requested) {
    if (seen.has(id)) continue;
    seen.add(id);
    selected.push(byId.get(id)!);
  }
  return { selected, selectionLabel: selected.map((v) => v.id) };
}

async function main(): Promise<void> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`gate:matrix: ${err instanceof Error ? err.message : err}`);
    usage();
    process.exit(2);
    return;
  }

  if (args.help) {
    usage();
    process.exit(0);
    return;
  }
  if (!args.dryRun) {
    console.error(
      "gate:matrix: live runs are not enabled yet. Pass --dry-run (exit 2).",
    );
    process.exit(2);
    return;
  }

  const matrix = loadMatrix();
  const all = listVersions(matrix);

  let selected: MatrixVersion[];
  let selectionLabel: string | string[];
  try {
    ({ selected, selectionLabel } = selectVersions(args.versions, all));
  } catch (err) {
    console.error(`gate:matrix: ${err instanceof Error ? err.message : err}`);
    process.exit(2);
    return;
  }

  const walked = selected.filter((v) => !isUnavailable(v));
  const skipped = selected.filter(isUnavailable).map((v) => ({
    id: v.id,
    reason: v.reason ?? "marked unavailable in scripts/testbed/matrix.json",
  }));

  await mkdir(OUT_DIR, { recursive: true });
  const ndjsonPath = path.join(OUT_DIR, "metrics.ndjson");
  const summaryPath = path.join(OUT_DIR, "matrix-run.json");
  const emitter = new MetricsEmitter(ndjsonPath);

  const program = programFixture as CompiledProgram;

  console.log(
    `gate:matrix dry-run — ${matrix.target} matrix, ` +
      `${walked.length} version(s) to walk, program=${program.program_id}`,
  );
  for (const s of skipped) {
    console.log(`  skipped ${s.id}: ${s.reason}`);
  }

  const runs: Array<Record<string, unknown>> = [];

  for (const ver of walked) {
    // Only testbed_version varies. site_key/task_key stay whatever the compiled
    // program actually is — relabelling a local-demo program as a Grafana one
    // per version would make the row claim a run that never happened.
    const runProgram: CompiledProgram = {
      ...program,
      testbed_version: ver.id,
    };

    const dryOutcomes: StepOutcome[] = runProgram.steps.map(() => "PASS");
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: dryOutcomes,
      metrics: emitter,
      maxRepairsPerRun: 2,
    });

    const result = await runner.run(runProgram, {
      base_url: "file://local-demo",
      resource_label: "widget",
    });

    const row = {
      version: ver.id,
      run_id: result.run_id,
      task_success: result.task_success,
      repair_count: result.repair_count,
      steps_replay_valid: result.steps_replay_valid,
      steps_total: result.steps_total,
      note: DRY_RUN_NOTE,
    };
    runs.push(row);
    console.log(JSON.stringify(row));
  }

  await emitter.flush();

  // The skip ledger. Without it a later report cannot tell "8 versions, 3 of
  // them unavailable" from "5 versions" — the denominator silently shrinks.
  await writeFile(
    summaryPath,
    `${JSON.stringify(
      {
        schema_version: "1.0.0",
        kind: "gate_matrix_run",
        generated_at: new Date().toISOString(),
        dry_run: true,
        not_a_measurement: DRY_RUN_NOTE,
        matrix_source: "scripts/testbed/matrix.json",
        matrix_target: matrix.target,
        selection: selectionLabel,
        versions_in_matrix: all.length,
        versions_walked: walked.map((v) => v.id),
        versions_skipped: skipped,
        program_id: program.program_id,
        runs,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`wrote ${ndjsonPath}`);
  console.log(`wrote ${summaryPath}`);

  if (walked.length === 0) {
    console.error(
      "gate:matrix: walked 0 versions — nothing was measured. " +
        `${skipped.length} of ${selected.length} selected version(s) are unavailable.`,
    );
    process.exit(1);
    return;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
