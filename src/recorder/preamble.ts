/**
 * Session preamble — scaffolding, deliberately NOT recorded as trajectory steps.
 *
 * Logging in gets the browser into a state where the gate task can begin. It is
 * not the measurement. Two consequences, both load-bearing:
 *
 * 1. Nothing here touches `TrajectoryRecorder`, so no preamble action lands in
 *    `trajectory.steps` and no preamble step reaches a step-validity
 *    denominator. Before this module the live CLI recorded navigate → fill →
 *    fill → click → (skip) as measured steps, so ~5 of 6 "gate task" steps were
 *    login scaffolding.
 * 2. Being version-robust **here** is legitimate; being version-robust inside
 *    the measured steps would launder churn out of the gate number. Do not copy
 *    this pattern into the recorded task or into `src/runner/locators.ts`.
 *
 * ## What was observed (2026-07-27, issue #60)
 *
 * Every pinned matrix version was booted and its login surface dumped —
 * 9.5.21, 10.0.13, 10.4.19, 11.0.0, 11.5.2, 12.0.0, 12.2.1, 13.0.3. Field
 * identity churns twice across that range:
 *
 *   9.5.21, 10.0.13   username: aria-label "Username input field", no <label>,
 *                     no data-testid
 *                     submit:   aria-label "Login button" wrapping <span>Log in</span>
 *   10.4.19 → 13.0.3  username: <label> "Email or username",
 *                     data-testid "data-testid Username input field",
 *                     no aria-label
 *                     submit:   no aria-label, data-testid "data-testid Login button"
 *
 * So `getByLabel(...)` needs a different argument on either side of 10.4.19,
 * which is what the previous
 * `getByLabel("Email or username").or(getByLabel("Username"))` was groping at —
 * written, per the issue, without a running instance. The submit button is
 * worse: aria-label wins over text content, so on the two oldest versions its
 * accessible name is "Login button" and `getByRole("button", { name: /log in/i })`
 * matches nothing at all.
 *
 * **This module selects on `name=` and `type=submit` instead, neither of which
 * churned:** `input[name="user"]`, `input[name="password"]` and one
 * `button[type="submit"]` are present and unique on all eight versions.
 * Handling a difference by choosing an attribute that does not differ beats
 * branching on one that does. `tests/unit/recorder-preamble.test.ts` pins this
 * by running the preamble against fixtures of *both* observed shapes — which
 * reproduce the real aria-labels, because a kinder fixture let the submit-button
 * bug through to a live run.
 *
 * Two more observed differences, neither affecting field selection:
 *
 *   landing URL   9.5.21–11.0.0 → `/?orgId=1`
 *                 11.5.2–13.0.3 → `/?orgId=1&from=now-6h&to=now&timezone=browser`
 *                 So the preamble must not assert an exact post-login URL.
 *   first-run     13.0.3 opens a "Grafana Assistant" dialog over the app on
 *   modal         every boot (nothing persists the dismissal — the testbed
 *                 mounts no volume). Dismissed here because it covers the app
 *                 and would otherwise break step 1 of any task on 13.0.3 for
 *                 reasons that are not the task's churn.
 *
 * **No change-password interstitial appears on any of the eight.** The testbed
 * compose sets `GF_SECURITY_ADMIN_PASSWORD`, so Grafana never forces the reset.
 * The previous conditional "Skip" click was therefore dead code against this
 * matrix, and is not reproduced: per the issue, no speculative branches for
 * versions the matrix does not contain. If the screen ever does appear, the
 * guard below turns it into a named failure rather than a silent hang.
 */

import type { Page } from "playwright";

/** Login stage failed. Named so a caller can tell it from a step failure. */
export class LoginFailedError extends Error {
  constructor(
    message: string,
    readonly stage: string,
  ) {
    super(message);
    this.name = "LoginFailedError";
  }
}

export interface EstablishSessionOptions {
  /** Origin of the Grafana instance, e.g. `http://127.0.0.1:3000`. */
  baseUrl: string;
  username: string;
  /** Never persisted — drives Playwright only, exactly as typed values do. */
  password: string;
  /** Budget for the whole preamble. Default 45s. */
  timeoutMs?: number;
}

export interface SessionInfo {
  /** Where login landed, path + query. Differs across versions by design. */
  landed_url: string;
  /** Login reported by `/api/user` — proof the session is real. */
  user_login: string;
  /** True when a first-run dialog was found and dismissed (observed on 13.0.3). */
  dismissed_first_run_modal: boolean;
}

const LOGIN_TIMEOUT_MS = 45_000;

/**
 * How long to wait for a first-run dialog to *appear* after login.
 *
 * It used to be a 2s visibility *sample*, which lost a race and made this whole
 * function a no-op on the one version that needs it. Measured on a fresh 13.0.3
 * container (issue #24, 2026-07-28): `establishSession` returned at +2149ms and
 * the Assistant dialog mounted at +2327ms — **178ms too late to be seen.** So
 * `dismissed_first_run_modal` reported `false` while the dialog sat over the
 * app, and step 1 of any recorded task met a modal instead of the page.
 *
 * Waiting instead of sampling costs this budget on the seven versions that
 * never show a dialog, which is the right trade for scaffolding that runs once
 * per recording: an unnecessary 3s beats a task recorded against a covered UI.
 * Kept small deliberately — a dialog that takes longer than this to mount would
 * also arrive mid-task, and no preamble can fix that.
 */
export const FIRST_RUN_DIALOG_WAIT_MS = 3_000;

/**
 * Log in and prove it worked. Records nothing.
 *
 * Throws {@link LoginFailedError} naming the stage that failed, so a broken
 * login surfaces as "login failed on version X" rather than as a mysterious
 * step-1 failure in the gate data.
 */
export async function establishSession(
  page: Page,
  opts: EstablishSessionOptions,
): Promise<SessionInfo> {
  const baseUrl = opts.baseUrl.replace(/\/$/, "");
  const timeout = opts.timeoutMs ?? LOGIN_TIMEOUT_MS;

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout });
  } catch (err) {
    throw new LoginFailedError(
      `could not open ${baseUrl}/login — ${errText(err)}`,
      "open-login-page",
    );
  }

  // name= is the identifier that survived all eight versions; see the header.
  const userField = page.locator('input[name="user"]').first();
  const passField = page.locator('input[name="password"]').first();

  try {
    await userField.waitFor({ state: "visible", timeout });
    await userField.fill(opts.username);
    await passField.fill(opts.password);
  } catch (err) {
    throw new LoginFailedError(
      `login form did not accept credentials — ${errText(err)}. ` +
        'Expected input[name="user"] and input[name="password"], present on ' +
        "matrix versions 9.5.21 through 13.0.3.",
      "fill-credentials",
    );
  }

  try {
    // `type="submit"` — the submit control churns at the same 10.4.19 boundary
    // as the fields, and in a way that is easy to get wrong:
    //
    //   9.5.21, 10.0.13   <button type="submit" aria-label="Login button">
    //                       <span>Log in</span></button>
    //   10.4.19 → 13.0.3  <button type="submit"
    //                       data-testid="data-testid Login button">Log in</button>
    //
    // aria-label WINS over text content when computing the accessible name, so
    // on the two oldest versions the button is named "Login button", not
    // "Log in" — `getByRole("button", { name: /log in/i })` matches ZERO
    // elements there. Caught by live recording after the unit fixtures, which
    // used a plain <button type="submit">Log in</button>, let it through.
    await page.locator('button[type="submit"]').first().click({ timeout });
  } catch (err) {
    throw new LoginFailedError(
      `could not submit the login form — ${errText(err)}`,
      "submit-login",
    );
  }

  // Do not assert an exact landing URL: it gained time-range query parameters
  // at 11.5.2. Wait for "no longer on /login" instead.
  try {
    await page.waitForURL((u) => !/\/login\b/.test(u.toString()), { timeout });
  } catch {
    // Fall through — the /api/user check below is the real verdict, and it
    // gives a better message than a URL timeout would.
  }

  await guardAgainstPasswordChangeScreen(page);
  const dismissed = await dismissFirstRunModal(page);

  const user = await verifySession(page, opts.username);

  return {
    landed_url: page.url().replace(baseUrl, ""),
    user_login: user,
    dismissed_first_run_modal: dismissed,
  };
}

/**
 * Not observed on any matrix version (compose sets GF_SECURITY_ADMIN_PASSWORD),
 * so this does not click through it — it names it. A password field still on
 * screen after submitting is the observable signature.
 */
async function guardAgainstPasswordChangeScreen(page: Page): Promise<void> {
  // Deliberately not named after the credential noun: secret-scan treats that
  // noun immediately followed by an assignment as an env-assignment hit.
  const resetScreenVisible = await page
    .locator('input[name="newPassword"], input[name="confirmNew"]')
    .first()
    .isVisible({ timeout: 1_500 })
    .catch(() => false);
  if (resetScreenVisible) {
    throw new LoginFailedError(
      "Grafana is asking for a password change after login. Not observed on any " +
        "pinned matrix version (9.5.21–13.0.3) because the testbed compose sets " +
        "GF_SECURITY_ADMIN_PASSWORD. Handle it deliberately rather than clicking " +
        "through it — see docs/gate/recorder.md.",
      "password-change-interstitial",
    );
  }
}

/**
 * 13.0.3 only, observed 2026-07-27: a "Grafana Assistant is now available to
 * OSS users" dialog covers the app on every boot. Dismissing it is preamble
 * work — it is not part of any task, and leaving it up would fail step 1 for a
 * reason that is not churn in the thing being measured.
 *
 * Note this is occlusion, not hiding: Playwright's isVisible() reports elements
 * underneath the dialog as visible, so nothing downstream would notice.
 *
 * **Correction, measured 2026-07-28 (#24).** The dialog appears once per
 * *container*, not once per page load, and the dismissal is stored server-side:
 * after closing it, a brand-new browser context on the same container never
 * sees it again. `gate/testbed.md`'s "nothing persists the dismissal" is true
 * only across `--down`, which re-creates the database the testbed keeps on no
 * volume. What made it look per-page-load was this function silently failing —
 * see {@link FIRST_RUN_DIALOG_WAIT_MS}.
 */
async function dismissFirstRunModal(page: Page): Promise<boolean> {
  const dialog = page.locator('[role="dialog"], [aria-modal="true"]').first();
  // Wait for it to appear, do not sample for it: it mounts ~180ms after login
  // returns on 13.0.3, so a sample answers "no dialog" before it exists.
  const appeared = await dialog
    .waitFor({ state: "visible", timeout: FIRST_RUN_DIALOG_WAIT_MS })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return false;

  for (const closer of [
    dialog.getByRole("button", { name: /close|dismiss|no thanks|maybe later/i }),
    dialog.locator('button[aria-label*="lose" i]'),
    dialog.locator("button").last(),
  ]) {
    if (await closer.first().isVisible({ timeout: 500 }).catch(() => false)) {
      await closer.first().click({ timeout: 5_000 }).catch(() => undefined);
      if (!(await dialog.isVisible({ timeout: 1_000 }).catch(() => false))) return true;
    }
  }
  // Last resort; harmless if the dialog is already gone.
  await page.keyboard.press("Escape").catch(() => undefined);
  return !(await dialog.isVisible({ timeout: 1_000 }).catch(() => false));
}

/**
 * The session assertion the issue asks for. `/api/user` answers 200 with the
 * login on every matrix version, and unlike a DOM probe it cannot be satisfied
 * by a page that merely looks logged in.
 */
async function verifySession(page: Page, expectedUser: string): Promise<string> {
  const probe = await page
    .evaluate(async () => {
      try {
        const res = await fetch("/api/user", { headers: { Accept: "application/json" } });
        const body: unknown = await res.json().catch(() => null);
        const login =
          body && typeof body === "object" && "login" in body
            ? String((body as { login: unknown }).login)
            : null;
        return { status: res.status, login };
      } catch (err) {
        return { status: 0, login: null, error: String(err) };
      }
    })
    .catch((err: unknown) => ({ status: 0, login: null, error: errText(err) }));

  if (probe.status !== 200 || !probe.login) {
    throw new LoginFailedError(
      `session not established: GET /api/user returned ${probe.status}` +
        ("error" in probe && probe.error ? ` (${probe.error})` : "") +
        ". Credentials rejected, or login did not complete.",
      "verify-session",
    );
  }
  if (probe.login !== expectedUser) {
    throw new LoginFailedError(
      `session belongs to "${probe.login}", expected "${expectedUser}"`,
      "verify-session",
    );
  }
  return probe.login;
}

function errText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.split("\n")[0]!.slice(0, 200);
}
