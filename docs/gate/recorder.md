---
title: Gate recorder (B2)
doc_type: runbook
status: draft
owner: B2
created: 2026-07-25
updated: 2026-07-25
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

## What is recorded

For every step:

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
`Element.checkVisibility()` pass, matching `src/runner/page-state.ts` exactly so the recorder
and the repair context cannot describe the same page differently.

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
| `src/recorder/locators.ts` | Candidate collection |
| `src/recorder/fingerprint.ts` | Pre/post fingerprints |
| `src/recorder/redact.ts` | Templatize / secret scan |
| `src/recorder/cli.ts` | Gate-task CLI |
| `src/recorder/fixtures/grafana-gate-login.html` | Deterministic stand-in |
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
- Live Grafana first-login password-change interstitial stability across versions.
- B5 allowlisted `data-testid` vocabulary — testids default `tenant_scoped: false` pending B5.
- Gate success metric — `[PENDING TRACK-1]`; not invented here.
