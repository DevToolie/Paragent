/**
 * CLI: record a gate task against the bundled fixture or a live testbed.
 *
 *   --fixture   login → dashboards list (unchanged; the only path that runs
 *               without Docker, and tests/unit/recorder.test.ts depends on it)
 *   --base-url  the ADR-0006 gate task: build a Stat panel over the seeded
 *               TestData datasource and save it as a named dashboard
 *
 * Credentials via env only — never written to a trajectory.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { establishSession, LoginFailedError } from "./preamble.js";
import { RECORDER_VERSION, TrajectoryRecorder } from "./session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--fixture") out.fixture = true;
    else if (a === "--headed") out.headed = true;
    else if (a.startsWith("--") && i + 1 < argv.length) out[a.slice(2)] = argv[++i]!;
  }
  return out;
}

/** ADR-0006. The live path records this task; the fixture path is unchanged. */
const TASK_KEY = "create-stat-dashboard-from-testdata";

/** The base version the task was walked and recorded against (ADR-0006). */
const RECORDED_AGAINST = "9.5.21";

function help(): never {
  console.log(`paragent recorder (B2)

  --fixture    login → dashboards list against the bundled HTML fixture
  --base-url   the ADR-0006 gate task (12 steps) against a seeded testbed

Usage:
  npm run recorder -- --fixture [--out <path>]
  npm run recorder -- --base-url http://127.0.0.1:3000 [--headed] [--out <path>]

Typed values become parameter slots; override them for a repeat run:
  --series-alias <s>  --series-count <n>  --panel-title <s>  --dashboard-title <s>

The live task is recorded against the matrix base version (${RECORDED_AGAINST}). Later
versions are what the gate replays it on — running the recorder against them is
expected to fail on a moved control, and that failure is the measurement, not a bug.

Env (never persisted): PARAGENT_USERNAME, PARAGENT_USER_SECRET (or PARAGENT_PASS)`);
  process.exit(0);
}

/** Read the version off the instance. A hand-typed tag is a claim, not a fact. */
async function grafanaVersion(page: Page): Promise<string> {
  const raw = await page.evaluate(`fetch('/api/health')
    .then((r) => r.json())
    .then((b) => (b && b.version) || '')
    .catch(() => '')`);
  const version = String(raw ?? "").trim();
  if (!version) {
    throw new Error(
      "could not read the Grafana version from /api/health — refusing to write a " +
        "trajectory whose provenance.testbed_version would be a guess. Pass " +
        "--testbed-version to override deliberately.",
    );
  }
  return version;
}

interface TaskValues {
  series_alias: string;
  series_count: string;
  panel_title: string;
  dashboard_title: string;
}

/**
 * The ADR-0006 gate task, in the order the ADR defines it.
 *
 * Locators are the ones that resolve on ${RECORDED_AGAINST} — deliberately not a
 * version-tolerant chain. Being robust here would launder churn out of the
 * measurement: the recorded trajectory is supposed to break on later versions
 * where the control moved, and the runner's repair loop is what gets measured
 * for putting it back. Version tolerance belongs in the preamble, and nowhere
 * else (see src/recorder/preamble.ts).
 */
async function recordGateTask(
  recorder: TrajectoryRecorder,
  page: Page,
  values: TaskValues,
): Promise<void> {
  const step = async (n: number, intent: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (err) {
      throw new StepNotRecordableError(n, intent, errText(err));
    }
  };

  await step(1, "Open the new-dashboard page", () =>
    recorder.navigate("http://{host}:{port}/dashboard/new", "Open the new-dashboard page", [
      "host",
      "port",
    ]),
  );

  await step(2, "Add a visualization to the empty dashboard", () =>
    // aria-label wins over the visible "Add visualization" text, exactly like
    // the login button in preamble.ts. Naming it by text finds nothing.
    recorder.click(
      page.locator('[aria-label="Add new panel"]'),
      "Add a visualization to the empty dashboard",
    ),
  );

  await step(3, "Open the visualization picker", () =>
    recorder.click(
      page.locator('[aria-label="toggle-viz-picker"]'),
      "Open the visualization picker",
    ),
  );

  await step(4, "Choose the Stat visualization", () =>
    recorder.click(
      page.locator('[aria-label="Plugin visualization item Stat"]'),
      "Choose the Stat visualization",
    ),
  );

  await step(5, "Name the query series", () =>
    recorder.fill(
      page.locator('input[name="alias"]'),
      "series_alias",
      values.series_alias,
      "Name the query series",
    ),
  );

  await step(6, "Set how many series the query returns", () =>
    recorder.fill(
      page.locator('input[name="seriesCount"]'),
      "series_count",
      values.series_count,
      "Set how many series the query returns",
    ),
  );

  await step(7, "Title the panel", () =>
    // No name, no data-testid, no aria-label on this input on 9.5.21 — the
    // whole field is addressed through its options group. ADR-0006 flags this
    // as the step most likely to produce phantom churn.
    recorder.fill(
      page.locator('[aria-label="Options group Panel options"] input').first(),
      "panel_title",
      values.panel_title,
      "Title the panel",
    ),
  );

  await step(8, "Apply the panel and return to the dashboard", () =>
    recorder.click(
      page.locator('[data-testid="data-testid Apply changes and go back to dashboard"]'),
      "Apply the panel and return to the dashboard",
    ),
  );

  await step(9, "Open the save-dashboard drawer", () =>
    recorder.click(
      page.locator('[aria-label="Save dashboard"]'),
      "Open the save-dashboard drawer",
    ),
  );

  await step(10, "Title the dashboard", () =>
    recorder.fill(
      page.locator('input[name="title"]'),
      "dashboard_title",
      values.dashboard_title,
      "Title the dashboard",
    ),
  );

  await step(11, "Save the dashboard", () =>
    recorder.click(
      page.locator('[aria-label="Save dashboard button"]'),
      "Save the dashboard",
    ),
  );

  // The save assigned a uid and a slug, and Grafana puts both in the URL. They
  // are not typed values, but they ARE run-specific: left as literals they make
  // two recordings of the same task differ, and make any URL assertion match
  // exactly one run. Binding them turns `/d/<uid>/<slug>` into
  // `/d/{dashboard_uid}/{dashboard_slug}`, which the runner's template matcher
  // treats as a hole — "we landed on that dashboard", not "on that one run".
  const saved = /\/d\/([^/]+)\/([^/?#]+)/.exec(page.url());
  if (saved) {
    recorder.declareParam("dashboard_uid", "string", saved[1]);
    recorder.declareParam("dashboard_slug", "string", saved[2]);
  } else {
    throw new StepNotRecordableError(
      11,
      "Save the dashboard",
      `after saving, the URL was ${page.url()} — expected /d/<uid>/<slug>. ` +
        "Refusing to write a trajectory that would carry an unexplained URL.",
    );
  }

  await step(12, "Return to the dashboards list", () =>
    recorder.click(
      page.locator('[data-testid="data-testid Dashboards breadcrumb"]'),
      "Return to the dashboards list",
    ),
  );
}

/**
 * A step that could not be performed at all. Named so it can never be confused
 * with a recorded step that failed its assertion — nothing is written, because
 * a hand-patched trajectory would invalidate the gate (issue #24).
 */
class StepNotRecordableError extends Error {
  constructor(
    readonly stepNumber: number,
    readonly intent: string,
    detail: string,
  ) {
    super(
      `step ${stepNumber} (${intent}) could not be performed: ${detail}\n` +
        `The ADR-0006 task is recorded against matrix base version ${RECORDED_AGAINST}; ` +
        "on a later version a moved control is expected. Nothing was written.",
    );
    this.name = "StepNotRecordableError";
  }
}

function errText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.split("\n")[0] ?? msg;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.fixture && !args["base-url"])) help();

  const useFixture = Boolean(args.fixture);
  const outPath =
    (args.out as string | undefined) ??
    path.join(
      ROOT,
      "experiments/gate-v1/trajectories",
      useFixture
        ? "grafana-fixture-login-dashboards.json"
        : `grafana-${TASK_KEY}-${RECORDED_AGAINST}.json`,
    );

  const fixturePath = path.join(__dirname, "fixtures/grafana-gate-login.html");
  const site_key =
    (args["site-key"] as string | undefined) ??
    (useFixture ? "grafana-oss@fixture" : "grafana-oss@pending-adr0003");
  const task_key =
    (args["task-key"] as string | undefined) ??
    (useFixture ? "login-open-dashboards-list" : TASK_KEY);
  const values: TaskValues = {
    series_alias: (args["series-alias"] as string | undefined) ?? "paragent_series",
    series_count: (args["series-count"] as string | undefined) ?? "3",
    panel_title: (args["panel-title"] as string | undefined) ?? "Paragent Gate Panel",
    dashboard_title:
      (args["dashboard-title"] as string | undefined) ?? "Paragent Gate Dashboard",
  };
  const username = process.env.PARAGENT_USERNAME ?? "admin";
  const userPass =
    process.env.PARAGENT_USER_SECRET ?? process.env.PARAGENT_PASS ?? "admin";

  const browser = await chromium.launch({ headless: !args.headed });
  const page = await browser.newPage();

  try {
    if (useFixture) {
      const recorder = new TrajectoryRecorder(page, {
        trajectory_id: "traj-gate-fixture-login-dashboards",
        site_key,
        task_key,
        base_url_template: "file://{fixture_root}/grafana-gate-login.html",
        provenance: {
          recorder: RECORDER_VERSION,
          agent_model: "human",
          testbed_version: "fixture-v1",
          notes:
            "Recorded against bundled HTML fixture approximating Grafana login→dashboards. ADR-0003 pending; site_key provisional. No real credentials.",
        },
        parameters: {
          fixture_root: "string",
          username: "string",
          password: "secret_ref",
        },
        bindings: { fixture_root: path.dirname(fixturePath).replace(/\\/g, "/") },
      });
      await recorder.navigate(
        "file://{fixture_root}/grafana-gate-login.html",
        "Open the login page",
        ["fixture_root"],
      );
      await recorder.fill(page.getByLabel("Username"), "username", username, "Fill username field");
      await recorder.fill(page.getByLabel("Password"), "password", userPass, "Fill username secret field");
      await recorder.click(page.getByRole("button", { name: "Log in" }), "Submit login form");
      await recorder.click(page.getByTestId("nav-dashboards"), "Navigate to Dashboards list");
      // Self-hiding, non-navigating control — exercises ADR-0007
      // post_action_target_visible=false so the committed fixture trajectory
      // demonstrates the case that has no URL change to fall back on.
      await recorder.click(
        page.getByTestId("dismiss-notice"),
        "Dismiss the preview notice",
      );
      await mkdir(path.dirname(outPath), { recursive: true });
      await recorder.write(outPath);
      console.log(`wrote ${path.relative(ROOT, outPath)}`);
    } else {
      const baseUrl = String(args["base-url"]).replace(/\/$/, "");
      let host = "127.0.0.1";
      let port = 3000;
      try {
        const u = new URL(baseUrl);
        host = u.hostname;
        port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
      } catch {
        console.error(`Invalid --base-url: ${baseUrl}`);
        process.exit(2);
      }
      // Measured steps start AFTER this block. Login is scaffolding, not the
      // measurement — see src/recorder/preamble.ts. Nothing here touches the
      // recorder, so no preamble action reaches trajectory.steps or a
      // step-validity denominator.
      const session = await establishSession(page, {
        baseUrl,
        username,
        password: userPass,
      });
      console.log(
        `preamble: session established as ${session.user_login} ` +
          `(landed ${session.landed_url}` +
          `${session.dismissed_first_run_modal ? ", dismissed first-run dialog" : ""})`,
      );

      // The pinned tag, read off the instance rather than passed in. A
      // hand-typed version is a claim; /api/health is an observation.
      const testbedVersion =
        (args["testbed-version"] as string | undefined) ??
        (await grafanaVersion(page));
      console.log(`testbed_version: ${testbedVersion} (from /api/health)`);

      const recorder = new TrajectoryRecorder(page, {
        trajectory_id: `traj-gate-live-${TASK_KEY}-${testbedVersion}`,
        site_key: site_key.replace("@pending-adr0003", `@${host}:${port}`),
        task_key,
        base_url_template: "http://{host}:{port}",
        provenance: {
          recorder: RECORDER_VERSION,
          agent_model: "human",
          testbed_version: testbedVersion,
          notes:
            `ADR-0006 gate task recorded live against Grafana OSS ${testbedVersion} ` +
            "seeded by npm run testbed. Login and the first-run dialog are preamble, " +
            "not steps. Credentials come from env and are never written here.",
        },
        // No `username` / `password` slots: since #60 the login is a preamble
        // and no recorded step references those values, so declaring parameters
        // for them would describe holes the trajectory does not have. The
        // values were never written either way.
        parameters: {
          host: "string",
          port: "integer",
        },
        bindings: { host, port },
      });

      await recordGateTask(recorder, page, values);

      await mkdir(path.dirname(outPath), { recursive: true });
      await recorder.write(outPath);
      console.log(
        `wrote ${path.relative(ROOT, outPath)} — ${recorder.stepCount()} measured steps`,
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  // A step that could not be performed is a gap to report, never a step to
  // invent. Nothing is written — a hand-patched trajectory invalidates the gate.
  if (err instanceof StepNotRecordableError) {
    console.error(`recorder: STEP NOT RECORDABLE — ${err.message}`);
    process.exit(4);
  }
  // A login failure is a preamble failure, not a gate datum. Say so plainly so
  // it is never mistaken for step-1 churn in the recorded task.
  if (err instanceof LoginFailedError) {
    console.error(`recorder: LOGIN FAILED (stage: ${err.stage}) — ${err.message}`);
    console.error(
      "No trajectory was written. This is scaffolding failing, not a measured step.",
    );
    process.exit(3);
  }
  console.error(err);
  process.exit(1);
});
