/**
 * #60 — the login preamble is scaffolding and must behave like it.
 *
 * The load-bearing test is `both observed login shapes`: Grafana's login field
 * identity churns at 10.4.19 (aria-label → <label> + data-testid), so a
 * label-based selector works on exactly one side of that boundary. The preamble
 * selects on `name=`, which did not churn. Running it against fixtures of BOTH
 * observed shapes is what pins that; swap in `getByLabel(...)` and one of them
 * fails.
 *
 * No Docker: a loopback server stands in for Grafana, serving the two recorded
 * login shapes plus just enough of `/api/user` to exercise the session
 * assertion. Fixtures are transcribed from live dumps — see their comments.
 */

import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser } from "playwright";
import { launchTestBrowser } from "../helpers/browser.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { establishSession, LoginFailedError } from "../../src/recorder/preamble.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURES = path.join(ROOT, "src/recorder/fixtures");

const USER = "admin";
const PASS = "paragent";

interface FakeGrafanaOptions {
  /** Which observed login shape to serve. */
  variant: "aria-label" | "labelled";
  /** Landing query string — differs across versions (11.5.2 added time range). */
  landingQuery?: string;
  /** Serve a first-run dialog over the app, as 13.0.3 does. */
  firstRunModal?: boolean;
  /** Reject the submitted credentials. */
  rejectLogin?: boolean;
  /** Accept any password — lets a test drive a canary value through the flow. */
  acceptAnyCredential?: boolean;
  /** Answer /api/user as this login (null → 401). */
  sessionLogin?: string | null;
}

/**
 * Minimal Grafana stand-in. Session state is a single in-memory flag; this is a
 * DOM/flow fixture, not an auth model.
 */
async function startFakeGrafana(opts: FakeGrafanaOptions): Promise<{
  server: Server;
  baseUrl: string;
}> {
  const loginHtml = await readFile(
    path.join(FIXTURES, opts.variant === "aria-label" ? "login-aria-label.html" : "login-labelled.html"),
    "utf8",
  );
  let authed = false;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/api/user") {
      const login = opts.sessionLogin === undefined ? USER : opts.sessionLogin;
      if (!authed || login === null) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: "Unauthorized" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ login, isGrafanaAdmin: true }));
      return;
    }

    if (url.pathname === "/login-submit") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const form = new URLSearchParams(body);
        const ok =
          !opts.rejectLogin &&
          form.get("user") === USER &&
          (opts.acceptAnyCredential === true || form.get("password") === PASS);
        if (!ok) {
          // Grafana re-renders the login page with an error; stay on /login.
          res.writeHead(302, { location: "/login?err=1" });
          res.end();
          return;
        }
        authed = true;
        res.writeHead(302, { location: `/${opts.landingQuery ?? "?orgId=1"}` });
        res.end();
      });
      return;
    }

    if (url.pathname === "/login") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(loginHtml);
      return;
    }

    // Landing page.
    // The close button must actually close, as the real dialog does — otherwise
    // the test measures the stand-in's inertness rather than the preamble.
    const modal = opts.firstRunModal
      ? `<div role="dialog" aria-modal="true" style="position:fixed;inset:20% 10%;background:#222;color:#eee">
           <h2>Grafana Assistant is now available to OSS users</h2>
           <button aria-label="Close"
                   onclick="this.closest('[role=dialog]').remove()">&times;</button>
         </div>`
      : "";
    res.writeHead(200, { "content-type": "text/html" });
    res.end(
      `<!doctype html><html><head><title>Grafana</title></head><body>
         <nav><a href="/dashboards">Dashboards</a></nav>
         <main><h1>Home</h1></main>${modal}</body></html>`,
    );
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

describe("login preamble (#60)", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await launchTestBrowser();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  const withServer = async (
    opts: FakeGrafanaOptions,
    fn: (baseUrl: string, page: import("playwright").Page) => Promise<void>,
  ) => {
    const { server, baseUrl } = await startFakeGrafana(opts);
    const page = await browser.newPage();
    try {
      await fn(baseUrl, page);
    } finally {
      await page.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  };

  // The reason this module exists. Both shapes are real, from live dumps.
  it.each([
    ["aria-label", "9.5.21 / 10.0.13"],
    ["labelled", "10.4.19 → 13.0.3"],
  ] as const)(
    "logs in against the %s login shape (observed on %s)",
    async (variant, _versions) => {
      await withServer({ variant }, async (baseUrl, page) => {
        const session = await establishSession(page, {
          baseUrl,
          username: USER,
          password: PASS,
        });
        expect(session.user_login).toBe(USER);
        expect(session.dismissed_first_run_modal).toBe(false);
      });
    },
    60_000,
  );

  it("tolerates the landing-URL change at 11.5.2 instead of asserting an exact URL", async () => {
    await withServer(
      { variant: "labelled", landingQuery: "?orgId=1&from=now-6h&to=now&timezone=browser" },
      async (baseUrl, page) => {
        const session = await establishSession(page, {
          baseUrl,
          username: USER,
          password: PASS,
        });
        expect(session.user_login).toBe(USER);
        expect(session.landed_url).toContain("timezone=browser");
      },
    );
  }, 60_000);

  it("dismisses a first-run dialog, as 13.0.3 shows on every boot", async () => {
    await withServer(
      { variant: "labelled", firstRunModal: true },
      async (baseUrl, page) => {
        const session = await establishSession(page, {
          baseUrl,
          username: USER,
          password: PASS,
        });
        expect(session.dismissed_first_run_modal).toBe(true);
        expect(await page.locator('[role="dialog"]').isVisible()).toBe(false);
      },
    );
  }, 60_000);

  it("fails at the login stage on a wrong password, naming the stage", async () => {
    await withServer({ variant: "labelled", rejectLogin: true }, async (baseUrl, page) => {
      const err = await establishSession(page, {
        baseUrl,
        username: USER,
        password: "wrong-password-never-persisted",
        timeoutMs: 8_000,
      }).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(LoginFailedError);
      expect((err as LoginFailedError).stage).toBe("verify-session");
      // A silent login failure must not be able to masquerade as step-1 churn.
      expect((err as LoginFailedError).message).toMatch(/session not established/i);
    });
  }, 60_000);

  it("rejects a session belonging to a different user", async () => {
    await withServer(
      { variant: "labelled", sessionLogin: "somebody-else" },
      async (baseUrl, page) => {
        const err = await establishSession(page, {
          baseUrl,
          username: USER,
          password: PASS,
          timeoutMs: 8_000,
        }).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(LoginFailedError);
        expect((err as LoginFailedError).stage).toBe("verify-session");
      },
    );
  }, 60_000);

  it("names the stage when the login page cannot be opened", async () => {
    const page = await browser.newPage();
    try {
      // Port 1 is reserved and refuses connections.
      const err = await establishSession(page, {
        baseUrl: "http://127.0.0.1:1",
        username: USER,
        password: PASS,
        timeoutMs: 5_000,
      }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(LoginFailedError);
      expect((err as LoginFailedError).stage).toBe("open-login-page");
    } finally {
      await page.close();
    }
  }, 60_000);

  it("never lets the password reach the returned session info", async () => {
    await withServer({ variant: "labelled", acceptAnyCredential: true }, async (baseUrl, page) => {
      const session = await establishSession(page, {
        baseUrl,
        username: USER,
        password: "canary-secret-never-persist",
      });
      expect(JSON.stringify(session)).not.toContain("canary-secret-never-persist");
    });
  }, 60_000);
});
