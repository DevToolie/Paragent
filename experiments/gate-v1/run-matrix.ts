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
import { MetricsEmitter, readMetricNdjson } from "../../src/metrics/emitter.js";
import { ReplayRunner } from "../../src/runner/replay.js";
import { bundleToProgram, isCompiledBundle, rowsToProgram } from "../../src/runner/program.js";
import { JsonlCacheStore } from "../../src/cache/store.js";
import { resolveProgram } from "../../src/cache/resolve.js";
import { requiredParams } from "../../src/runner/params.js";
import type {
  CompiledProgram,
  ParamBindings,
  RunResult,
} from "../../src/runner/types.js";
import type { MetricRow, ProgramSource, StepOutcome } from "../../src/metrics/types.js";
import {
  SECTION9_MIN_RUNS,
  SECTION9_MIN_STEP_EXECUTIONS,
  section9SampleFloor,
} from "../../src/metrics/aggregate.js";
import { dockerAvailable } from "../../src/testbed/docker.js";
import {
  isUnavailable,
  listVersions,
  loadMatrix,
  type MatrixVersion,
} from "../../src/testbed/matrix.js";
import { DEFAULT_HOST_PORT } from "../../src/testbed/constants.js";
import type { SeedFingerprint } from "../../src/testbed/verify.js";
import {
  DEFAULT_RUNS_PER_VERSION,
  runsToClearSection9,
  runVersionLive,
  type VersionSkip,
} from "./live-run.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "out");
const DEFAULT_PROGRAM = path.join(__dirname, "fixtures/compiled-program.json");

const DRY_RUN_NOTE = "dry-run — tokens remain 0; not a gate measurement";

/**
 * Names the driver binds itself, per version. Values come from the container
 * that is about to be booted, so only the names are known this early — which is
 * all the pre-flight needs.
 */
export const DRIVER_BOUND_PARAMS = ["base_url", "host", "port"] as const;

/**
 * Bindings the dry-run path supplies.
 *
 * Hoisted out of `runDryVersion` so the pre-flight check below and the run
 * itself cannot disagree about what will be bound — a pre-flight that passes
 * and a run that then refuses would be worse than no pre-flight.
 *
 * It covers `DRIVER_BOUND_PARAMS` with obvious placeholders, alongside the
 * `file://local-demo` one that was already here. A dry run interpolates
 * nothing — every outcome is hard-coded — so these are inert labels, not
 * measurements, and every row a dry run writes carries `DRY_RUN_NOTE`. Binding
 * them here is what makes `--dry-run` a faithful pre-flight for the live path:
 * it then asks the caller for exactly the params a live run would, no more.
 */
export const DRY_RUN_PARAMS: ParamBindings = {
  base_url: "file://local-demo",
  host: "local-demo",
  port: 0,
  resource_label: "widget",
};

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
  /** Repeats per version. See DEFAULT_RUNS_PER_VERSION for why the default is 3. */
  runs: number;
  /**
   * Resolve the program from a cache directory instead of a file (#118).
   *
   * Requires `--site-key` and `--task-key`: a cache is keyed by them, and
   * taking them from a bundle would mean loading the file this flag exists to
   * avoid consulting.
   */
  fromCache?: string;
  siteKey?: string;
  taskKey?: string;
  /** Read only pool-eligible rows — the cross-tenant case (ADR-0014). */
  poolOnly: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    help: false,
    headed: false,
    keepUp: false,
    preamble: true,
    params: {},
    runs: DEFAULT_RUNS_PER_VERSION,
    poolOnly: false,
  };
  const valued = new Set([
    "--versions",
    "--program",
    "--port",
    "--param",
    "--runs",
    "--from-cache",
    "--site-key",
    "--task-key",
  ]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--pool-only") args.poolOnly = true;
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
  } else if (key === "runs") {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1) throw new Error(`--runs must be >= 1, got: ${value}`);
    args.runs = n;
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
                     the program declares is the caller's to supply. Checked
                     before anything boots: a program with an unbound parameter
                     is refused by name rather than failing mid-run as churn.
  --runs <n>         Repeats per version (default ${DEFAULT_RUNS_PER_VERSION}). One run per
                     version cannot separate churn from flakiness. PRD §9 wants
                     >=42 runs and >=400 step-executions across the matrix; the
                     report states the shortfall rather than hiding it.
  --from-cache <dir> Resolve the program from the cache in <dir> instead of a
                     file (#118). Needs --site-key and --task-key. Refuses the
                     run — without counting it — when no COMPLETE program
                     resolves, because a truncated program is never replayed.
  --site-key <k>     Cache lookup key. Only meaningful with --from-cache.
  --task-key <k>     Cache lookup key. Only meaningful with --from-cache.
  --pool-only        Resolve from pool-eligible rows only: the cross-tenant
                     case, where a tenant-scoped row must be invisible.
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
  /** Where `program` came from (#118). Recorded on every row it produces. */
  programSource?: ProgramSource;
  cacheProgramInvalidated?: boolean;
  emitter: MetricsEmitter;
  matrix: ReturnType<typeof loadMatrix>;
  args: Args;
  port: number;
  skipped: VersionSkip[];
  /** Append buffered metric rows to the NDJSON. Called after every run. */
  persist: () => Promise<void>;
  shouldStop: () => boolean;
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
      for (let i = 1; i <= opts.args.runs; i++) {
        runs.push(
          await runDryVersion(
            ver,
            opts.program,
            opts.emitter,
            i,
            opts.args.runs,
            opts.args.params,
            opts.programSource,
          ),
        );
      }
      await opts.persist();
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
      runs: opts.args.runs,
      ...(opts.programSource ? { programSource: opts.programSource } : {}),
      ...(opts.cacheProgramInvalidated !== undefined
        ? { cacheProgramInvalidated: opts.cacheProgramInvalidated }
        : {}),
      // Persist after every run, not at the end. An interrupt during version 6
      // must not discard versions 1-5.
      onRunComplete: async () => {
        await opts.persist();
      },
      shouldStop: opts.shouldStop,
      ...(baseline ? { baseline } : {}),
    });

    // A skip can now arrive *with* completed runs (interrupted partway, or the
    // login broke on repeat 2). Those runs happened and are kept — discarding
    // them is the easiest way to manufacture a passing gate.
    for (const r of outcome.results) runs.push(ledgerRow(ver.id, r));

    if (outcome.skip) {
      opts.skipped.push(outcome.skip);
      console.log(
        `  ${ver.id}: SKIPPED (${outcome.skip.stage}) — ${outcome.skip.reason}`,
      );
    }

    // The first version that yields a fingerprint becomes the state baseline
    // every later version is checked against.
    if (baseline === undefined && outcome.fingerprint) {
      baseline = { id: ver.id, fingerprint: outcome.fingerprint };
    }

    await opts.persist();
    if (opts.shouldStop?.()) break;
  }

  return baseline ? { runs, baseline } : { runs };
}

/**
 * `matrix-run.json`'s §9 sample-floor block, computed the same way
 * `gate:report`'s `report.json` computes its `sample` field: from the actual
 * persisted NDJSON rows via `section9SampleFloor()`, not from
 * `runs.length * program.steps.length`. That product assumes every run
 * executed every step, which `ReplayRunner.run()` does not guarantee — a run
 * that breaks on a hard failure partway through emits fewer step rows than
 * `program.steps.length`, and the two artifacts must not be able to disagree
 * about the same measurement (#95).
 */
export function buildSection9Floor(
  measuredRows: readonly MetricRow[],
  walkedVersionCount: number,
): {
  min_runs: number;
  min_step_executions: number;
  meets_floor: boolean;
  runs_needed_per_version: number;
} {
  return {
    min_runs: SECTION9_MIN_RUNS,
    min_step_executions: SECTION9_MIN_STEP_EXECUTIONS,
    meets_floor: section9SampleFloor(measuredRows).meets_floor,
    runs_needed_per_version: runsToClearSection9(walkedVersionCount),
  };
}

function ledgerRow(versionId: string, r: RunResult): Record<string, unknown> {
  return {
    version: versionId,
    run_id: r.run_id,
    task_success: r.task_success,
    repair_count: r.repair_count,
    steps_replay_valid: r.steps_replay_valid,
    steps_attempted: r.steps_attempted,
    steps_total: r.steps_total,
    // A run stopped by its own clock is not a run that failed on the site
    // (#84). Recorded here as well as in the NDJSON so the ledger a human reads
    // says which of the two happened.
    ...(r.budget_exhausted
      ? { budget_exhausted: true, wall_clock_budget_ms: r.wall_clock_budget_ms }
      : {}),
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
  };
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

  let program: CompiledProgram;
  let programSource: ProgramSource = "file";
  let cacheProgramInvalidated: boolean | undefined;
  /** What the run summary records as the program's origin. */
  let programOrigin: string;

  if (args.fromCache !== undefined) {
    // The cache read path (#118). Refuses rather than degrades: a MISS exits
    // before any container boots, for the same reason an unbound parameter
    // does (#122). A refused run is not a failed run — it is an absent one,
    // and it contributes to no §9 denominator.
    if (!args.siteKey || !args.taskKey) {
      console.error(
        "gate:matrix: --from-cache needs --site-key and --task-key " +
          "(a cache is keyed by them; reading them from a bundle would mean " +
          "loading the file --from-cache exists to avoid).",
      );
      process.exit(2);
      return;
    }
    const store = new JsonlCacheStore({ dir: args.fromCache });
    const resolution = resolveProgram(
      store,
      { site_key: args.siteKey, task_key: args.taskKey },
      { scope: args.poolOnly ? "pool_only" : "any" },
    );
    if (resolution.status === "miss") {
      console.error(
        `gate:matrix: cache MISS for ${args.siteKey}/${args.taskKey} ` +
          `(${resolution.reason}): ${resolution.detail}\n` +
          "Nothing was run. A partial program is never replayed — see ADR-0013.",
      );
      process.exit(2);
      return;
    }
    program = rowsToProgram(resolution, "unset");
    programSource = "cache";
    programOrigin = `cache:${path.relative(process.cwd(), args.fromCache)}`;
    // Advisory, recorded so a reader can segment hit-rate by cache health. It
    // did not and must not change what gets attempted (ADR-0009, ADR-0014).
    cacheProgramInvalidated = resolution.invalidated;
    console.log(
      `gate:matrix: cache HIT ${resolution.program_id} ` +
        `(${resolution.steps_total} steps` +
        `${resolution.invalidated ? `, ${resolution.invalidated_step_indices.length} invalidated` : ""})`,
    );
  } else {
    const programPath = args.program ?? DEFAULT_PROGRAM;
    programOrigin = path.relative(process.cwd(), programPath);
    try {
      program = await loadProgram(programPath);
    } catch (err) {
      console.error(`gate:matrix: ${err instanceof Error ? err.message : err}`);
      process.exit(2);
      return;
    }
  }

  // Pre-flight the bindings before anything expensive: no container boot, no
  // browser, no truncated NDJSON. `run()` would refuse anyway, but it would do
  // so after the first container is up and per version — and a caller staring
  // at a torn-down matrix has to work out that the driver, not the site, was
  // the problem (#122). Names only; no value is printed.
  const willBind = new Set<string>([
    ...DRIVER_BOUND_PARAMS,
    ...Object.keys(args.params),
    ...(args.dryRun ? Object.keys(DRY_RUN_PARAMS) : []),
  ]);
  const unbound = requiredParams(program).filter((name) => !willBind.has(name));
  if (unbound.length > 0) {
    console.error(
      `gate:matrix: ${program.program_id} needs parameter(s) nothing binds: ` +
        `${unbound.join(", ")}.\n` +
        `  Pass ${unbound.map((n) => `--param ${n}=<value>`).join(" ")}\n` +
        "  Refusing to start: an unbound parameter fails as PAGE_ERROR or " +
        "ASSERTION_FAILED, which is indistinguishable from site churn in the " +
        "§9 aggregates.",
    );
    process.exit(2);
    return;
  }

  const mode = args.dryRun ? "dry-run" : "live";
  const plannedRuns = walked.length * args.runs;
  const plannedSteps = plannedRuns * program.steps.length;
  console.log(
    `gate:matrix ${mode} — ${matrix.target} matrix, ` +
      `${walked.length} version(s) × ${args.runs} run(s) = ${plannedRuns} run(s), ` +
      `program=${program.program_id} (${program.steps.length} step(s))`,
  );
  // Say up front whether this run can carry a §9 claim. Discovering it in the
  // report after 45 minutes of container boots is too late to be useful.
  if (plannedRuns < 42 || plannedSteps < 400) {
    const need = runsToClearSection9(walked.length);
    console.log(
      `  note: ${plannedRuns} runs / ${plannedSteps} step-executions is below the ` +
        `PRD §9 floor (>=42 / >=400). Use --runs ${need} over ${walked.length} ` +
        "version(s) to clear it. The report records the shortfall either way.",
    );
  }
  for (const s of skipped) {
    console.log(`  skipped ${s.id}: ${s.reason}`);
  }

  // Truncate once, then append per run. `flush()` overwrites, so using it at the
  // end means an interrupt loses every row the matrix produced; appending as we
  // go is what makes a partial NDJSON valid and complete-as-far-as-it-got.
  await writeFile(ndjsonPath, "", "utf8");
  const persist = async (): Promise<void> => {
    await emitter.appendFlush();
  };

  // Cooperative, checked between runs. Killing mid-run would leave a half-emitted
  // run and an orphaned container; the second Ctrl-C is the escape hatch.
  let stopRequested = false;
  const onSignal = (): void => {
    if (stopRequested) process.exit(130);
    stopRequested = true;
    console.log(
      "\ngate:matrix: interrupt received — finishing the current run, then " +
        "tearing down. Press Ctrl-C again to abort immediately (may orphan a container).",
    );
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  const port = args.port ?? DEFAULT_HOST_PORT;
  const { runs, baseline } = await walkVersions({
    walked,
    program,
    ...(programSource === "cache" ? { programSource } : {}),
    ...(cacheProgramInvalidated !== undefined ? { cacheProgramInvalidated } : {}),
    emitter,
    matrix,
    args,
    port,
    skipped,
    persist,
    shouldStop: () => stopRequested,
  });

  await persist();
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);

  // Read back what was actually persisted rather than trusting the in-memory
  // run count: matrix-run.json's §9 floor must agree with report.json's,
  // which is built from these same rows (#95).
  const measuredRows = await readMetricNdjson(ndjsonPath);

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
        runs_per_version: args.runs,
        interrupted: stopRequested,
        // Planned vs actual, both. A reader comparing them can see at a glance
        // whether the matrix finished or was cut short, without inferring it
        // from array lengths.
        runs_planned: plannedRuns,
        runs_completed: runs.length,
        section9_floor: buildSection9Floor(measuredRows, walked.length),
        versions_in_matrix: all.length,
        versions_walked: [...new Set(runs.map((r) => r["version"]))],
        versions_skipped: skipped,
        program_id: program.program_id,
        program_path: programOrigin,
        program_source: programSource,
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
  runIndex: number,
  totalRuns: number,
  extraParams: Record<string, string> = {},
  programSource?: ProgramSource,
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
    ...(programSource ? { programSource } : {}),
  });

  // `--param` is honoured here too, with the driver's own bindings winning —
  // the same precedence the live path uses. A dry run interpolates nothing, so
  // the values are inert; what matters is that `--dry-run` asks for exactly the
  // params a live run would, which is what makes it a usable pre-flight (#122).
  const result = await runner.run(runProgram, { ...extraParams, ...DRY_RUN_PARAMS });

  const row = {
    version: ver.id,
    run: `${runIndex}/${totalRuns}`,
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

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
