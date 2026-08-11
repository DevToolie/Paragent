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

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser } from "playwright";
import { launchTestBrowser } from "../helpers/browser.js";
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
    browser = await launchTestBrowser();
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

  it("skips the JSON under experiments/ that is not a recording", async () => {
    // A compiled program has `steps` but no `trajectory_id`. Validating it
    // against trajectory.schema.json would fail for the wrong reason.
    const found = await discover(ROOT);
    expect(found).not.toContain("experiments/gate-v1/fixtures/compiled-program.json");
  });
});

/**
 * #116 — discovery is by shape, not by directory name.
 *
 * The location rule swapped a hand-maintained *list* for a hand-maintained
 * *convention*: a recording written anywhere else was silently skipped, and
 * `src/recorder/cli.ts` takes `--out` to an arbitrary path. These build small
 * synthetic trees rather than committing fixtures, so the repo's own two
 * recordings stay the only trajectories in the tree.
 */
describe("trajectory discovery is shape-based (#116)", () => {
  const roots: string[] = [];

  function tree(files: Record<string, string>): string {
    const root = mkdtempSync(path.join(tmpdir(), "paragent-discover-"));
    roots.push(root);
    for (const [rel, body] of Object.entries(files)) {
      const full = path.join(root, rel);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, body, "utf8");
    }
    return root;
  }

  const trajectory = (id: string) =>
    JSON.stringify({
      schema_version: "1.0.0",
      trajectory_id: id,
      site_key: "fixture@local",
      task_key: "login",
      steps: [],
    });

  afterAll(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  });

  it("finds a recording in a sibling directory nobody named 'trajectories'", async () => {
    // The exact repro from #116: a plausible directory name, not gitignored, so
    // it is committable and would sit in the tree permanently unvalidated.
    const root = tree({
      "experiments/gate-v2/recordings/leaky.json": trajectory("traj-leaky"),
    });
    await expect(discover(root)).resolves.toEqual([
      "experiments/gate-v2/recordings/leaky.json",
    ]);
  });

  it("finds one dropped straight into experiments/, with no directory at all", async () => {
    const root = tree({ "experiments/adhoc.json": trajectory("traj-adhoc") });
    await expect(discover(root)).resolves.toEqual(["experiments/adhoc.json"]);
  });

  it("takes a document that declares the trajectory schema at its word", async () => {
    // Missing the required fields entirely. That is precisely the file
    // validation should be shouting about, so discovery must not skip it for
    // failing the shape test.
    const root = tree({
      "experiments/decl/claims-to-be-one.json": JSON.stringify({
        $schema: "https://paragent.dev/contracts/trajectory.schema.json",
      }),
    });
    await expect(discover(root)).resolves.toEqual([
      "experiments/decl/claims-to-be-one.json",
    ]);
  });

  it("ignores JSON under experiments/ that is not trajectory-shaped", async () => {
    const root = tree({
      // A compiled program: steps, but no trajectory_id.
      "experiments/gate-v1/fixtures/program.json": JSON.stringify({
        program_id: "prog-1",
        steps: [],
      }),
      // A compiled bundle: source_trajectory_id and rows.
      "experiments/gate-v1/fixtures/bundle.json": JSON.stringify({
        bundle_kind: "compiled",
        source_trajectory_id: "traj-1",
        rows: [],
      }),
      "experiments/gate-v1/fixtures/config.json": JSON.stringify({ headless: true }),
      "experiments/notes.txt": "not json at all",
      // Keeps the walk from returning empty for an unrelated reason.
      "experiments/gate-v1/trajectories/real.json": trajectory("traj-real"),
    });
    await expect(discover(root)).resolves.toEqual([
      "experiments/gate-v1/trajectories/real.json",
    ]);
  });

  it("still includes anything in a trajectories/ directory, whatever its shape", async () => {
    // The second, stricter rule. A file in the canonical location that does not
    // parse must fail loudly in the validator, not vanish from discovery.
    const root = tree({
      "experiments/gate-v1/trajectories/truncated.json": '{"trajectory_id": "traj-x"',
      "experiments/gate-v1/trajectories/wrong-shape.json": JSON.stringify({ hello: 1 }),
    });
    await expect(discover(root)).resolves.toEqual([
      "experiments/gate-v1/trajectories/truncated.json",
      "experiments/gate-v1/trajectories/wrong-shape.json",
    ]);
  });

  it("does not look inside skipped directories — the interaction is deliberate", async () => {
    // `out` is in SKIP_DIRS and is gitignored (.gitignore:58), so a recording
    // there cannot enter the tree. Pinned because the skip list and the
    // discovery rule interact in a way neither states on its own.
    const root = tree({
      "experiments/gate-v1/out/trajectories/generated.json": trajectory("traj-out"),
      "experiments/gate-v1/trajectories/real.json": trajectory("traj-real"),
    });
    await expect(discover(root)).resolves.toEqual([
      "experiments/gate-v1/trajectories/real.json",
    ]);
  });
});
