/**
 * The bundled-fixture recording path: a loopback static server plus the task
 * the `--fixture` flag records against it.
 *
 * ## Why a server, for a file that is right there on disk (#141)
 *
 * `--fixture` used to record `file://{fixture_root}/grafana-gate-login.html`,
 * which makes `fixture_root` a **whole filesystem path**. The compiler compiles
 * a template hole to `[^/?#]+`, which deliberately cannot span `/` separators —
 * that restriction is what stops a `url-matches` assertion skipping across path
 * segments — so the compiled regex admitted exactly one segment after `file://`
 * while a real path has many. The recording compiled cleanly and then failed at
 * replay:
 *
 * ```text
 * 3 REPAIR_EXHAUSTED  url "file:///Users/…/grafana-gate-login.html#home"
 *                       !~ /^file://[^/?#]+/grafana-gate-login\.html#home$/
 * ```
 *
 * Loosening the hole pattern to fit would weaken every URL assertion the
 * product emits, to buy back one fixture. Serving over loopback instead gives
 * the fixture the same shape a real recording has —
 * `http://{host}:{port}/…`, exactly what `--base-url` produces against the
 * Grafana test-bed — so `host` and `port` are single-segment holes and the
 * assertions replay. `tests/integration/pipeline.test.ts` reached the same
 * conclusion for the same reason; the product path simply never got the
 * treatment.
 *
 * Loopback only, ephemeral port, no egress: the process that records is the
 * process that serves, and it stops the server before it exits.
 */

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import type { TrajectoryRecorder } from "./session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Directory the fixture server serves. Nothing outside it is reachable. */
export const FIXTURE_DIR = path.join(__dirname, "fixtures");

/** The one fixture page the `--fixture` task walks. */
export const FIXTURE_PAGE = "grafana-gate-login.html";

/** Bound to 127.0.0.1, never 0.0.0.0: a recording session is not a web server. */
export const FIXTURE_HOST = "127.0.0.1";

/** The URL shape the fixture recording carries. Single-segment holes only. */
export const FIXTURE_URL_TEMPLATE = `http://{host}:{port}/${FIXTURE_PAGE}`;

export interface FixtureServer {
  host: string;
  port: number;
  close: () => Promise<void>;
}

/**
 * Serve `FIXTURE_DIR` on an ephemeral loopback port.
 *
 * Only the basename of a request is honoured, so `..` cannot walk out of the
 * fixture directory — this exists to serve two static files to a browser on the
 * same machine, and anything more is out of scope for it.
 */
export async function startFixtureServer(): Promise<FixtureServer> {
  const server: Server = createServer((req, res) => {
    const name = path.basename(
      new URL(req.url ?? "/", "http://localhost").pathname,
    );
    readFile(path.join(FIXTURE_DIR, name), "utf8").then(
      (body) => {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(body);
      },
      () => {
        res.writeHead(404).end("not found");
      },
    );
  });
  await new Promise<void>((resolve) => {
    server.listen(0, FIXTURE_HOST, resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    host: FIXTURE_HOST,
    port,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

export interface FixtureTaskValues {
  username: string;
  password: string;
}

/**
 * The fixture task: login → dashboards list → dismiss the notice.
 *
 * Unchanged from what `--fixture` has always recorded; only the URL shape moved
 * (#141). Lives here rather than in `cli.ts` so a test can drive the **same**
 * flow the product does — a test that reimplements the recording proves nothing
 * about the recording the product actually writes.
 */
export async function recordFixtureTask(
  recorder: TrajectoryRecorder,
  page: Page,
  values: FixtureTaskValues,
): Promise<void> {
  await recorder.navigate(FIXTURE_URL_TEMPLATE, "Open the login page", [
    "host",
    "port",
  ]);
  await recorder.fill(
    page.getByLabel("Username"),
    "username",
    values.username,
    "Fill username field",
  );
  await recorder.fill(
    page.getByLabel("Password"),
    "password",
    values.password,
    "Fill username secret field",
  );
  await recorder.click(
    page.getByRole("button", { name: "Log in" }),
    "Submit login form",
  );
  await recorder.click(page.getByTestId("nav-dashboards"), "Navigate to Dashboards list");
  // Self-hiding, non-navigating control — exercises ADR-0007
  // post_action_target_visible=false so the committed fixture trajectory
  // demonstrates the case that has no URL change to fall back on.
  await recorder.click(page.getByTestId("dismiss-notice"), "Dismiss the preview notice");
}
