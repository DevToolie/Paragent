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
 * Two modes, and the NDJSON must always say which one produced a row:
 *
 * - `--dry-run` walks the matrix with no Docker and no browser, emitting
 *   zero-token rows whose outcomes are hard-coded. It exercises the harness,
 *   and the CI job depends on it. **It is not a measurement**, and every row it
 *   writes carries `DRY_RUN_NOTE`.
 * - The default is now a **live** run (issue #62 removed the exit-2 guard): one
 *   seeded container per version, a real browser, real step outcomes.
 *
 * Mixing the two in one report would be the easiest way to publish a fabricated
 * gate number, so `mode` is recorded in `out/matrix-run.json` and the dry-run
 * note stays attached to the rows themselves.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MetricsEmitter } from "../../src/metrics/emitter.js";
import { ReplayRunner } from "../../src/runner/replay.js";
import { bundleToProgram, isCompiledBundle } from "../../src/runner/program.js";
import type { CompiledProgram } from "../../src/runner/types.js";
import type { StepOutcome } from "../../src/metrics/types.js";
import { dockerAvailable } from "../../src/testbed/docker.js";
import {
  isUnavailable,
  listVersions,
  loadMatrix,
  type MatrixVersion,
} from "../../src/testbed/matrix.js";
import { DEFAULT_HOST_PORT } from "../../src/testbed/constants.js";
import type { SeedFingerprint } from "../../src/testbed/verify.js";
import { formatRunLine, runVersionLive, type VersionSkip } from "./live-run.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "out");
const DEFAULT_PROGRAM = path.join(__dirname, "fixtures/compiled-program.json");

const DRY_RUN_NOTE = "dry-run — tokens remain 0; not a gate measurement";

interface Args {
  dryRun: boolean;
  help: boolean;
  headed: boolean;
  keepUp: boolean;
  preamble: boolean;
  /** Raw --versions value; `undefined` means "not passed" (defaults to all). */
  versions?: string;
  program?: string;
  port?: number;
  /**
   * Extra `param_refs` bindings for the program under test. Programs declare
   * their own holes, so the driver cannot know them: the local-demo fixture
   * wants `resource_label`, the example login bundle wants `username`. Binding
   * is the caller's job — inventing a default here would silently substitute a
   * value the recording never used.
   */
  params: Record<string, string>;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    help: false,
    headed: false,
    keepUp: false,
    preamble: true,
    params: {},
  };
  const valued = new Set(["--versions", "--program", "--port", "--param"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--headed") args.headed = true;
    else if (a === "--keep-up") args.keepUp = true;
    else if (a === "--no-preamble") args.preamble = false;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (valued.has(a)) {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${a} requires a value`);
      assignValue(args, a.slice(2), value);
    } else if ([...valued].some((flag) => a.startsWith(`${flag}=`))) {
      const eq = a.indexOf("=");
      assignValue(args, a.slice(2, eq), a.slice(eq + 1));
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  return args;
}

export function assignValue(args: Args, key: string, value: string): void {
  if (key === "versions") args.versions = value;
  else if (key === "program") args.program = value;
  else if (key === "param") {
    const eq = value.indexOf("=");
    if (eq <= 0) throw new Error(`--param expects key=value, got: ${value}`);
    args.params[value.slice(0, eq)] = value.slice(eq + 1);
  } else if (key === "port") {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`invalid --port: ${value}`);
    args.port = n;
  }
}

function usage(): void {
  console.log(`Usage: npm run gate:matrix -- [--dry-run] [options]

  --dry-run          No Docker, no browser. Zero-token rows, hard-coded
                     outcomes, labelled "not a gate measurement".
  --versions <list>  Comma-separated matrix ids, or "all" (default).
                     Unknown ids are rejected — never silently skipped.
  --program <path>   Compiled program or compiled_trajectory bundle to replay.
                     Default: experiments/gate-v1/fixtures/compiled-program.json
  --port <n>         Host port for the test-bed (default ${DEFAULT_HOST_PORT}).
  --param k=v        Bind one of the program's own param_refs. Repeatable.
                     base_url/host/port are bound by the driver; anything else
                     the program declares is the caller's to supply.
  --headed           Show the browser (live runs only).
  --keep-up          Leave each container running after its run, for inspection.
  --no-preamble      Skip the login preamble, for programs that log in as part
                     of the measured task.
  --help             Show this help.

Versions come from scripts/testbed/matrix.json (ADR-0003 pins). Versions marked
"status": "unavailable" there are skipped and recorded, never dropped silently.

A live run brings up one seeded container per version, replays the program in a
real browser, and tears the container down in a finally. A version that could
not be brought up is recorded as a **skip with a reason** — never as a failed
run, which would invent a data point that was never measured.

Exits 1 if the run measured zero versions — an empty NDJSON is a missing
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

/**
 * Load `--program`, accepting either shape that exists in the tree: a
 * hand-written `CompiledProgram` fixture, or a `compiled_trajectory` bundle
 * from `artifacts/compiled/`. The bundle is the real artifact; the fixture is
 * the harness stand-in that runs without a recording.
 */
export async function loadProgram(file: string): Promise<CompiledProgram> {
  const doc: unknown = JSON.parse(await readFile(file, "utf8"));
  if (isCompiledBundle(doc)) {
    // testbed_version is overridden per version by the driver, so this
    // placeholder never reaches a row.
    return bundleToProgram(doc, "unset");
  }
  const program = doc as CompiledProgram;
  if (!Array.isArray(program.steps)) {
    throw new TypeError(
      `${file} is neither a compiled_trajectory bundle nor a CompiledProgram ` +
        "(no bundle_kind, no steps[])",
    );
  }
  return program;
}

interface WalkOptions {
  walked: MatrixVersion[];
  program: CompiledProgram;
  emitter: MetricsEmitter;
  matrix: ReturnType<typeof loadMatrix>;
  args: Args;
  port: number;
  skipped: VersionSkip[];
}

/**
 * Walk the selected versions, appending to `skipped` and returning the rows
 * that were actually measured.
 *
 * A crashed version must not abort the matrix, so every attributable failure is
 * already a skip by the time it gets here. Anything that still throws is a
 * harness bug and is left to propagate — laundering it into a skip would hide a
 * broken driver as missing data.
 */
async function walkVersions(
  opts: WalkOptions,
): Promise<{ runs: Array<Record<string, unknown>>; baseline?: { id: string; fingerprint: SeedFingerprint } }> {
  const runs: Array<Record<string, unknown>> = [];
  let baseline: { id: string; fingerprint: SeedFingerprint } | undefined;

  for (const [index, ver] of opts.walked.entries()) {
    console.log(`[${index + 1}/${opts.walked.length}] ${ver.id}`);

    if (opts.args.dryRun) {
      runs.push(await runDryVersion(ver, opts.program, opts.emitter));
      continue;
    }

    const outcome = await runVersionLive({
      version: ver,
      program: opts.program,
      matrixImage: opts.matrix.image,
      baseUrlTemplate: opts.matrix.base_url_template,
      hostPort: opts.port,
      emitter: opts.emitter,
      headed: opts.args.headed,
      keepUp: opts.args.keepUp,
      preamble: opts.args.preamble,
      extraParams: opts.args.params,
      ...(baseline ? { baseline } : {}),
    });

    if (outcome.skip) {
      opts.skipped.push(outcome.skip);
      console.log(
        `  ${ver.id}: SKIPPED (${outcome.skip.stage}) — ${outcome.skip.reason}`,
      );
      continue;
    }

    // The first version that yields a fingerprint becomes the state baseline
    // every later version is checked against.
    if (baseline === undefined && outcome.fingerprint) {
      baseline = { id: ver.id, fingerprint: outcome.fingerprint };
    }

    const r = outcome.result!;
    console.log(`  ${formatRunLine(ver.id, r)}`);
    runs.push({
      version: ver.id,
      run_id: r.run_id,
      task_success: r.task_success,
      repair_count: r.repair_count,
      steps_replay_valid: r.steps_replay_valid,
      steps_total: r.steps_total,
      // Both, on purpose. `outcome` is what the NDJSON carries; every genuine
      // failure reads REPAIR_EXHAUSTED there because stub repair always
      // proposes null, which flattens "locator gone" and "assertion false"
      // into one value. `first_pass` is what actually happened.
      outcomes: r.step_results.map((s) => ({
        step: s.step_index,
        outcome: s.outcome,
        ...(s.first_pass_outcome ? { first_pass: s.first_pass_outcome } : {}),
      })),
      wall_clock_total_ms: r.wall_clock_total_ms,
    });
  }

  return baseline ? { runs, baseline } : { runs };
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

  if (!args.dryRun && !dockerAvailable()) {
    console.error(
      "gate:matrix: live runs need a running Docker daemon. " +
        "Start Docker, or pass --dry-run to exercise the harness without it.",
    );
    process.exit(2);
    return;
  }

  const walked = selected.filter((v) => !isUnavailable(v));
  const skipped: VersionSkip[] = selected.filter(isUnavailable).map((v) => ({
    id: v.id,
    stage: "compose-up" as const,
    reason: v.reason ?? "marked unavailable in scripts/testbed/matrix.json",
  }));

  await mkdir(OUT_DIR, { recursive: true });
  const ndjsonPath = path.join(OUT_DIR, "metrics.ndjson");
  const summaryPath = path.join(OUT_DIR, "matrix-run.json");
  const emitter = new MetricsEmitter(ndjsonPath);

  const programPath = args.program ?? DEFAULT_PROGRAM;
  let program: CompiledProgram;
  try {
    program = await loadProgram(programPath);
  } catch (err) {
    console.error(`gate:matrix: ${err instanceof Error ? err.message : err}`);
    process.exit(2);
    return;
  }

  const mode = args.dryRun ? "dry-run" : "live";
  console.log(
    `gate:matrix ${mode} — ${matrix.target} matrix, ` +
      `${walked.length} version(s) to walk, program=${program.program_id} ` +
      `(${program.steps.length} step(s))`,
  );
  for (const s of skipped) {
    console.log(`  skipped ${s.id}: ${s.reason}`);
  }

  const port = args.port ?? DEFAULT_HOST_PORT;
  const { runs, baseline } = await walkVersions({
    walked,
    program,
    emitter,
    matrix,
    args,
    port,
    skipped,
  });

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
        mode,
        dry_run: args.dryRun,
        ...(args.dryRun ? { not_a_measurement: DRY_RUN_NOTE } : {}),
        matrix_source: "scripts/testbed/matrix.json",
        matrix_target: matrix.target,
        selection: selectionLabel,
        versions_in_matrix: all.length,
        versions_walked: runs.map((r) => r["version"]),
        versions_skipped: skipped,
        program_id: program.program_id,
        program_path: path.relative(process.cwd(), programPath),
        ...(baseline ? { state_baseline_version: baseline.id } : {}),
        runs,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`wrote ${ndjsonPath}`);
  console.log(`wrote ${summaryPath}`);

  if (runs.length === 0) {
    console.error(
      "gate:matrix: measured 0 versions — nothing was measured. " +
        `${skipped.length} of ${selected.length} selected version(s) were skipped.`,
    );
    process.exit(1);
    return;
  }
}

/**
 * Dry-run path, unchanged in substance: hard-coded PASS outcomes and zero
 * tokens. Kept because it exercises the harness without Docker and the CI job
 * depends on it — and kept labelled, so its rows can never be read as a
 * measurement.
 */
async function runDryVersion(
  ver: MatrixVersion,
  program: CompiledProgram,
  emitter: MetricsEmitter,
): Promise<Record<string, unknown>> {
  // Only testbed_version varies. site_key/task_key stay whatever the compiled
  // program actually is — relabelling a local-demo program as a Grafana one
  // per version would make the row claim a run that never happened.
  const runProgram: CompiledProgram = { ...program, testbed_version: ver.id };
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
  console.log(`  ${JSON.stringify(row)}`);
  return row;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
