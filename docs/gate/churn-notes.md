---
title: "Gate — qualitative DOM churn notes per version transition (#30)"
doc_type: gate-result
status: draft
owner: B1
created: 2026-08-21
updated: 2026-08-21
confidence: MED
supersedes: null
sources_verified: true
---

# Gate — qualitative DOM churn notes (#30)

Qualitative companion to the PRD §9 gate number: what the DOM is *expected* to do across
the Grafana OSS matrix pins, what this repo has *already observed*, and what is still
**unknown** until a live matrix run attributes step failures.

This is **not** a §9 measurement. No failure rates, survival rates, or PASS/FAIL verdicts
appear here. [`docs/gate/runner.md`](./runner.md) still records the measured gate number as
pending; dry-run matrix rows are not evidence.

## Scope and honesty

**Observed** means something was booted and inspected in-repo, with a citation.
**Predicted** means `churn_role` text from
[`scripts/testbed/matrix.json`](../../scripts/testbed/matrix.json) (release-note / design intent).
**Unknown** means no live per-version gate replay has mapped failing compiled steps to a
mechanism for that transition — the full issue #30 method (open A, open B, diff task
surfaces, cross-check `metrics.ndjson`) has not been completed for mid-matrix pins.

### Proxy caveat (do not drop)

From [`docs/gate/testbed.md`](./testbed.md): **version-bump churn is a PROXY for organic
production churn.** Accelerated upgrades across pinned OSS tags measure survival across
vendor-shipped redesigns. They are not gradual feature-flag rollouts, tenant plugins, CDN
shards without a semver bump, or human workflow drift. Do not quote anything below as
“production churn.”

A second asterisk also applies whenever a gate number *does* exist later: recordings so far
are hand-picked locators (`agent_model: human`), an upper bound on agent-recorded survival
([`docs/gate/testbed.md`](./testbed.md), [`docs/gate/recorder.md`](./recorder.md)).

### What already exists vs what does not

| Artifact | Status |
| --- | --- |
| `matrix.json` `churn_role` per pin | Written (prediction) |
| Login-surface dump across all eight pins | Observed 2026-07-27 ([`recorder.md`](./recorder.md)) |
| Test-bed boot / seed / panel render per pin | Observed ([`testbed.md`](./testbed.md)) |
| Nav / first-run chrome notes | Observed ([`testbed.md`](./testbed.md)) |
| Gate-task walk at matrix extremes (9.5.21, 13.0.3) | Observed in [ADR-0006](../decisions/ADR-0006-track1-gate-task.md) — cited only where it speaks to endpoints, not mid-matrix |
| Live matrix step failures → mechanism map | **Unknown** — no published §9 / NDJSON attribution yet |
| Mid-matrix (10.x / 11.x / 12.x) hand walk of the gate task | **Unknown** (ADR-0006 states this explicitly) |

**Phantom-churn caveat** ([`assertion-audit.md`](./assertion-audit.md)): on the *same*
version the trajectory was recorded against (`9.5.21`), structural/positional assertion
locators for steps 2–4 already failed live. A later matrix failure is not automatically
“version churn” until the base version is clean.

---

## Transitions

Version ids are the matrix pins (`9.5.21` → `10.0.13`, etc.). `churn_role` quotes are from
`matrix.json` for the **destination** pin (why that tag is in the matrix).

### 9.5.21 → 10.0.13

1. **Predicted (`churn_role` on 10.0.13):** Grafana 10 — Scenes library public preview;
   navigation / search changes.
2. **Observed in-repo:** Login identity is **unchanged** across this boundary — both pins
   use aria-label username/password/submit naming (`Login button` accessible name). Stable
   selectors `input[name="user"]`, `input[name="password"]`, `button[type="submit"]` work on
   both ([`recorder.md`](./recorder.md)). Post-login landing stays `/?orgId=1` through
   11.0.0. No gate-task step-level DOM diff for this pair is recorded in the gate docs.
3. **Unknown:** Whether Scenes-preview / nav-search changes break any compiled gate-task
   step. Needs a live matrix (or hand walk of task surfaces on both pins).

### 10.0.13 → 10.4.19

1. **Predicted (`churn_role` on 10.4.19):** late v10 — pre–Scenes-GA dashboard surface.
2. **Observed in-repo:** **Login identity churns once here** (and stays in the new shape
   through 13.0.3). Username loses `aria-label` for a labelled + `data-testid` field;
   submit loses `aria-label="Login button"` (accessible name becomes `Log in`) and gains
   `data-testid="data-testid Login button"`. Documented 2026-07-27
   ([`recorder.md`](./recorder.md)). Preamble deliberately keys on stable `name=` / submit
   type — scaffolding, not a measured step.
3. **Unknown:** Whether the “pre–Scenes-GA dashboard surface” prediction produces gate-task
   locator breaks beyond login scaffolding. No mid-matrix task walk; no NDJSON map.

### 10.4.19 → 11.0.0

1. **Predicted (`churn_role` on 11.0.0):** Grafana 11 — Scenes-powered dashboards; edit mode;
   alert detail redesign.
2. **Observed in-repo:** Login shape is continuous with 10.4.19 (same labelled / testid
   form through 13.0.3) ([`recorder.md`](./recorder.md)). Landing URL still `/?orgId=1`
   through 11.0.0. Alert-detail redesign is out of scope for the ADR-0006 gate task (dashboard
   build, not alerting). No pin-pair DOM dump of dashboard edit surfaces for 10.4 → 11.0.
3. **Unknown:** Scenes-powered dashboard / edit-mode impact on compiled steps. Mid-matrix
   not walked (ADR-0006).

### 11.0.0 → 11.5.2

1. **Predicted (`churn_role` on 11.5.2):** mid/late v11 — Scenes GA era (11.3+) consolidation.
2. **Observed in-repo:** Post-login landing URL gains
   `&from=now-6h&to=now&timezone=browser` from **11.5.2 onward** (through 13.0.3); preamble
   waits for “no longer on `/login`” and does not assert an exact URL
   ([`recorder.md`](./recorder.md)). Login field identity unchanged vs 10.4.19+. No documented
   gate-task chrome diff specific to this minor/mid span.
3. **Unknown:** Whether “Scenes GA consolidation” moves any measured dashboard-edit control.
   Live matrix / hand walk required.

### 11.5.2 → 12.0.0

1. **Predicted (`churn_role` on 12.0.0):** Grafana 12 — Angular removal; dynamic dashboards /
   new schema experiments; UI themes.
2. **Observed in-repo:** [`testbed.md`](./testbed.md) records that **12.0.0** decorates the
   Drilldown nav item with a `New!` badge, and that **12.x / 13.x** replace burger-menu nav
   with a docked sidebar — “Expect locator churn across the 11 → 12 boundary.” ADR-0006 notes
   the gate task itself does not depend on the nav, but chrome around the task may still
   move. No compiled-step failure list for this transition exists yet.
3. **Unknown:** Which (if any) measured steps break at Angular removal / dynamic-dashboard
   experiments; whether the nav/sidebar change is inert for the ADR-0006 path or not.
   Attribution needs live matrix NDJSON.

### 12.0.0 → 12.2.1

1. **Predicted (`churn_role` on 12.2.1):** mid v12 — continued Drilldown / dashboard workflow
   churn.
2. **Observed in-repo:** Both pins are in the docked-sidebar era noted in
   [`testbed.md`](./testbed.md). No separate login change (still the post-10.4.19 shape)
   ([`recorder.md`](./recorder.md)). No pin-pair task-surface diff documented between 12.0.0
   and 12.2.1.
3. **Unknown:** Whether “continued Drilldown / dashboard workflow churn” hits any compiled
   gate step between these two pins. Unknown until live matrix or hand walk.

### 12.2.1 → 13.0.3

1. **Predicted (`churn_role` on 13.0.3):** current major tip of matrix (Docker Hub tag
   verified 2026-07-25) — prediction is “tip of matrix,” not a named UI redesign.
2. **Observed in-repo:**
   - **First-run “Grafana Assistant is now available to OSS users” modal** on fresh 13.0.3
     containers only — occlusion (Playwright `isVisible()` is not occlusion-aware); dismissed
     in preamble; once per container, dismissal stored server-side
     ([`testbed.md`](./testbed.md), [`recorder.md`](./recorder.md)).
   - Span-level gate-task diffs were walked at the **matrix extremes** (9.5.21 vs 13.0.3),
     not as an isolated 12.2 → 13.0 delta ([ADR-0006](../decisions/ADR-0006-track1-gate-task.md)):
     e.g. add-panel becomes two acts on 13.0.3; viz picker / apply / save control identities
     change; TestData `alias` / `seriesCount` inputs stay identical; list search placeholder
     text widens. Those observations describe 9.5↔13.0, **not** which change landed between
     12.2.1 and 13.0.3 specifically.
3. **Unknown:** Which of the extreme-span diffs are new at 13.0.3 vs already present on
   12.2.1; step→mechanism map from live matrix metrics.

---

## Prediction vs observation (so far)

| Transition | Release-note-style prediction | Verified DOM signal in gate docs | Match? |
| --- | --- | --- | --- |
| 9.5 → 10.0 | Scenes preview; nav/search | Login stable; no task-surface note | **Unevaluated** for the gate task |
| 10.0 → 10.4 | Pre–Scenes-GA dashboard | **Login identity churn** (not named in `churn_role`) | Prediction silent on login; observation is login |
| 10.4 → 11.0 | Scenes dashboards; edit mode; alerts | Login continuous; no task dump | **Unevaluated** |
| 11.0 → 11.5 | Scenes GA consolidation | Landing query-string change only | Weak / scaffolding-only signal |
| 11.5 → 12.0 | Angular removal; dynamic dashboards; themes | Nav burger → docked sidebar; Drilldown `New!` | Nav chrome observed; task steps **unknown** |
| 12.0 → 12.2 | Drilldown / dashboard workflow | No pin-pair note | **Unevaluated** |
| 12.2 → 13.0 | Matrix tip | Assistant first-run modal; extreme-span task diffs not isolated to this hop | Partial |

Finding already available without a §9 number: **vendor-facing `churn_role` text did not
predict the one sharp login identity break** (at 10.4.19). That supports the issue’s claim that
changelogs are an incomplete churn signal — for scaffolding, at least. It does **not**
justify inventing a selector-breakage percentage for the measured task.

---

## Still required for issue #30 completion

Per the issue method, still open until a live matrix (or equivalent per-transition DOM capture
cross-checked against metrics NDJSON) exists:

- [ ] Failing compiled steps mapped to named mechanisms per transition
- [ ] Surviving steps explained (locator-strategy feedback into [`compiler.md`](./compiler.md))
- [ ] Release-note prediction accuracy assessed with task-surface evidence, not login-only
- [ ] Every claim cross-checked against `experiments/gate-v1/out/metrics.ndjson`

Until then this file is a **catalogue of predictions + already-verified observations**, not a
gate result in the §9 sense. Status stays `draft`; confidence `MED` because mid-matrix task
surfaces remain unknown.

## Open questions / what I could not verify

- **No live matrix §9 number or NDJSON attribution** exists to cross-check qualitative notes
  against failing compiled steps. Inventing rates would violate integrity rules; this doc
  therefore stops at observed vs predicted.
- Mid-matrix pins (10.0.13, 10.4.19, 11.0.0, 11.5.2, 12.0.0, 12.2.1) were **not** walked for
  the ADR-0006 gate-task surfaces; only login dumps (all eight) and extreme-span task walks
  (9.5.21 / 13.0.3) are verified.
- Which extreme-span DOM diffs (ADR-0006 table) first appear at which hop between 9.5 and 13.0
  is unknown without per-transition capture.
- Whether structural-locator flakiness on base 9.5.21 ([`assertion-audit.md`](./assertion-audit.md))
  would dominate any early matrix failures (phantom churn vs version churn).
