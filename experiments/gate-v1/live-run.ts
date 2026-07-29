/**
 * Live per-version driver for the gate matrix (issue #62).
 *
 * Brings up one seeded test-bed version, drives a real browser through the
 * compiled program, and tears everything down. The measurement rules are the
 * whole point, so they are stated once here and enforced below:
 *
 * 1. **A failed step is the measurement, not an error to recover from.** Nothing
 *    in this file retries a step, downgrades an outcome, or catches an assertion
 *    failure. `ReplayRunner` owns the only permitted second attempt (repair,
 *    bounded by `maxRepairsPerRun`), and its `StepOutcome` is emitted verbatim.
 *
 * 2. **A skip is not a failure.** A version whose container never started, whose
 *    image would not pull, or whose seed state does not match the base version
 *    produced no measurement at all. Recording that as a failed run would invent
 *    a data point; dropping it would shrink the denominator silently. Skips go
 *    to the ledger with a reason and never reach the NDJSON.
 *
 * 3. **Teardown is unconditional.** Every bring-up is paired with a `finally`,
 *    so a crash mid-version cannot leave a container holding port 3000 and make
 *    the *next* version fail for a reason that has nothing to do with churn.
 */

import { chromium, type Browser, type Page } from "playwright";
import { MetricsEmitter } from "../../src/metrics/emitter.js";
import { establishSession, LoginFailedError } from "../../src/recorder/preamble.js";
import { ReplayRunner } from "../../src/runner/replay.js";
import type {
  CompiledProgram,
  ParamBindings,
  RunResult,
} from "../../src/runner/types.js";
import {
  FIXTURE_ADMIN_PASS,
  FIXTURE_ADMIN_USER,
} from "../../src/testbed/constants.js";
import {
  buildComposeEnv,
  composeDown,
  composeUp,
  type ComposeEnv,
} from "../../src/testbed/docker.js";
import type { MatrixVersion } from "../../src/testbed/matrix.js";
import { prepareProvisioningOverlay } from "../../src/testbed/provisioning.js";
import {
  readinessPlan,
  ReadinessTimeoutError,
  waitUntilReady,
} from "../../src/testbed/readiness.js";
import { seedInstance } from "../../src/testbed/seed.js";
import {
  buildFingerprint,
  canonicalJson,
  type SeedFingerprint,
} from "../../src/testbed/verify.js";

/** Stage at which a version was abandoned before any step could be measured. */
export type SkipStage =
  | "compose-up"
  | "readiness"
  | "seed"
  | "fingerprint"
  | "browser"
  | "login-preamble";

export interface VersionSkip {
  id: string;
  reason: string;
  stage: SkipStage;
}

export interface LiveRunOutcome {
  /** Present when the version was measured. */
  result?: RunResult;
  /** Present when the version produced no measurement. */
  skip?: VersionSkip;
  /** Seed fingerprint observed, when we got far enough to read one. */
  fingerprint?: SeedFingerprint;
}

export interface LiveRunOptions {
  version: MatrixVersion;
  program: CompiledProgram;
  matrixImage: string;
  baseUrlTemplate: string;
  hostPort: number;
  emitter: MetricsEmitter;
  headed: boolean;
  /** Leave the container up after the run (debugging). */
  keepUp: boolean;
  /** Log in before the program runs. Off for programs that log in themselves. */
  preamble: boolean;
  /**
   * Caller-supplied bindings for the program's own `param_refs`. Merged over
   * the driver's `base_url`/`host`/`port`, never under them — a program cannot
   * redirect itself away from the version being measured.
   */
  extraParams?: Record<string, string>;
  readyTimeoutSeconds?: number;
  maxRepairsPerRun?: number;
  /**
   * Baseline to compare this version's seed state against. Undefined for the
   * first version walked, which *becomes* the baseline.
   */
  baseline?: { id: string; fingerprint: SeedFingerprint };
  log?: (line: string) => void;
}

/**
 * Why a fingerprint mismatch aborts the version rather than failing it.
 *
 * The matrix measures how much *browser churn* a version introduces. If the
 * seeded state itself differs — a panel missing, the operator absent — then a
 * step failure could be the seed's fault rather than the surface's, and the run
 * would confound the two. There is no honest way to attribute it after the
 * fact, so the version produces no data point instead of a misleading one.
 *
 * Exported for unit test: this decision must be inspectable without Docker.
 */
export function fingerprintMismatch(
  baseline: { id: string; fingerprint: SeedFingerprint },
  observed: SeedFingerprint,
): string | null {
  const left = canonicalJson(baseline.fingerprint);
  const right = canonicalJson(observed);
  if (left === right) return null;
  return (
    `seed state differs from base version ${baseline.id}; ` +
    `a state difference would confound the churn measurement. ` +
    `Compare with: npm run testbed -- --version <id> --verify --json`
  );
}

/** One-line, greppable summary of a measured version. */
export function formatRunLine(versionId: string, r: RunResult): string {
  return (
    `${versionId}: ${r.task_success ? "SUCCESS" : "FAILED"} ` +
    `steps_valid=${r.steps_replay_valid}/${r.steps_total} ` +
    `repairs=${r.repair_count} ` +
    `wall=${(r.wall_clock_total_ms / 1000).toFixed(1)}s`
  );
}

/**
 * Run one version end to end.
 *
 * Never throws for a measurable failure — a failed program is a returned
 * `result` whose `task_success` is false. It throws only if the caller's own
 * arguments are unusable, which is a bug rather than a data point.
 */
export async function runVersionLive(
  opts: LiveRunOptions,
): Promise<LiveRunOutcome> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const ver = opts.version;
  const baseUrl = opts.baseUrlTemplate.replace("{port}", String(opts.hostPort));

  const provisioningDir = prepareProvisioningOverlay(ver.id);
  const env: ComposeEnv = buildComposeEnv({
    versionId: ver.id,
    imageTag: ver.image_tag,
    provisioningDir,
    hostPort: opts.hostPort,
  });

  let browser: Browser | undefined;
  try {
    // --- bring up -----------------------------------------------------------
    log(`  ${ver.id}: docker compose up (${opts.matrixImage}:${ver.image_tag})`);
    const up = composeUp(env, false);
    if (!up.ok) {
      return {
        skip: {
          id: ver.id,
          stage: "compose-up",
          // The daemon's own words. A paraphrase would lose the pull error that
          // usually explains it.
          reason: composeFailureReason(up.stderr, up.stdout),
        },
      };
    }

    const plan = readinessPlan(baseUrl, opts.readyTimeoutSeconds);
    try {
      const ready = await waitUntilReady({ versionId: ver.id, plan });
      log(`  ${ver.id}: ready after ${(ready.elapsedMs / 1000).toFixed(1)}s`);
    } catch (err) {
      if (!(err instanceof ReadinessTimeoutError)) throw err;
      return {
        skip: { id: ver.id, stage: "readiness", reason: err.message },
      };
    }

    try {
      await seedInstance({
        baseUrl,
        versionId: ver.id,
        timeoutMs: plan.timeoutMs,
      });
    } catch (err) {
      return {
        skip: { id: ver.id, stage: "seed", reason: errText(err) },
      };
    }

    // --- seed-state gate ----------------------------------------------------
    let observed: SeedFingerprint;
    try {
      observed = (await buildFingerprint(baseUrl)).fingerprint;
    } catch (err) {
      return {
        skip: { id: ver.id, stage: "fingerprint", reason: errText(err) },
      };
    }

    if (opts.baseline) {
      const mismatch = fingerprintMismatch(opts.baseline, observed);
      if (mismatch) {
        return {
          fingerprint: observed,
          skip: { id: ver.id, stage: "fingerprint", reason: mismatch },
        };
      }
    }

    // --- browser ------------------------------------------------------------
    try {
      browser = await chromium.launch({ headless: !opts.headed });
    } catch (err) {
      return {
        fingerprint: observed,
        skip: { id: ver.id, stage: "browser", reason: errText(err) },
      };
    }

    // A fresh context per version: carried-over storage would let one version's
    // state decide another version's outcome.
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    if (opts.preamble) {
      try {
        const session = await establishSession(page, {
          baseUrl,
          username: FIXTURE_ADMIN_USER,
          password: FIXTURE_ADMIN_PASS,
        });
        log(
          `  ${ver.id}: session as ${session.user_login}` +
            `${session.dismissed_first_run_modal ? " (dismissed first-run dialog)" : ""}`,
        );
      } catch (err) {
        // Login is scaffolding, not a measured step (#60). A broken login is a
        // version we could not measure, not a version that failed the task.
        const stage = err instanceof LoginFailedError ? err.stage : "unknown";
        return {
          fingerprint: observed,
          skip: {
            id: ver.id,
            stage: "login-preamble",
            reason: `login failed at ${stage}: ${errText(err)}`,
          },
        };
      }
    }

    // --- measure ------------------------------------------------------------
    const runProgram: CompiledProgram = {
      ...opts.program,
      testbed_version: ver.id,
    };
    const runner = new ReplayRunner({
      dryRun: false,
      page,
      metrics: opts.emitter,
      maxRepairsPerRun: opts.maxRepairsPerRun ?? 2,
    });

    const params: ParamBindings = {
      ...(opts.extraParams ?? {}),
      base_url: baseUrl,
      host: hostOf(baseUrl),
      port: opts.hostPort,
    };

    // Deliberately unguarded. An exception here is a harness bug and must not be
    // laundered into a skip — that would hide a broken driver as missing data.
    const result = await runner.run(runProgram, params);
    return { result, fingerprint: observed };
  } finally {
    await browser?.close().catch(() => undefined);
    if (opts.keepUp) {
      log(`  ${ver.id}: --keep-up, leaving container running at ${baseUrl}`);
    } else {
      const down = composeDown(env, false);
      if (!down.ok) {
        // Surfaced, never swallowed: a container still holding the port makes
        // the next version fail for a reason that is not churn.
        console.error(
          `  ${ver.id}: teardown reported a problem — ${lastLines(down.stderr, 2)}`,
        );
      }
    }
  }
}

function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return "127.0.0.1";
  }
}

function errText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.split("\n")[0]!.slice(0, 300);
}

function lastLines(text: string, n: number): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.slice(-n).join(" / ").slice(0, 400);
}

/**
 * The reason a `compose up` failed, as the daemon reported it.
 *
 * Compose interleaves per-container **progress** ("Creating", "Created",
 * "Starting") with the actual error, and it does not consistently choose a
 * stream. Taking the first lines yields the progress noise and buries the
 * cause, which makes a skip reason useless for the person reading the ledger
 * later — so this prefers stderr, and reads from the end where the failure is.
 *
 * Exported for unit test: a skip reason is the only record of why a version
 * produced no data, and it must not silently degrade to "Creating".
 */
export function composeFailureReason(stderr: string, stdout: string): string {
  const preferred = stderr.trim() ? stderr : stdout;
  const meaningful = preferred
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/\b(Creating|Created|Starting|Pulling|Waiting|Running)\s*$/.test(l));

  if (meaningful.length > 0) return meaningful.slice(-3).join(" / ").slice(0, 400);
  // Everything was progress chatter — say so rather than quoting "Creating".
  const tail = lastLines(preferred, 2);
  return tail
    ? `compose up failed with no error line; last output: ${tail}`
    : "compose up failed with no output from docker";
}
