---
title: Gate recorder (B2)
doc_type: runbook
status: draft
owner: B2
created: 2026-07-25
updated: 2026-08-14
confidence: MED
supersedes: null
sources_verified: true
---

# Gate recorder

Wave-1 Track-1 agent **B2**. Captures Playwright actions into
[`contracts/trajectory.schema.json`](../../contracts/trajectory.schema.json)
artifacts with lifted parameter slots, ordered locator candidates, and
pre/post fingerprints for B3 assertion synthesis.

## Site identity

No longer a working assumption: ADR-0003 pinned the matrix and
[ADR-0006](../decisions/ADR-0006-track1-gate-task.md) named the task.

| Field | Fixture path | Live path |
| --- | --- | --- |
| `site_key` | `grafana-oss@fixture` | `grafana-oss@{testbed_version}` of the instance recorded (e.g. `grafana-oss@9.5.21`) — **not** `{host}:{port}` (ADR-0015, issue #124) |
| `task_key` | `login-open-dashboards-list`, or resolved from `--intent` (`src/intent/`, issue #124) | `create-stat-dashboard-from-testdata` (ADR-0006), or resolved from `--intent` |
| `provenance.testbed_version` | `fixture-v1` | read from `/api/health` — `9.5.21` for the committed recording |

No `pending-` placeholder survives on the live path.

`site_key` names a product **version**, never an address — `{host}`/`{port}` are already
parameters (`base_url_template`, `parameters.host`/`port`, `bindings`), so baking them into
`site_key` too duplicated data that already had a home and made two recordings of the identical
product+version, pointed at two different addresses, look like two different sites. Before
ADR-0015 the live path built `grafana-oss@{host}:{port}` (`src/recorder/cli.ts`), which also
disagreed with `contracts/trajectory.schema.json`'s own field description
(`"e.g. grafana-oss@10.2.0"`) — the code is now the thing that matches the schema.
`src/recorder/site-identity.ts::buildLiveSiteKey` takes a product and a version and nothing
else, so there is no host or port parameter to thread through by mistake.

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
| First-run **Grafana Assistant dialog** covers the app | 13.0.3 only | Dismissed in the preamble — see the correction below. It is occlusion rather than hiding, so Playwright reports elements underneath as visible and nothing downstream would notice |
| **No change-password interstitial on any version** | all eight | Not clicked through. Compose sets `GF_SECURITY_ADMIN_PASSWORD`, so Grafana never forces the reset; the old conditional "Skip" click was dead code. If the screen ever appears the preamble raises a named failure instead of guessing |

### Correction: the first-run dialog check was losing a race (#24)

Measured on a fresh 13.0.3 container, 2026-07-28. `establishSession` returned at **+2149 ms**;
the Assistant dialog mounted at **+2327 ms**. The old check *sampled* visibility for 2 s and
therefore ran out before the dialog existed — it reported `dismissed_first_run_modal: false`
and left the dialog sitting over the app, so step 1 of any recorded task would have met a modal
instead of the page. It now **waits** for the dialog (`FIRST_RUN_DIALOG_WAIT_MS`, 3 s) instead
of sampling for it, which costs that budget on the seven versions with no dialog and is the
right trade for scaffolding that runs once per recording.

Two claims elsewhere in this repo were wrong and are corrected here. The dialog appears once per
**container**, not once per page load, and the dismissal is stored **server-side**: after
closing it, a brand-new browser context against the same container never sees it again.
`gate/testbed.md`'s "nothing persists the dismissal" is true only across `--down`, which
re-creates the database the testbed keeps on no volume. What made it look per-page-load was this
function silently failing.

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

## The live gate task (ADR-0006)

`npm run recorder -- --base-url …` records the
[ADR-0006](../decisions/ADR-0006-track1-gate-task.md) task — build a Stat panel over the seeded
TestData datasource and save it as a named dashboard. The `--fixture` path records the same six
steps it always has and is still the only one that runs without Docker.

### The fixture is served, not opened (#141)

`--fixture` starts a static server on an ephemeral loopback port, records
`http://{host}:{port}/grafana-gate-login.html`, and stops the server on the way out
(`src/recorder/fixture.ts`). It used to record `file://{fixture_root}/…`, which made
`fixture_root` a whole filesystem path — and a template hole compiles to `[^/?#]+`, which cannot
span `/`. So the bundle carried URL assertions no real path could satisfy:

```text
3 REPAIR_EXHAUSTED  url "file:///Users/…/fixtures/grafana-gate-login.html#home"
                      !~ /^file://[^/?#]+/grafana-gate-login\.html#home$/
```

It recorded and compiled cleanly and then failed at replay — on the one path that needs no
Docker, which is what a visitor tries first and what the root README points at.

The fix is the URL shape, **not** the hole pattern: loosening `[^/?#]+` to cross `/` would
weaken every `url-matches` assertion the product emits, to buy back one fixture. Serving it
gives the fixture the same shape a real `--base-url` recording has, so `host` and `port` are
ordinary single-segment holes. `tests/integration/pipeline.test.ts` now drives this module
instead of its own copy of the flow — its copy was already correct, which is exactly why the
product bug went unnoticed.

**Recorded 2026-07-28 against Grafana `9.5.21`** — the matrix base version, because the gate
walks forward from there. Committed as
[`experiments/gate-v1/trajectories/grafana-create-stat-dashboard-from-testdata-9.5.21.json`](../../experiments/gate-v1/trajectories/grafana-create-stat-dashboard-from-testdata-9.5.21.json):
**12 measured steps, 8 parameter slots, zero typed values.**

```bash
npm run testbed -- --version 9.5.21
npm run testbed -- --version 9.5.21 --verify

# export PARAGENT_USERNAME and PARAGENT_USER_SECRET in the shell first — credentials
# come from the environment, never from a flag, and never reach the artifact
npm run recorder -- --base-url http://127.0.0.1:3000

npm run testbed -- --version 9.5.21 --down
```

`provenance.testbed_version` is read from `/api/health` on the instance being recorded, not
passed in: a hand-typed tag is a claim, `/api/health` is an observation. `--testbed-version`
overrides it deliberately if ever needed.

**Locators are the ones that resolve on 9.5.21, deliberately not a version-tolerant chain.**
Being robust inside a measured step would launder churn out of the gate: the trajectory is
*supposed* to break where a control moved, and the repair loop is what gets measured for putting
it back. Version tolerance belongs in the preamble and nowhere else. Running the recorder
against a later version is therefore expected to exit **4** (`STEP NOT RECORDABLE`) naming the
step — and nothing is written, because a hand-patched trajectory invalidates the gate.

**These locators are also hand-picked, and that is a second, separate asterisk on whatever
survival number the matrix eventually reports.** The 12 selectors above were chosen by a
developer reading the 9.5.21 DOM — picking `data-testid`/`aria-label` where one exists, falling
back to structure only where neither does (step 7's note above) — not proposed by an agent acting
at runtime with no such look-ahead. `provenance.agent_model` is `"human"` on this trajectory for
exactly that reason. See
[`docs/gate/testbed.md` § Honesty second](./testbed.md#honesty-second--hand-picked-locators-not-agent-picked)
for why that makes the gate number an upper bound, not an estimate, and
[issue #127](https://github.com/DevToolie/Paragent/issues/127) for the unbuilt agent-driven
on-ramp that would close it.

### Two recordings, diffed

Recorded three times, each on a **freshly created container** (`--down` then up, so the Grafana
database is new each time). Ignoring `recorded_at` and `timing_ms`:

| Compared | Result |
| --- | --- |
| run 2 vs run 3 (committed) | **byte-identical** |
| run 1 vs run 3 (committed) | one field: `steps[10].post_state.dom_digest` |

Every locator chain was identical across all three — including step 7's, which is the one
ADR-0006 flagged as a phantom-churn risk because the 9.5.21 panel-title input has no `name`, no
`data-testid` and no `aria-label`, leaving a single structural candidate.

The `dom_digest` difference is **measured, not shrugged at**. After the save click the page
passes through three structural states in ~3.5 s:

| Sampled | Visible buttons | Success alert | digest |
| --- | --- | --- | --- |
| +0 ms | 18 | no — drawer still mounted | `bcb92db7…` |
| +500 ms → +3000 ms | 17 | **yes** | `7557bb5b…` |
| +3500 ms onward | 16 | no — toast auto-dismissed | `caf04731…` |

So that one field records which side of a toast's lifetime the capture landed on. It does not
touch this step's assertion: `post_state.url_template` moves from `/dashboard/new` to
`/d/{dashboard_uid}/{dashboard_slug}`, so the compiler synthesizes a **strong** `url-matches`
(priority 3) and never reaches the digest fallback. It would matter for a step that fell all the
way to priority 8 (`custom post_digest_changed_or_stable`) — no step in this task does, and
that is a thing for [#25](https://github.com/DevToolie/Paragent/issues/25) to keep true.

### What the recorder could not capture

- **Nothing was dropped or hand-edited** — all 12 steps recorded cleanly.
- **`assertion_hint` does not carry the success toast.** A click's hint is
  `element-visible / "click target resolved"`, so the compiler's priority-1 rule (toast →
  `text-matches`) has nothing to fire on. The save step is still strong via its URL change, but
  "Dashboard saved" is evidence currently on the floor.
- **Typed values are not asserted.** Steps 5–7 type values that Grafana renders straight back
  into the page (series label, number of values, panel header); the recorder captures no signal
  tying the two together, so the compiler will emit weak `element-visible`. ADR-0006 predicts
  5 strong / 7 weak today and 8 strong / 4 weak once #25 exploits the echo.
- **`post_action_target_visible` is `true` for the save click**, because the drawer's Save button
  is still mounted for a moment after the click — see the toast table above. Correct as an
  observation; it just means ADR-0007's "the control vanished" strong assertion is unavailable
  there.

## Redaction (capture-time)

| Never written | Written instead |
| --- | --- |
| Typed field values | `parameters: { name: type }` + `action.param_refs` |
| Cookies / `storageState` | omitted entirely |
| Concrete host/port in URLs | `{host}` / `{port}` holes |
| Typed values **echoed back** into a URL or page title | `{param}` holes, lifted at emit time |
| Server-assigned ids in URLs (dashboard uid, slug) | `{dashboard_uid}` / `{dashboard_slug}` |

The last two rows exist because of this recording. Grafana puts the dashboard title into the
document title and the saved uid and slug into the URL, so a fingerprint captured verbatim
carried `Paragent Gate Dashboard - Dashboards - Grafana` and
`/d/d82e967e-…/paragent-gate-dashboard` — a typed value in the artifact, and a field that
differs between two recordings of the same task.

`templatizeUrl` only knew about host/port, which was enough while the only live
step was a navigation. `templatizeText` now lifts every bound value, and the pass runs at
**emit** time rather than capture time: a uid is only knowable *after* the step that observed
it, so lifting has to be able to reach backwards. It replaces literals with holes and does
nothing else — it cannot invent a state, only stop one from naming a single run. Values shorter
than four characters are left alone, because `"3"` as a series count would rewrite every digit
on the page.

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

- ~~Final `site_key` / pinned Grafana version — blocked on ADR-0003.~~ **Answered (#24), revised
  by ADR-0015 (#124)** — `site_key` is `grafana-oss@{testbed_version}`, not
  `grafana-oss@{host}:{port}`: the address is already parameterized
  (`base_url_template`/`parameters.host`/`port`), and baking it into the identity too made the
  same product+version at two addresses look like two different sites, which is the opposite of
  what cross-instance cache reuse needs. `provenance.testbed_version` is still read from
  `/api/health`. No `pending-` placeholder remains on the live path.
- ~~Live Grafana first-login password-change interstitial stability across versions.~~
  **Answered (#60)** — it does not appear on any of the eight, because compose sets
  `GF_SECURITY_ADMIN_PASSWORD`. Unverified: what happens against a Grafana that does **not** set
  it. The preamble fails with a named error there rather than guessing.
- **Replay has no preamble.** `establishSession` is recorder-side only. A live matrix run
  ([#62](https://github.com/DevToolie/Paragent/issues/62)) needs its own session establishment,
  or every version will fail step 1 for lack of a session — and on 13.0.3 the first-run dialog
  will occlude the app without Playwright noticing. That is scaffolding for the runner to
  own; it must **not** become version-conditional logic inside replayed steps.
- ~~The live trajectory has **one** measured step now that login is a preamble.~~
  **Closed (#59 → ADR-0006, recorded in #24)** — 12 measured steps against 9.5.21.
- **The task has only ever been recorded on the base version.** That is by design, but it means
  the ADR-0006 claim that every step has a counterpart on 13.0.3 rests on a hand walk, not on a
  second recording. The first live matrix run ([#62](https://github.com/DevToolie/Paragent/issues/62))
  is where that gets tested.
- **The success toast is unused evidence.** Wiring `assertion_hint.observed_signals` to notice a
  success/notification element would give the compiler its priority-1 rule on the save step —
  and, more importantly, would let steps that type a value point at where the page echoed it.
  Not attempted here: it changes what the recorder claims, and #25 is where those claims get
  tested against a real compile.
- **Repeat runs against one instance will collide.** `{dashboard_title}` is a fixed default, so
  a second recording against the *same* container creates a second dashboard with the same
  title. Fine today (each recording used a fresh container, and each matrix version boots its
  own), but [#66](https://github.com/DevToolie/Paragent/issues/66) will need `--dashboard-title`
  per run or a uniquifier.
- Whether `input[name=...]` stays stable past 13.0.3. It held across five majors, but nothing
  guarantees it; if it moves, the preamble fails loudly at `fill-credentials` rather than
  silently recording a broken session.
- B5 allowlisted `data-testid` vocabulary — testids default `tenant_scoped: false` pending B5.
- Gate success metric — `[PENDING TRACK-1]`; not invented here.
