/**
 * SC-02 — the `toTrajectory()` bypass, and trajectory discovery (#99).
 *
 * `TrajectoryRecorder.write()` calls `assertNoLiteralSecrets()` on the
 * serialized trajectory before it touches disk. But that guard lives on
 * `write()`, and `toTrajectory()` — the method that actually *builds* the
 * object — has no equivalent. A caller that serializes `toTrajectory()`'s output
 * itself gets no guard at all.
 *
 * Nothing in the tree does that today, and nothing stops a future caller either.
 * So rather than assert the guard runs, these assert the **property the guard
 * exists to protect** holds of the object itself: the recorder does not put
 * session material in a trajectory in the first place, whichever method
 * serializes it.
 *
 * That distinction matters. If someone later routes around `write()`, this fails
 * only if the recorder actually started leaking — which is the thing worth
 * knowing, and is not what a test of `write()` would tell you.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  assertNoLiteralSecrets,
  TrajectoryRecorder,
} from "../../src/recorder/index.js";

// @ts-expect-error -- plain .mjs script, no type declarations
import { discoverTrajectories } from "../../scripts/validate-contracts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const discover = discoverTrajectories as (root?: string) => Promise<string[]>;

const PAGE = `<!doctype html><html><head><title>Login</title></head><body>
  <main>
    <form>
      <label for="u">Username</label><input id="u" name="user" />
      <label for="p">Password</label><input id="p" name="password" type="password" />
      <button type="submit" data-testid="login-button">Log in</button>
    </form>
  </main></body></html>`;

/** Test-only. The recorder is supposed to lift these into parameter slots. */
const TYPED = {
  username: "bypass-user-never-persist",
  password: "bypass-" + "secret-never-persist",
};

describe("SC-02: toTrajectory() carries no session material (#99)", () => {
  let browser: Browser;
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(PAGE);
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    port = (server.address() as AddressInfo).port;
    browser = await chromium.launch({ headless: true });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((r) => server?.close(() => r()));
  });

  /** Record a small login-shaped task and return the built object. */
  async function record() {
    const page = await browser.newPage();
    try {
      const recorder = new TrajectoryRecorder(page, {
        trajectory_id: "traj-bypass-check",
        site_key: "fixture@local",
        task_key: "login",
        base_url_template: "http://{host}:{port}/",
        provenance: {
          recorder: "test",
          agent_model: "human",
          testbed_version: "fixture-v1",
        },
        parameters: {
          host: "string",
          port: "integer",
          username: "string",
          password: "secret_ref",
        },
        bindings: { host: "127.0.0.1", port },
      });
      await recorder.navigate("http://{host}:{port}/", "Open login", ["host", "port"]);
      await recorder.fill(page.getByLabel("Username"), "username", TYPED.username, "Fill user");
      await recorder.fill(page.getByLabel("Password"), "password", TYPED.password, "Fill secret");
      await recorder.click(page.getByTestId("login-button"), "Submit");
      // Deliberately NOT write(): this is the path with no guard on it.
      return recorder.toTrajectory();
    } finally {
      await page.close();
    }
  }

  it(
    "the object built by toTrajectory() passes the write() guard unchanged",
    async () => {
      const traj = await record();
      // The same call write() makes, on the object write() never saw.
      expect(() =>
        assertNoLiteralSecrets(`${JSON.stringify(traj, null, 2)}\n`),
      ).not.toThrow();
    },
    120_000,
  );

  it(
    "no typed value survives into the built object",
    async () => {
      const text = JSON.stringify(await record());
      expect(text).not.toContain(TYPED.username);
      expect(text).not.toContain(TYPED.password);
      // The slots are declared; only the values are absent.
      expect(text).toContain('"password":"secret_ref"');
    },
    120_000,
  );

  it(
    "compact serialization is covered too, not just the pretty-printed shape",
    async () => {
      // write() pretty-prints. A bypassing caller very likely will not, and
      // `"cookies"\s*:` matches differently across the two.
      const traj = await record();
      expect(() => assertNoLiteralSecrets(JSON.stringify(traj))).not.toThrow();
    },
    120_000,
  );

  // Guards the guard, per pattern.
  //
  // The assertions above are all "does NOT throw", so weakening the guard makes
  // them *more* likely to pass — they cannot detect it. Removing a single
  // pattern must therefore be caught here instead. Verified by deleting the
  // `"value"` entry from assertNoLiteralSecrets: with only a cookie-shaped
  // case, all eight tests still passed.
  const mustBeCaught: Array<[string, string]> = [
    ["typed password", '{"password":"an-actual-password"}'],
    ["typed value", '{"value":"an-actual-value"}'],
    ["response header", '{"h":"Set-' + 'Cookie: a=b"}'],
    ["cookie array", '{"cookies":[{"name":"s"}]}'],
    ["localStorage", '{"localStorage":[]}'],
    ["sessionStorage", '{"sessionStorage":[]}'],
  ];

  it.each(mustBeCaught)("the guard still catches %s", (_label, body) => {
    expect(() => assertNoLiteralSecrets(body)).toThrow(/redaction failed/i);
  });

  it("does not fire on a parameter type map, which is not a typed value", () => {
    // The distinction the first pattern is written for: `"password":
    // "secret_ref"` declares a slot; `"password": "hunter2"` fills one.
    expect(() =>
      assertNoLiteralSecrets('{"parameters":{"password":"secret_ref"}}'),
    ).not.toThrow();
  });
});

describe("trajectory discovery replaces the hand-maintained list (#99)", () => {
  it("finds the recordings that were previously listed by hand", async () => {
    const found = await discover(ROOT);
    expect(found).toContain(
      "experiments/gate-v1/trajectories/grafana-fixture-login-dashboards.json",
    );
    expect(found).toContain(
      "experiments/gate-v1/trajectories/grafana-create-stat-dashboard-from-testdata-9.5.21.json",
    );
  });

  it("returns repo-relative, forward-slash, sorted paths", async () => {
    const found = await discover(ROOT);
    expect(found).toEqual([...found].sort());
    for (const rel of found) {
      expect(path.isAbsolute(rel)).toBe(false);
      expect(rel).not.toContain("\\");
      expect(rel.endsWith(".json")).toBe(true);
    }
  });

  it("finds every .json under a trajectories/ directory, so a new recording is covered by default", async () => {
    const found = await discover(ROOT);
    // The point of #99: the count is whatever is on disk, not whatever someone
    // remembered to add. If a recording lands and this does not grow, discovery
    // is broken.
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  it("returns empty rather than throwing when the root has no recordings", async () => {
    // The CLI turns empty into a hard failure; the function itself stays honest
    // and just reports what it found.
    await expect(discover(path.join(ROOT, "contracts"))).resolves.toEqual([]);
  });

  it("does not sweep in every JSON under experiments/", async () => {
    // Shape-based, not "everything that is a file". The compiled-program
    // fixture carries `steps` but has `program_id`, not `trajectory_id`, and it
    // is not a trajectory.
    const found = await discover(ROOT);
    expect(found).not.toContain("experiments/gate-v1/fixtures/compiled-program.json");
  });
});

/**
 * #116 — a recording is checked because of what it *is*, not where it sits.
 *
 * #110 replaced a hand-maintained list with a hand-maintained location
 * convention. `src/recorder/cli.ts` takes `--out` to an arbitrary path, so a
 * recording landing outside `experiments/**\/trajectories/` was committable and
 * permanently unvalidated — including against `additionalProperties: false`,
 * which is what makes an accidental `cookies` field unrepresentable.
 *
 * These run against a scratch root rather than the repo so they cannot depend
 * on, or perturb, what is actually committed.
 */
describe("trajectory discovery is shape-based (#116)", () => {
  const scratch: string[] = [];

  function trajectoryDoc(id: string): string {
    return JSON.stringify({
      schema_version: "1.0.0",
      trajectory_id: id,
      site_key: "fixture@local",
      task_key: "login",
      recorded_at: "2026-08-10T00:00:00.000Z",
      base_url_template: "http://{host}:{port}/",
      provenance: { recorder: "test", agent_model: "human", testbed_version: "fixture-v1" },
      parameters: { host: "string", port: "integer" },
      steps: [],
    });
  }

  async function root(files: Record<string, string>): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "paragent-discover-"));
    scratch.push(dir);
    for (const [rel, body] of Object.entries(files)) {
      const full = path.join(dir, rel);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body, "utf8");
    }
    return dir;
  }

  afterAll(async () => {
    for (const dir of scratch) await rm(dir, { recursive: true, force: true });
  });

  it("finds a recording in a plausible sibling directory", async () => {
    const dir = await root({
      "experiments/gate-v2/recordings/leaky.json": trajectoryDoc("traj-leaky"),
    });
    await expect(discover(dir)).resolves.toEqual([
      "experiments/gate-v2/recordings/leaky.json",
    ]);
  });

  it("finds a recording written straight to the experiments root by --out", async () => {
    const dir = await root({ "experiments/adhoc.json": trajectoryDoc("traj-adhoc") });
    await expect(discover(dir)).resolves.toEqual(["experiments/adhoc.json"]);
  });

  it("finds a document that names the schema even without the identifying fields", async () => {
    const dir = await root({
      "experiments/notes/partial.json": JSON.stringify({
        $schema: "https://paragent.dev/contracts/trajectory.schema.json",
        trajectory_id: 42,
      }),
    });
    await expect(discover(dir)).resolves.toEqual(["experiments/notes/partial.json"]);
  });

  it("ignores JSON under experiments/ that is not a recording", async () => {
    const dir = await root({
      "experiments/gate-v1/fixtures/compiled-program.json": JSON.stringify({
        program_id: "prog-x",
        steps: [],
      }),
      "experiments/gate-v1/config.json": JSON.stringify({ versions: ["9.5.21"] }),
      "experiments/gate-v1/rows.json": JSON.stringify([{ metric_kind: "step" }]),
    });
    await expect(discover(dir)).resolves.toEqual([]);
  });

  it("still collects a malformed file in the canonical directory, so it fails loudly", async () => {
    // The location rule is not redundant. A recording missing `trajectory_id`
    // fails the shape test *because* it is broken; dropping it would turn
    // "invalid" into "absent", which is the failure mode being closed.
    const dir = await root({
      "experiments/gate-v1/trajectories/missing-id.json": JSON.stringify({ steps: [] }),
      "experiments/gate-v1/trajectories/truncated.json": '{"trajectory_id": "traj-x", "ste',
    });
    await expect(discover(dir)).resolves.toEqual([
      "experiments/gate-v1/trajectories/missing-id.json",
      "experiments/gate-v1/trajectories/truncated.json",
    ]);
  });

  it("does not collect a broken file outside the canonical directory twice over", async () => {
    // Counter-check on the rule above: the leniency is scoped to the canonical
    // directory, or every unparseable JSON in the tree would be reported as a
    // failed trajectory.
    const dir = await root({ "experiments/scratch/notes.json": "{ not json" });
    await expect(discover(dir)).resolves.toEqual([]);
  });
});
