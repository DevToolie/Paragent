/**
 * Readiness gate between `docker compose up --wait` and the HTTP seed.
 *
 * `--wait` only waits for the container's own healthcheck. That healthcheck is a
 * good signal but it is the *container's* opinion, and on a cold pull or a slow
 * runner the API can still be settling when compose returns. Seeding into a
 * half-started API fails as a bare fetch error, which reads like a bug in the
 * seed rather than "Grafana was not ready yet".
 *
 * Readiness signal: `GET /api/health` returning HTTP 200 with a JSON body whose
 * `database` field is `"ok"`. Stable across the whole matrix range (9.5 → 13.0).
 * Source: https://grafana.com/docs/grafana/latest/developers/http_api/other/#returns-health-information-about-grafana
 * access_date: 2026-07-26
 */

/** Poll interval. Short enough to not add latency, long enough to not spin. */
export const READY_POLL_INTERVAL_MS = 1000;

/**
 * Default overall budget, in seconds.
 *
 * Measured worst case so far: ~18s for a cold `grafana/grafana:11.0.0` pull plus
 * boot locally, and 14s for pull+boot+seed on a GitHub `ubuntu-latest` runner
 * (CI job `testbed-smoke`). 120s is roughly 8x that headroom, which covers a
 * slow runner or a larger image without being long enough to mask a genuinely
 * dead instance — and it stays well under the CI job's 10-minute ceiling.
 */
export const DEFAULT_READY_TIMEOUT_SECONDS = 120;

export interface HealthProbe {
  /** HTTP status, or null when the connection itself failed. */
  status: number | null;
  /** Parsed `database` field, when the body was JSON. */
  database: string | null;
  /** Connection-level error message, when there was no response at all. */
  error: string | null;
}

/**
 * Grafana is ready when the API answers 200 and reports its database as ok.
 *
 * Deliberately parses the body instead of regexing it: a 200 with
 * `database: "failing"` is a *running* Grafana that cannot serve, and a
 * substring test for "ok" on the raw body can pass on unrelated fields.
 */
export function isHealthy(status: number, body: string): boolean {
  if (status !== 200) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }
  const database = (parsed as { database?: unknown } | null)?.database;
  return typeof database === "string" && database.toLowerCase() === "ok";
}

/** Single probe. Never throws — a refused connection is a normal early state. */
export async function probeHealth(healthUrl: string): Promise<HealthProbe> {
  try {
    const res = await fetch(healthUrl);
    const body = await res.text();
    let database: string | null = null;
    try {
      const parsed = JSON.parse(body) as { database?: unknown } | null;
      if (typeof parsed?.database === "string") database = parsed.database;
    } catch {
      // Non-JSON body — status alone will fail the predicate.
    }
    return {
      status: res.status,
      database,
      error: isHealthy(res.status, body)
        ? null
        : `unhealthy body: ${body.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      status: null,
      database: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface ReadinessPlan {
  healthUrl: string;
  intervalMs: number;
  timeoutMs: number;
}

export function readinessPlan(
  baseUrl: string,
  timeoutSeconds = DEFAULT_READY_TIMEOUT_SECONDS,
): ReadinessPlan {
  return {
    healthUrl: `${baseUrl.replace(/\/$/, "")}/api/health`,
    intervalMs: READY_POLL_INTERVAL_MS,
    timeoutMs: timeoutSeconds * 1000,
  };
}

/** What `--dry-run` prints instead of polling. */
export function formatReadinessPlan(
  versionId: string,
  plan: ReadinessPlan,
): string {
  return [
    `readiness plan for ${versionId}:`,
    `  poll     GET ${plan.healthUrl}`,
    `  expect   HTTP 200 with JSON database="ok"`,
    `  interval ${plan.intervalMs}ms`,
    `  timeout  ${plan.timeoutMs / 1000}s`,
  ].join("\n");
}

/**
 * Redact anything credential-shaped before a log tail reaches stdout.
 *
 * The fixture password is not a production secret, but a CI log is a public
 * artifact and the repo's rule is that nothing credential-shaped appears in one.
 *
 * Scoped to credential *shapes* — `key=value` and basic-auth in a URL — rather
 * than blanket-replacing the fixture password wherever it occurs. The password
 * happens to be the project name, so a blanket rule would rewrite ordinary log
 * lines mentioning `paragent-seed` or `paragent-testdata` into `***-seed`, which
 * would damage the diagnostic this function exists to make readable.
 */
export function scrubCredentials(text: string): string {
  return text
    .replace(
      /((?:password|passwd|secret|token|api[_-]?key|authorization)["'\s]*[:=]\s*)("?)[^\s",;)]+/gi,
      "$1$2***",
    )
    .replace(/(\w+:\/\/[^\s:@/]+:)[^\s@]+(@)/g, "$1***$2");
}

export class ReadinessTimeoutError extends Error {
  constructor(
    message: string,
    readonly elapsedMs: number,
    readonly attempts: number,
    /** Always present: waitUntilReady probes at least once before giving up. */
    readonly last: HealthProbe,
  ) {
    super(message);
    this.name = "ReadinessTimeoutError";
  }
}

export interface WaitUntilReadyOptions {
  versionId: string;
  plan: ReadinessPlan;
  /** Injected in tests; defaults to a real probe. */
  probe?: (url: string) => Promise<HealthProbe>;
  /** Injected in tests; defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface ReadyResult {
  elapsedMs: number;
  attempts: number;
}

/**
 * Poll until healthy or the budget is spent.
 *
 * Throws ReadinessTimeoutError on timeout so the caller can attach a compose log
 * tail — this module deliberately does not shell out to Docker itself.
 */
export async function waitUntilReady(
  opts: WaitUntilReadyOptions,
): Promise<ReadyResult> {
  const probe = opts.probe ?? probeHealth;
  const now = opts.now ?? Date.now;
  const sleep =
    opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const started = now();
  const deadline = started + opts.plan.timeoutMs;
  let attempts = 0;
  // No initializer: the do-body always assigns before anything reads it, which
  // is also why the diagnostic can rely on there always being a last probe.
  let last: HealthProbe;

  // Always probe at least once, even with a 0/tiny budget, so the diagnostic
  // reports a real observation rather than "never asked".
  do {
    attempts += 1;
    last = await probe(opts.plan.healthUrl);
    if (last.status !== null && last.error === null) {
      return { elapsedMs: now() - started, attempts };
    }
    if (now() + opts.plan.intervalMs >= deadline) break;
    await sleep(opts.plan.intervalMs);
  } while (now() < deadline);

  throw new ReadinessTimeoutError(
    `Grafana did not become ready within ${opts.plan.timeoutMs / 1000}s`,
    now() - started,
    attempts,
    last,
  );
}

/**
 * The block printed on timeout. Everything a later agent needs to diagnose
 * without re-running with extra flags.
 */
export function formatTimeoutDiagnostic(args: {
  versionId: string;
  plan: ReadinessPlan;
  error: ReadinessTimeoutError;
  logTail: string;
}): string {
  const { versionId, plan, error, logTail } = args;
  const lastLine = [
    `  last status:   ${error.last.status ?? "no response"}`,
    `  last database: ${error.last.database ?? "n/a"}`,
    `  last error:    ${error.last.error ?? "n/a"}`,
  ].join("\n");

  const tail = scrubCredentials(logTail).trimEnd();
  return [
    `readiness FAILED for ${versionId}`,
    `  polled:        GET ${plan.healthUrl}`,
    `  expected:      HTTP 200 with JSON database="ok"`,
    `  timeout:       ${plan.timeoutMs / 1000}s`,
    `  elapsed:       ${(error.elapsedMs / 1000).toFixed(1)}s over ${error.attempts} attempt(s)`,
    lastLine,
    "",
    "  last 20 lines of docker compose logs (credentials scrubbed):",
    tail.length > 0
      ? tail
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n")
      : "    (no output — container may not have started)",
    "",
    `  the instance was left running; inspect it or tear it down with:`,
    `    npm run testbed -- --version ${versionId} --down`,
  ].join("\n");
}
