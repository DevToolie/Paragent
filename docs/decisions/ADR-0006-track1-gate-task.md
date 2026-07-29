---
title: "ADR-0006 — Track-1 gate task = build and save a TestData Stat dashboard"
doc_type: adr
status: accepted
owner: B2
created: 2026-07-28
updated: 2026-07-28
confidence: HIGH
supersedes: null
sources_verified: true
---

# ADR-0006 — Track-1 gate task = build and save a TestData Stat dashboard

## Status

accepted

## Context

**Triggered by:** issue [#59](https://github.com/DevToolie/Paragent/issues/59). The task recorded
so far is *log in, open the dashboards list* — four steps in the fixture, and since
[#60](https://github.com/DevToolie/Paragent/issues/60) moved login into a preamble, **one**
measured step live. Two independent objections, both already written down before this ADR:

1. **PRD §8** chose 8–12 steps deliberately, so step-level validity statistics mean something.
   At one measured step, step-validity is 0% or 100%.
2. **[gate/testbed.md](../gate/testbed.md) open questions:** "whether the B2 gate task stays
   browser-meaningful once Grafana HTTP APIs cover the same clicks — Track-1 must pick tasks
   that still stress DOM locators, not only API-equivalent config." Login-and-navigate is the
   least DOM-interesting thing Grafana does.

Everything downstream — recorder, compiler, replay, the matrix run, the gate memo — is built on
this choice, and re-recording across eight versions is not cheap. Hence an ADR.

**Method.** Both extremes of the ADR-0003 matrix were booted and the candidate tasks walked in a
real browser on **2026-07-28**: `9.5.21` (oldest pin, the base version the recording will be
made against) and `13.0.3` (newest pin). Candidate A was walked **end to end on both**;
candidates B and C had their entry surfaces opened on both and were not completed. Every
identity quoted below was read out of the running DOM, not out of Grafana's docs.

## Options considered

### A — Build a panel from the seeded TestData datasource and save the dashboard (chosen)

New dashboard → add panel → pick the Stat visualisation → set two TestData query fields → name
the panel → apply → save with a name → confirm it is listed.

Honest case for:

- **Walked end to end on 9.5.21 and 13.0.3.** Every step had a counterpart on both; the flow
  finished with a saved dashboard and a visible list row on each.
- It spans four different interaction surfaces — canvas, visualisation picker, query editor,
  options pane, save drawer, list — rather than four fields on one form.
- The seeded TestData datasource is already provisioned and default
  ([ADR-0003](ADR-0003-testbed-grafana-oss.md)), so the task needs no extra fixture.
- **Three of its typed values are rendered back into the DOM** (alias → series labels, series
  count → number of rendered values, panel title → panel header), which is what makes their
  assertions strengthenable rather than permanently weak. Observed on both extremes.
- The churn is mixed rather than total: the TestData query inputs (`name="alias"`,
  `name="seriesCount"`) are **identical on 9.5.21 and 13.0.3**, while the chrome around them
  churns hard. A task where everything breaks measures nothing; nor does one where nothing does.

Honest case against: the *outcome* is a single `POST /api/dashboards/db`. See
"DOM-meaningfulness" below, where that is conceded and answered rather than waved away.

### B — Create an alert rule with a contact point (runner-up)

Honest case for: the richest form in Grafana OSS. `/alerting/new` counted 31 visible inputs on
9.5.21 and 22 on 13.0.3, most of them identifiable; it has async folder/evaluation-group
pickers and an alert-condition builder, which is closest to PRD §8's "first ugly task".

Honest case against: the surrounding surface churned more than the form did. Contact points live
under `Alerting → Contact points` on 9.5.21 and `Alerting → Notification configuration` on
13.0.3, and `/alerting/notifications` counted **0** identifiable inputs on 9.5.21 against 1 on
13.0.3 — a step there risks having no counterpart rather than a churned one. 9.5.21 additionally
puts a "Grafana managed / Mimir or Loki" radio-card choice in the middle of the flow that 13.0.3
hides behind an "Advanced options" toggle, so the step *count* differs, not just the selectors.
Kept as the documented second task if one gate task proves too thin.

### C — Add a datasource through settings, including Save-and-test (rejected)

Honest case for: `Save & test` is a genuine async round trip with a visible result, which nothing
in candidate A has.

Honest case against: it is short (one form), and the path itself churns — `/datasources/new` on
9.5.21 versus `/connections/datasources/new` on 13.0.3, where the 9.5.21 instance renders 8
controls at the newer path and 46 at its own. Both versions' "new datasource" page is a plugin
card list with **0 identifiable inputs**, so the first two steps would be locator-hostile for a
reason that is not interesting. It also fights the test-bed: the seeded datasource is
provisioned read-only, so the task would have to create a second one to avoid the 403 the seed
already logs.

## Decision

**The Track-1 gate task is `create-stat-dashboard-from-testdata`: 12 measured steps that build a
Stat panel over the seeded TestData datasource and save it as a named dashboard.**

Login and the 13.0.3 first-run dialog are **preamble**, not steps
([#60](https://github.com/DevToolie/Paragent/issues/60), `src/recorder/preamble.ts`).

| # | Step (intent) | Post-condition (observed) | Expected strength |
| --- | --- | --- | --- |
| 1 | Open the new-dashboard page | URL is `/dashboard/new`; `New dashboard` breadcrumb present | **strong** (`url-matches`, priority 6) |
| 2 | Add a visualisation to the empty dashboard | URL gains `editPanel=1`; `Edit panel` breadcrumb present | **strong** (`url-matches`, priority 3) |
| 3 | Open the visualisation picker | Picker search field visible | weak (`element-visible` on the click target) |
| 4 | Choose the **Stat** visualisation | Picker closes — the chosen card goes visible → hidden | **strong** (ADR-0007, priority 4) |
| 5 | Set the query alias to `{series_alias}` | Panel renders that alias as its series label | weak today → **strong** achievable (see below) |
| 6 | Set the series count to `{series_count}` | Panel renders that many values | weak today → **strong** achievable |
| 7 | Set the panel title to `{panel_title}` | `data-testid Panel header {panel_title}` present | weak today → **strong** achievable |
| 8 | Apply the panel / go back to the dashboard | URL drops `editPanel`; the titled panel is on the canvas | **strong** (`url-matches`, priority 3) |
| 9 | Open the save drawer | Dashboard-title field visible | weak (`element-visible` on the click target) |
| 10 | Set the dashboard title to `{dashboard_title}` | none independent of step 11 | **weak**, and honestly so |
| 11 | Save the dashboard | URL becomes `/d/{uid}/{slug}`; `Dashboard saved` alert; breadcrumb shows `{dashboard_title}` | **strong** (toast, priority 1) |
| 12 | Return to the dashboards list via the breadcrumb | URL is `/dashboards`; a link named `{dashboard_title}` is present | **strong** (`url-matches`, priority 3) |

### Assertability — what the compiler will actually synthesize

Predicted against the priority table in [gate/compiler.md](../gate/compiler.md) **as it stands
today**: **5 strong, 7 weak.** That is worse than a gate wants, and the reason is one rule:
"typed values are parameter slots… the compiler cannot assert *value equals X*; it emits weak
`element-visible` on the target control."

That rule is right in general and wrong for steps 5–7 specifically, which is why this task was
chosen over a form-shaped one: **each of those three typed values is rendered back into the page
by Grafana**, and was seen to be on both extremes.

- alias `paragent_series` → three stat labels reading `paragent_series` (9.5.21 and 13.0.3)
- series count `3` → three rendered values, countable in the panel
- panel title → `data-testid Panel header {panel_title}`, the same testid string on both
  versions (a `div` on 9.5.21, a `section` on 13.0.3)

So steps 5–7 can be `text-matches` / `count-equals` against a **template with a typed hole**,
which stores no literal and stays inside the parameter discipline. Doing it is
[#25](https://github.com/DevToolie/Paragent/issues/25)/[#61](https://github.com/DevToolie/Paragent/issues/61)
work, not this ADR's, and until it lands the floor is 5 strong. With it, **8 strong / 4 weak**.
Steps 3, 9 and 10 are honestly weak and should stay labelled weak: opening a picker or a drawer
and typing into a field with no rendered echo are all "consistent with success and with several
failures".

**If #25 cannot lift steps 5–7, this task should be revisited rather than measured** — a
majority-weak task cannot support the gate, and that is a decision point, not a detail.

### DOM-meaningfulness — the ADR-0003 open question, answered

**Conceded plainly: the task's outcome is API-equivalent.** One `POST /api/dashboards/db` with a
JSON body produces the same saved dashboard as all twelve steps.

That does not make the measurement vacuous, because the gate does not measure *whether the
outcome is reachable by API* — it measures whether a **compiled browser trajectory survives a
version bump**. Of the twelve steps, **eight touch state that has no API representation at
all**: steps 3 and 4 (visualisation picker open / choice) and steps 5–7, 9, 10 mutate
client-side editor state that exists only while the panel editor is open, and are transmitted to
the server exactly once, at step 11. There is no endpoint for "open the visualisation picker".

Per-step: steps 1, 2, 8, 12 are navigations/transitions whose *destination* an API could reach
directly but whose transition is a DOM act; steps 3–7, 9, 10 have no API counterpart; step 11 is
the one genuinely API-equivalent call in the task.

So ADR-0003's open question resolves to: **the task is browser-meaningful because eleven of its
twelve steps only exist in the DOM**, and it is honest to say that its *result* is not.

### Cross-version viability

Walked end to end on **9.5.21** and **13.0.3**; both completed and produced a listed dashboard.
Every step has a counterpart on both. What moved:

| Step | 9.5.21 | 13.0.3 |
| --- | --- | --- |
| 2 add panel | one click: `button` text "Add visualization", **`aria-label="Add new panel"`** | two acts: sidebar `data-testid sidebar add new panel` (a drag handle, `aria-label="Panel"`), then `button` "Configure visualization" |
| 3 viz picker | `[aria-label="toggle-viz-picker"]` toggle | right pane is already open on `Suggestions` / `All visualizations` tabs |
| 5, 6 query fields | `input[name="alias"]`, `input[name="seriesCount"]` | **identical** |
| 7 panel title | a bare `input` inside `[aria-label="Options group Panel options"]` — **no name, no testid, no aria-label** | `input[data-testid="data-testid Panel editor option pane field input Title"]` |
| 8 apply | `data-testid Apply changes and go back to dashboard`, text "Apply" | `data-testid Back to dashboard button`, text "Back to dashboard" |
| 9, 11 save | `aria-label="Save dashboard"` → drawer, `input[name="title"]`, `aria-label="Save dashboard button"` | `data-testid Save dashboard button` → drawer |
| 11 post-save | `/d/{uid}/{slug}`, `data-testid Alert success` "Dashboard saved" | **same** |
| 12 list | `input[placeholder="Search for dashboards"]` | `input[placeholder="Search for dashboards and folders"]` |

Two consequences worth stating before the number exists:

- **Step 2 is expected to fail on 12.x–13.x** and to need repair, because one recorded click
  became two acts. That is churn, and the gate should record it as such — but if it turns out to
  dominate the result, the honest response is to say so in the memo, not to re-cut the task
  afterwards.
- **Step 7's locator has nothing to hold on to on 9.5.21.** The recording is made on 9.5.21, so
  the recorded chain will be structural/positional and is the most likely source of *phantom*
  churn. Issue [#24](https://github.com/DevToolie/Paragent/issues/24) must diff two recordings
  and say whether that chain is stable run-to-run before this task is trusted.

Mid-matrix versions (10.x, 11.x, 12.x) were **not** walked by hand. The one thing already known
about them, from [#23](https://github.com/DevToolie/Paragent/issues/23), is that the nav changes
shape at 11 → 12; nothing in this task depends on the nav.

### Parameterisation

Six slots, no secrets — credentials are preamble and never enter the artifact:

| Slot | Type | Where it is typed | Rendered back? |
| --- | --- | --- | --- |
| `host` | `string` | base-URL template | n/a |
| `port` | `integer` | base-URL template | n/a |
| `series_alias` | `string` | step 5 | yes — series labels |
| `series_count` | `integer` | step 6 | yes — number of values |
| `panel_title` | `string` | step 7 | yes — panel header testid |
| `dashboard_title` | `string` | step 10 | yes — breadcrumb, list row, slug |

## Consequences

Easy: the task needs no fixture beyond the existing seed; the preamble already exists; the
recording target is `9.5.21`, which boots in ~27 s.

Hard: 12 steps against a running instance take real wall-clock per version, and step 7 has no
stable locator on the base version. The compiler must be taught to assert rendered typed values
(#25 / #61) or the task lands at 5 strong / 7 weak.

Forecloses (for now): the alert-rule task as *the* gate task. It stays documented as the
runner-up and as the obvious second task if one proves too thin.

## Reversal cost

**Moderate to high, and rising.** Today: re-record on the base version and re-compile — cheap,
because no matrix run has been published. After the matrix has been walked and a §9 number
published, changing the task invalidates the number and means re-recording, re-compiling and
re-running all eight versions. Signal to reverse *before* that point: #25 cannot strengthen
steps 5–7, or step 2's 13.0.3 split turns out to dominate step-validity.

## Open questions / what I could not verify

- Whether steps 5–7 actually compile to `text-matches` / `count-equals` against typed holes. It
  is possible from what the DOM renders, but the recorder's `assertion_hint` capture has not
  been exercised on this task — that is #24, and #25 is where it either works or does not.
- Whether the recorded step-7 locator (panel title on 9.5.21, which has no identity attributes)
  is stable across two recordings on the same instance. #24 must diff two runs; if it is not
  stable, that is phantom churn and must be fixed or documented before any number is quoted.
- Whether `{dashboard_title}` needs to be unique per run. Each matrix version boots a fresh
  instance so nothing collides today, but two runs against one instance would create two
  dashboards with the same title, and issue
  [#66](https://github.com/DevToolie/Paragent/issues/66) (repeat runs per version) will hit this.
- **A live blocker for #24, found while walking 13.0.3:** the preamble's first-run dialog check
  loses a race. On a fresh 13.0.3 container the Assistant dialog mounts **178 ms after
  `establishSession` returns**, so `dismissed_first_run_modal` reports `false` and the dialog
  covers step 1. Once actually dismissed it stays dismissed for the container's lifetime, even
  in a fresh browser context — so the dismissal is server-side, and `gate/testbed.md`'s
  "nothing persists the dismissal" is true only across `--down`, not within a boot. The
  preamble must wait for the dialog rather than sample for it.
- Mid-matrix versions were not walked by hand (see above); the first matrix run is where 10.x,
  11.x and 12.x get inspected.
- Whether a dashboards-list **search** step should replace step 12's plain breadcrumb return.
  Search is more DOM work and would make step 12 assert a filtered list rather than a full one,
  but the task is already at the PRD's 12-step ceiling.
