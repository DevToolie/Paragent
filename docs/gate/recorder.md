---
title: Gate recorder (B2)
doc_type: runbook
status: draft
owner: B2
created: 2026-07-25
updated: 2026-07-27
confidence: MED
supersedes: null
sources_verified: true
---

# Gate recorder

Wave-1 Track-1 agent **B2**. Captures Playwright actions into
[`contracts/trajectory.schema.json`](../../contracts/trajectory.schema.json)
artifacts with lifted parameter slots, ordered locator candidates, and
pre/post fingerprints for B3 assertion synthesis.

## Working assumption (test-bed)

ADR-0003 / B1 test-bed was **not merged** at capture time. Default site identity:

| Field | Value | Confidence |
| --- | --- | --- |
| `site_key` | `grafana-oss@fixture` (fixture) or `grafana-oss@pending-adr0003` (live) | MED |
| Gate task | `login-open-dashboards-list` — login, then open Dashboards list | HIGH |
| Live console | Grafana OSS (working assumption until ADR-0003) | MED |

Re-label `site_key` / `testbed_version` when B1 pins a version matrix.

## Session preamble — logging in is NOT a measured step

`establishSession()` in [`src/recorder/preamble.ts`](../../src/recorder/preamble.ts) logs the
browser in **without touching `TrajectoryRecorder`**, so no login action reaches
`trajectory.steps` and **no preamble step ever enters a step-validity denominator**. Before
issue #60 the live CLI recorded navigate → fill → fill → click → (skip) as measured steps, so
roughly five of six "gate task" steps were login scaffolding, and step-level validity was mostly
measuring whether Grafana's login form had moved.

The distinction is load-bearing:

- **Login is scaffolding.** It gets the browser into a state where the task can begin. Making it
  version-robust is legitimate.
- **The task is the measurement.** Version-conditional fallbacks *inside* measured steps would
  launder churn out of the gate number. Do not copy this pattern into the recorded task, and do
  not add version fallbacks to `src/runner/locators.ts` — replay must fail honestly when a
  locator stops resolving, because that failure is the datum.

### What was observed, and on which versions

All eight pinned versions were booted and their login surface dumped on **2026-07-27**:
9.5.21, 10.0.13, 10.4.19, 11.0.0, 11.5.2, 12.0.0, 12.2.1, 13.0.3. Login identity churns once,
at **10.4.19**, and it churns in two places at the same time:

| | 9.5.21, 10.0.13 | 10.4.19 → 13.0.3 |
| --- | --- | --- |
| username field | `aria-label="Username input field"`, no `<label>`, no testid | `<label>Email or username</label>`, `data-testid="data-testid Username input field"`, no aria-label |
| password field | `aria-label="Password input field"` + `<label>Password</label>` | `<label>Password</label>` + `data-testid="data-testid Password input field"` |
| submit button | `aria-label="Login button"` wrapping `<span>Log in</span>` | no aria-label, `data-testid="data-testid Login button"`, text `Log in` |
| **accessible name of submit** | **`Login button`** | **`Log in`** |

Stable across **all eight**: `input[name="user"]`, `input[name="password"]`, and exactly one
`button[type="submit"]`. The preamble selects on those, because handling a difference by picking
an attribute that does not differ beats branching on one that does.

That choice is not cosmetic. `aria-label` **wins over text content** when computing an
accessible name, so on 9.5.21 and 10.0.13 the submit button is named `Login button` and
`getByRole("button", { name: /log in/i })` matches **zero** elements. The pre-#60 code used
`getByLabel("Email or username").or(getByLabel("Username"))` plus a role-based submit — written,
per the issue, without a running instance.

Two further differences, neither affecting selection:

| Observation | Versions | Handling |
| --- | --- | --- |
| Landing URL is `/?orgId=1` | 9.5.21 → 11.0.0 | The preamble waits for "no longer on `/login`" and never asserts an exact post-login URL |
| Landing URL gains `&from=now-6h&to=now&timezone=browser` | 11.5.2 → 13.0.3 | same |
| First-run **Grafana Assistant dialog** covers the app on every boot | 13.0.3 only | Dismissed in the preamble. Nothing persists the dismissal (the testbed mounts no volume), and it is occlusion rather than hiding — Playwright reports elements underneath as visible, so nothing downstream would notice |
| **No change-password interstitial on any version** | all eight | Not clicked through. Compose sets `GF_SECURITY_ADMIN_PASSWORD`, so Grafana never forces the reset; the old conditional "Skip" click was dead code. If the screen ever appears the preamble raises a named failure instead of guessing |

### Failure is named, never silent

The preamble ends by asking `/api/user` — which answers 200 with the login on every matrix
version — and throws `LoginFailedError` carrying the stage that failed
(`open-login-page`, `fill-credentials`, `submit-login`, `password-change-interstitial`,
`verify-session`). The CLI exits **3** and writes no trajectory:

```text
recorder: LOGIN FAILED (stage: verify-session) — session not established: GET /api/user
returned 401. Credentials rejected, or login did not complete.
No trajectory was written. This is scaffolding failing, not a measured step.
```

A DOM probe would have been weaker: a page can look logged in. This cannot be satisfied by
appearances, and a silent login failure can no longer masquerade as a step-1 locator failure in
the gate data.

**Scope note.** The `--fixture` path still records its login steps. That fixture is a
self-contained pipeline stand-in used by the integration and unit tests, not the gate task;
stripping its login would shrink it to two steps and weaken the seam test. The real task is
[#59](https://github.com/DevToolie/Paragent/issues/59)/[#24](https://github.com/DevToolie/Paragent/issues/24).

## What is recorded

Login is **not** in this list — see the preamble section above. For every measured step:

1. **Action** — type, `param_refs`, optional `url_template` / `key` (never inline typed values).
2. **Locator candidates** (compiler preference order):
   `role_name` → `label` → `testid` → `structural` → `text` (+ optional `placeholder`).
   Free-text strategies are marked `tenant_scoped: true`.
3. **Fingerprints** — `url_template`, `title_template`, `dom_digest` (hash of
   landmark/role/count signals — **not** raw HTML), `visible_landmarks`, `network_idle`.
4. **Timing** — `started_offset_ms`, `duration_ms` from session start.
5. **Assertion hint** (optional, non-authoritative) for B3.
6. **`post_action_target_visible`** (optional) — whether the control the step acted on was
   still visible immediately after the action. Omitted when the step acted through no locator
   (`navigate`, `wait`). See [ADR-0007](../decisions/ADR-0007-post-action-visibility.md).

### Visibility is real, and measured two ways on purpose

`visible_landmarks` is genuinely visibility-filtered — it was not before ADR-0007, and a
landmark that had just been hidden was still listed. Filtering uses an in-page
`Element.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })` pass. The
flags matter: with defaults, `checkVisibility()` calls a `visibility: hidden` element *visible*
while Playwright does not.

`src/runner/page-state.ts` runs the **same enumeration**, not merely the same predicate — one
copy, in [`src/shared/landmarks.ts`](../../src/shared/landmarks.ts): role vocabulary, implicit
roles for `FORM MAIN NAV HEADER FOOTER ASIDE`, the visibility predicate, and the tree walk.
Until [#74](https://github.com/DevToolie/Paragent/issues/74) the two sites shared only the
predicate and `page-state` silently missed `banner` / `complementary` / `contentinfo` on markup
without redundant `role` attributes. The fixture below cannot show that — it puts an explicit
`role=` on every landmark — so `tests/unit/landmarks.test.ts` builds semantic pages that do not.

It is a **JS source string**, not a shared function. Both sites hand their evaluate body to the
browser as text because esbuild's `keepNames` wraps named function expressions in `__name(...)`,
which does not exist there. Anything that turns the shared snippet back into a callback
reintroduces a runtime crash CI cannot see. `search` and `region` are in the role set but have
no implicit tag mapping — explicit `role=` only.

`post_action_target_visible` instead uses Playwright's `Locator.isVisible()`. That is
deliberate: `src/runner/assertions.ts` later checks this same target with
`waitFor({ state: "hidden" | "visible" })`, which is Playwright's definition. Recording the
observation the runner will make is what keeps the two honest.

The role and element **counts** inside `dom_digest` remain DOM-wide. They are structural
signals, not visibility claims.

## Redaction (capture-time)

| Never written | Written instead |
| --- | --- |
| Typed field values | `parameters: { name: type }` + `action.param_refs` |
| Cookies / `storageState` | omitted entirely |
| Concrete host/port in URLs | `{host}` / `{port}` (or `{fixture_root}`) holes |

## Package layout

| Path | Role |
| --- | --- |
| `src/recorder/session.ts` | `TrajectoryRecorder` |
| `src/recorder/preamble.ts` | `establishSession` — login scaffolding, records nothing |
| `src/recorder/locators.ts` | Candidate collection |
| `src/recorder/fingerprint.ts` | Pre/post fingerprints |
| `src/shared/landmarks.ts` | The one landmark enumeration, shared with `src/runner/page-state.ts` |
| `src/recorder/redact.ts` | Templatize / secret scan |
| `src/recorder/cli.ts` | Gate-task CLI |
| `src/recorder/fixtures/grafana-gate-login.html` | Deterministic stand-in |
| `src/recorder/fixtures/login-aria-label.html` | Login shape observed on 9.5.21 / 10.0.13 |
| `src/recorder/fixtures/login-labelled.html` | Login shape observed on 10.4.19 → 13.0.3 |
| `experiments/gate-v1/trajectories/*.json` | Committed example |

## How to run

```bash
npm install
npx playwright install chromium
npm run recorder -- --fixture
```

Live (credentials via env only — never commit values):

```powershell
# set PARAGENT_USERNAME and PARAGENT_USER_SECRET in the shell environment
npm run recorder -- --base-url http://127.0.0.1:3000
```

(`PARAGENT_USER_SECRET` is the password binding; also accepts `PARAGENT_PASS`.)

Validate: `npm run validate:contracts` && `npm run test`

## Sources

| Claim | URL | access_date |
| --- | --- | --- |
| Playwright locators | https://playwright.dev/docs/locators | 2026-07-25 |
| Playwright Page API | https://playwright.dev/docs/api/class-page | 2026-07-25 |
| Trajectory contract | `contracts/trajectory.schema.json` | 2026-07-25 |
| Stack ADR | `docs/decisions/ADR-0001-typescript-node-playwright.md` | 2026-07-25 |

## Open questions / what I could not verify

- Final `site_key` / pinned Grafana version — blocked on ADR-0003 (B1).
- ~~Live Grafana first-login password-change interstitial stability across versions.~~
  **Answered (#60)** — it does not appear on any of the eight, because compose sets
  `GF_SECURITY_ADMIN_PASSWORD`. Unverified: what happens against a Grafana that does **not** set
  it. The preamble fails with a named error there rather than guessing.
- **Replay has no preamble.** `establishSession` is recorder-side only. A live matrix run
  ([#62](https://github.com/DevToolie/Paragent/issues/62)) needs its own session establishment,
  or every version will fail step 1 for lack of a session — and on 13.0.3 the first-run dialog
  will occlude the app without Playwright noticing. That is scaffolding for the runner to
  own; it must **not** become version-conditional logic inside replayed steps.
- The live trajectory currently has **one** measured step (`navigate /dashboards`) now that
  login is a preamble. That is honest but far too thin to measure — exactly the gap
  [#59](https://github.com/DevToolie/Paragent/issues/59) exists to close.
- Whether `input[name=...]` stays stable past 13.0.3. It held across five majors, but nothing
  guarantees it; if it moves, the preamble fails loudly at `fill-credentials` rather than
  silently recording a broken session.
- B5 allowlisted `data-testid` vocabulary — testids default `tenant_scoped: false` pending B5.
- Gate success metric — `[PENDING TRACK-1]`; not invented here.
