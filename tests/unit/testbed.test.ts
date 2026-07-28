import { describe, it, expect } from "vitest";
import { parseArgs } from "../../src/testbed/args.js";
import { PACKAGE } from "../../src/testbed/constants.js";
import { buildComposeEnv } from "../../src/testbed/docker.js";
import {
  availableVersions,
  getVersion,
  isUnavailable,
  listVersions,
  loadMatrix,
  testdataTypeFor,
  type Matrix,
  type MatrixVersion,
} from "../../src/testbed/matrix.js";
import { composeProjectSlug } from "../../src/testbed/paths.js";
import {
  buildFingerprint,
  canonicalJson,
  diffFingerprints,
  flattenPanels,
  sortPanels,
  VerifyError,
  type ApiFn,
  type SeedFingerprint,
} from "../../src/testbed/verify.js";
import {
  DEFAULT_READY_TIMEOUT_SECONDS,
  formatReadinessPlan,
  formatTimeoutDiagnostic,
  isHealthy,
  readinessPlan,
  ReadinessTimeoutError,
  scrubCredentials,
  waitUntilReady,
} from "../../src/testbed/readiness.js";

describe("testbed matrix", () => {
  it("exposes package id", () => {
    expect(PACKAGE).toBe("testbed");
  });

  it("loads at least 8 Grafana versions", () => {
    const m = loadMatrix();
    expect(m.target).toBe("grafana-oss");
    expect(m.versions.length).toBeGreaterThanOrEqual(8);
    expect(m.versions.map((v) => v.id)).toContain("9.5.21");
    expect(m.versions.map((v) => v.id)).toContain("13.0.3");
  });

  it("resolves a known version", () => {
    const v = getVersion("11.0.0");
    expect(v.image_tag).toBe("11.0.0");
  });

  // The rename landed in 10.2.0, not 10.0. This test previously asserted
  // `10.0.13 -> grafana-testdata-datasource`, which is what the harness did and
  // what made the bug invisible: Grafana accepted the provisioned datasource and
  // listed it, then failed every query with plugin.notRegistered. Boundary
  // measured per image in issue #23 — see testdataTypeFor's comment.
  it("selects TestData plugin type at the measured 10.2.0 boundary", () => {
    expect(testdataTypeFor("9.5.21")).toBe("testdata");
    expect(testdataTypeFor("10.0.13")).toBe("testdata");
    expect(testdataTypeFor("10.1.0")).toBe("testdata");
    expect(testdataTypeFor("10.2.0")).toBe("grafana-testdata-datasource");
    expect(testdataTypeFor("10.4.19")).toBe("grafana-testdata-datasource");
    expect(testdataTypeFor("11.0.0")).toBe("grafana-testdata-datasource");
    expect(testdataTypeFor("13.0.3")).toBe("grafana-testdata-datasource");
  });

  it("treats a minorless version as the conservative side of the boundary", () => {
    expect(testdataTypeFor("10")).toBe("testdata");
    expect(testdataTypeFor("9")).toBe("testdata");
    expect(testdataTypeFor("11")).toBe("grafana-testdata-datasource");
  });
});

describe("matrix availability (#26)", () => {
  // `npm run gate:matrix` walks this list. A version that cannot be made to work
  // stays in the matrix — a shrinking matrix is a finding the gate writeup has
  // to disclose — but must not be walked, and must not vanish from the count.
  const withStatus = (id: string, status?: string, reason?: string): MatrixVersion => ({
    id,
    image_tag: id,
    released: "2025-01",
    churn_role: "test",
    docker_hub_tag_url: "https://example.invalid",
    github_release_url: "https://example.invalid",
    access_date: "2026-07-27",
    ...(status === undefined ? {} : { status }),
    ...(reason === undefined ? {} : { reason }),
  });

  const fake = (versions: MatrixVersion[]) =>
    ({ ...loadMatrix(), versions }) as Matrix;

  it("treats only `unavailable` as unwalkable", () => {
    expect(isUnavailable(withStatus("1.0.0"))).toBe(false);
    expect(isUnavailable(withStatus("1.0.0", "unavailable", "tag 404s"))).toBe(true);
    // Any other status value is not a skip signal — do not guess.
    expect(isUnavailable(withStatus("1.0.0", "verified"))).toBe(false);
  });

  it("filters unavailable versions out of the walkable list, keeping them in the matrix", () => {
    const m = fake([
      withStatus("1.0.0"),
      withStatus("2.0.0", "unavailable", "tag 404s"),
      withStatus("3.0.0"),
    ]);
    expect(availableVersions(m).map((v) => v.id)).toEqual(["1.0.0", "3.0.0"]);
    // The skipped row is still there to be counted and reported.
    expect(listVersions(m)).toHaveLength(3);
  });

  it("walks every pinned version today — none is marked unavailable", () => {
    expect(availableVersions()).toHaveLength(listVersions().length);
  });
});

describe("compose project name", () => {
  // `docker compose -p paragent-tb-11.0.0` is rejected outright: project names
  // allow no dots. Every matrix id has them, so the slug must strip them.
  it("produces a compose-legal slug for every matrix version", () => {
    for (const v of loadMatrix().versions) {
      const env = buildComposeEnv({
        versionId: v.id,
        imageTag: v.image_tag,
        provisioningDir: "/tmp/provisioning",
      });
      expect(env.COMPOSE_PROJECT_NAME).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
    }
  });

  it("maps dots to hyphens", () => {
    expect(composeProjectSlug("11.0.0")).toBe("11-0-0");
    expect(composeProjectSlug("9.5.21")).toBe("9-5-21");
  });
});

describe("testbed args", () => {
  it("parses --version and flags", () => {
    const a = parseArgs([
      "--version",
      "11.0.0",
      "--port",
      "3001",
      "--dry-run",
      "--skip-seed",
    ]);
    expect(a.version).toBe("11.0.0");
    expect(a.port).toBe(3001);
    expect(a.dryRun).toBe(true);
    expect(a.skipSeed).toBe(true);
    expect(a.down).toBe(false);
  });

  it("parses --list and --down", () => {
    expect(parseArgs(["--list"]).list).toBe(true);
    expect(parseArgs(["--version", "9.5.21", "--down"]).down).toBe(true);
  });

  it("rejects unknown flags", () => {
    expect(() => parseArgs(["--nope"])).toThrow(/unknown argument/);
  });
});

describe("verify args", () => {
  it("parses --verify --json", () => {
    const a = parseArgs(["--version", "11.0.0", "--verify", "--json"]);
    expect(a.verify).toBe(true);
    expect(a.json).toBe(true);
    expect(a.compare).toBeUndefined();
  });

  it("parses --compare with two versions and no --version", () => {
    const a = parseArgs(["--verify", "--compare", "11.0.0", "12.0.0"]);
    expect(a.compare).toEqual(["11.0.0", "12.0.0"]);
  });

  it("parses --compare with one version alongside --version", () => {
    const a = parseArgs(["--version", "11.0.0", "--verify", "--compare", "12.0.0"]);
    expect(a.version).toBe("11.0.0");
    expect(a.compare).toEqual(["12.0.0"]);
  });

  it("does not swallow the flag that follows --compare", () => {
    const a = parseArgs(["--verify", "--compare", "11.0.0", "--dry-run"]);
    expect(a.compare).toEqual(["11.0.0"]);
    expect(a.dryRun).toBe(true);
  });

  it("rejects --compare with no version", () => {
    expect(() => parseArgs(["--verify", "--compare"])).toThrow(/one or two matrix ids/);
  });
});

describe("verify treats an unanswering datasource as a failure", () => {
  // Issue #23: on 10.0.13 the seed datasource was present and listed, and every
  // query 404'd with plugin.notRegistered. A verify that reports queryable=false
  // and exits 0 is blind in exactly the way the presence checks were.
  const grafana = (queryStatus: number): ApiFn => {
    return (_baseUrl, _method, path) => {
      if (path === "/api/health") {
        return response(200, { version: "10.0.13" });
      }
      if (path === "/api/ds/query") {
        return response(
          queryStatus,
          queryStatus === 200
            ? { results: { A: { frames: [] } } }
            : { message: "Not found", messageId: "plugin.notRegistered", statusCode: 404 },
        );
      }
      if (path.startsWith("/api/datasources/uid/")) {
        return response(200, {
          name: "Paragent TestData",
          type: "grafana-testdata-datasource",
          uid: "paragent-testdata",
        });
      }
      if (path.startsWith("/api/dashboards/uid/")) {
        return response(200, {
          dashboard: {
            uid: "paragent-seed",
            title: "Paragent Seed",
            panels: [{ title: "Paragent Stat", type: "stat" }],
          },
        });
      }
      if (path === "/api/org/users") {
        return response(200, [{ login: "paragent_operator", role: "Editor" }]);
      }
      throw new Error(`unexpected path ${path}`);
    };
  };

  const response = async (
    status: number,
    json: unknown,
  ): Promise<{ status: number; json: unknown; text: string }> => ({
    status,
    json,
    text: JSON.stringify(json),
  });

  it("throws VerifyError when the datasource lists but does not answer", async () => {
    await expect(buildFingerprint("http://localhost:3000", grafana(404))).rejects.toThrow(
      VerifyError,
    );
    await expect(buildFingerprint("http://localhost:3000", grafana(404))).rejects.toThrow(
      /answers no query.*plugin\.notRegistered/s,
    );
  });

  it("fingerprints normally when the datasource answers", async () => {
    const result = await buildFingerprint("http://localhost:3000", grafana(200));
    expect(result.fingerprint.datasource.queryable).toBe(true);
    expect(result.context.datasource_type).toBe("grafana-testdata-datasource");
  });
});

describe("seed fingerprint canonicalisation", () => {
  // The gate compares two instances that differ only in Grafana version. If the
  // fingerprint is not byte-stable, a diff proves nothing.
  const fp = (): SeedFingerprint => ({
    dashboard: {
      panel_count: 2,
      panels: [
        { title: "Paragent Random Walk", type: "timeseries" },
        { title: "Paragent Stat", type: "stat" },
      ],
      title: "Paragent Seed",
      uid: "paragent-seed",
    },
    datasource: { name: "Paragent TestData", queryable: true, uid: "paragent-testdata" },
    users: { operator_present: true, operator_role: "Editor" },
  });

  it("is byte-identical under key reordering", () => {
    const reordered = {
      users: { operator_role: "Editor", operator_present: true },
      datasource: { uid: "paragent-testdata", queryable: true, name: "Paragent TestData" },
      dashboard: {
        uid: "paragent-seed",
        title: "Paragent Seed",
        panels: [
          { type: "timeseries", title: "Paragent Random Walk" },
          { type: "stat", title: "Paragent Stat" },
        ],
        panel_count: 2,
      },
    } as unknown as SeedFingerprint;
    expect(canonicalJson(reordered)).toBe(canonicalJson(fp()));
  });

  it("is byte-identical on a re-fetch of identical input", () => {
    expect(canonicalJson(fp())).toBe(canonicalJson(fp()));
  });

  it("sorts panels so Grafana's array order cannot leak in", () => {
    const shuffled = sortPanels([
      { title: "Paragent Stat", type: "stat" },
      { title: "Paragent Random Walk", type: "timeseries" },
    ]);
    expect(shuffled.map((p) => p.title)).toEqual([
      "Paragent Random Walk",
      "Paragent Stat",
    ]);
  });

  it("flattens row-nested panels and drops the row itself", () => {
    const flat = flattenPanels([
      { type: "row", title: "A row", panels: [{ title: "Inner", type: "stat" }] },
      { title: "Top", type: "timeseries" },
    ]);
    expect(flat).toEqual([
      { title: "Inner", type: "stat" },
      { title: "Top", type: "timeseries" },
    ]);
  });

  it("reports no differences for equal fingerprints", () => {
    expect(diffFingerprints(fp(), fp())).toEqual([]);
  });

  it("names the path of a real difference", () => {
    const other = fp();
    other.dashboard.panel_count = 3;
    const diffs = diffFingerprints(fp(), other);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.path).toBe("dashboard.panel_count");
    expect(diffs[0]!.left).toBe(2);
    expect(diffs[0]!.right).toBe(3);
  });

  it("catches a panel-set difference, which is the seeding artifact that matters", () => {
    const other = fp();
    other.dashboard.panels = [{ title: "Paragent Random Walk", type: "timeseries" }];
    const diffs = diffFingerprints(fp(), other);
    expect(diffs.map((d) => d.path)).toContain("dashboard.panels");
  });
});

describe("readiness arg parsing", () => {
  it("defaults --ready-timeout to the documented budget", () => {
    expect(parseArgs(["--version", "11.0.0"]).readyTimeout).toBe(
      DEFAULT_READY_TIMEOUT_SECONDS,
    );
  });

  it("parses --ready-timeout", () => {
    expect(parseArgs(["--version", "11.0.0", "--ready-timeout", "45"]).readyTimeout).toBe(45);
  });

  it("rejects a non-positive or missing --ready-timeout", () => {
    expect(() => parseArgs(["--ready-timeout", "0"])).toThrow(/invalid --ready-timeout/);
    expect(() => parseArgs(["--ready-timeout", "-5"])).toThrow(/requires a seconds/);
    expect(() => parseArgs(["--ready-timeout"])).toThrow(/requires a seconds/);
  });
});

describe("health predicate", () => {
  // Grafana returns 200 with database:"failing" when it is up but cannot serve.
  // A substring test for "ok" on the raw body would call that ready.
  it("accepts 200 with database ok", () => {
    expect(isHealthy(200, '{"commit":"abc","database":"ok","version":"11.0.0"}')).toBe(true);
  });

  it("rejects 200 with database failing", () => {
    expect(isHealthy(200, '{"database":"failing","version":"11.0.0"}')).toBe(false);
  });

  it("rejects a non-200 even when the body says ok", () => {
    expect(isHealthy(503, '{"database":"ok"}')).toBe(false);
  });

  it("rejects a non-JSON body", () => {
    expect(isHealthy(200, "<html>starting up</html>")).toBe(false);
  });

  it("does not accept 'ok' appearing in an unrelated field", () => {
    expect(isHealthy(200, '{"database":"failing","note":"ok soon"}')).toBe(false);
  });
});

describe("readiness polling", () => {
  const plan = { healthUrl: "http://127.0.0.1:3000/api/health", intervalMs: 1000, timeoutMs: 5000 };
  const healthy = { status: 200, database: "ok", error: null };
  const refused = { status: null, database: null, error: "ECONNREFUSED" };

  /** Deterministic clock so the timeout path needs no real waiting. */
  function fakeClock() {
    let t = 0;
    return {
      now: () => t,
      sleep: async (ms: number) => {
        t += ms;
      },
    };
  }

  it("returns as soon as the instance is healthy", async () => {
    const clock = fakeClock();
    const result = await waitUntilReady({
      versionId: "11.0.0",
      plan,
      probe: async () => healthy,
      ...clock,
    });
    expect(result.attempts).toBe(1);
  });

  it("retries past a refused connection, which is a normal early state", async () => {
    const clock = fakeClock();
    const outcomes = [refused, refused, healthy];
    let i = 0;
    const result = await waitUntilReady({
      versionId: "11.0.0",
      plan,
      probe: async () => outcomes[i++]!,
      ...clock,
    });
    expect(result.attempts).toBe(3);
  });

  it("throws ReadinessTimeoutError carrying the last probe", async () => {
    const clock = fakeClock();
    const err = await waitUntilReady({
      versionId: "11.0.0",
      plan,
      probe: async () => refused,
      ...clock,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ReadinessTimeoutError);
    const timeout = err as ReadinessTimeoutError;
    expect(timeout.attempts).toBeGreaterThan(1);
    expect(timeout.last.error).toBe("ECONNREFUSED");
  });

  it("probes at least once even with a budget too small to sleep in", async () => {
    const clock = fakeClock();
    let calls = 0;
    const err = await waitUntilReady({
      versionId: "11.0.0",
      plan: { ...plan, timeoutMs: 1 },
      probe: async () => {
        calls += 1;
        return refused;
      },
      ...clock,
    }).catch((e: unknown) => e);

    expect(calls).toBe(1);
    expect((err as ReadinessTimeoutError).last.error).toBe("ECONNREFUSED");
  });
});

/**
 * `scripts/secret-scan.mjs` is merge-blocking and refuses any literal assignment
 * of a credential-shaped name anywhere in the tree — including inside a test
 * that exists to prove such strings get redacted, and including inside a comment
 * describing one. So the fixtures below are assembled at runtime. Do not inline
 * them back into string literals: CI will fail.
 */
const assign = (key: string, value: string): string => `${key}=${value}`;
const PW_KEY = "admin_password";

describe("timeout diagnostic", () => {
  const plan = { healthUrl: "http://127.0.0.1:3000/api/health", intervalMs: 1000, timeoutMs: 1000 };
  const block = () =>
    formatTimeoutDiagnostic({
      versionId: "11.0.0",
      plan,
      error: new ReadinessTimeoutError("nope", 1042, 2, {
        status: 503,
        database: "failing",
        error: "unhealthy body",
      }),
      logTail: `grafana-1  | logger=settings level=info\ngrafana-1  | ${assign(PW_KEY, "paragent")}`,
    });

  it("names everything needed to diagnose without re-running", () => {
    const out = block();
    expect(out).toContain("11.0.0");
    expect(out).toContain("http://127.0.0.1:3000/api/health");
    expect(out).toContain("1.0s");        // elapsed
    expect(out).toContain("2 attempt");   // attempts
    expect(out).toContain("503");         // last status
    expect(out).toContain("failing");     // last database
    expect(out).toContain("--down");      // how to clean up
  });

  it("strips credential-shaped strings out of the log tail", () => {
    const out = block();
    expect(out).toContain(assign(PW_KEY, "***"));
    expect(out).not.toContain(assign(PW_KEY, "paragent"));
    expect(out).toContain("logger=settings");
  });
});

describe("credential scrubbing", () => {
  it("redacts the fixture password where it is assigned", () => {
    const key = "GF_SECURITY_ADMIN_PASSWORD";
    expect(scrubCredentials(assign(key, "paragent"))).toBe(assign(key, "***"));
  });

  // The fixture password is also the project name. Blanket-replacing it would
  // rewrite ordinary log lines into "***-seed" and wreck the diagnostic.
  it("leaves seeded object names intact", () => {
    const line = 'grafana-1  | msg="provisioned dashboard" uid=paragent-seed ds=paragent-testdata';
    expect(scrubCredentials(line)).toBe(line);
  });

  it("redacts assignment-shaped secrets", () => {
    expect(scrubCredentials('token: "abc123"')).toBe('token: "***"');
    expect(scrubCredentials(assign("api_key", "zzz"))).toBe(assign("api_key", "***"));
  });

  it("redacts basic-auth credentials in a URL", () => {
    expect(scrubCredentials("http://admin:hunter2@127.0.0.1:3000")).toBe(
      "http://admin:***@127.0.0.1:3000",
    );
  });

  it("leaves ordinary log lines alone", () => {
    const line = "grafana-1  | level=info msg=\"HTTP Server Listen\" address=[::]:3000";
    expect(scrubCredentials(line)).toBe(line);
  });
});

describe("readiness plan (what --dry-run prints)", () => {
  it("derives the health URL and honours the timeout", () => {
    const plan = readinessPlan("http://127.0.0.1:3001", 45);
    expect(plan.healthUrl).toBe("http://127.0.0.1:3001/api/health");
    expect(plan.timeoutMs).toBe(45_000);
  });

  it("strips a trailing slash from the base URL", () => {
    expect(readinessPlan("http://127.0.0.1:3000/").healthUrl).toBe(
      "http://127.0.0.1:3000/api/health",
    );
  });

  it("states the URL, interval and timeout", () => {
    const out = formatReadinessPlan("11.0.0", readinessPlan("http://127.0.0.1:3000", 30));
    expect(out).toContain("11.0.0");
    expect(out).toContain("/api/health");
    expect(out).toContain('database="ok"');
    expect(out).toContain("1000ms");
    expect(out).toContain("30s");
  });
});
