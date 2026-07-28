/**
 * CLI: record gate task (login → dashboards list) against fixture or live URL.
 * Credentials via env only — never written to trajectory.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
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

function help(): never {
  console.log(`paragent recorder (B2)

Record gate task: login + navigate to dashboards list.

Usage:
  npm run recorder -- --fixture [--out <path>]
  npm run recorder -- --base-url http://127.0.0.1:3000 [--out <path>]

Env (never persisted): PARAGENT_USERNAME, PARAGENT_USER_SECRET (or PARAGENT_PASS)`);
  process.exit(0);
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
        : "grafana-login-dashboards.json",
    );

  const fixturePath = path.join(__dirname, "fixtures/grafana-gate-login.html");
  const site_key =
    (args["site-key"] as string | undefined) ??
    (useFixture ? "grafana-oss@fixture" : "grafana-oss@pending-adr0003");
  const task_key =
    (args["task-key"] as string | undefined) ?? "login-open-dashboards-list";
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
      const recorder = new TrajectoryRecorder(page, {
        trajectory_id: "traj-gate-live-login-dashboards",
        site_key,
        task_key,
        base_url_template: "http://{host}:{port}",
        provenance: {
          recorder: RECORDER_VERSION,
          agent_model: "human",
          testbed_version: "pending-adr0003",
          notes:
            "Live capture against working-assumption Grafana OSS. Credentials from env only — never in artifact.",
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
      // Measured steps start AFTER this line. Login is scaffolding, not the
      // measurement — see src/recorder/preamble.ts. Nothing above touches the
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

      await recorder.navigate(
        "http://{host}:{port}/dashboards",
        "Open Dashboards list page",
        ["host", "port"],
      );
      await mkdir(path.dirname(outPath), { recursive: true });
      await recorder.write(outPath);
      console.log(`wrote ${path.relative(ROOT, outPath)}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
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
