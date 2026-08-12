---
title: Documentation index
doc_type: brief
status: review
owner: D2
created: 2026-07-24
updated: 2026-08-11
confidence: HIGH
supersedes: null
sources_verified: true
---

# docs/ — map

Live index. Update this file when you add or supersede a document — `npm run lint:docs`
fails the build on any `docs/*.md` this file does not link to, so it cannot go quietly stale.
Reading order: **[README-narrative.md](./README-narrative.md)** (~20 min).
Current state and what to work on: **[ROADMAP.md](./ROADMAP.md)**.
How to run and ship: **[DEVELOPMENT.md](./DEVELOPMENT.md)**.
Integrity surface: **[INTEGRITY-AUDIT.md](./INTEGRITY-AUDIT.md)**.

**Last true for this index:** 2026-07-25 (B0, post milestone/issue restructure).  
**Vertical lock:** **none** — Track-2 C5 **FAIL** ([research/vertical-search/DECISION.md](./research/vertical-search/DECISION.md); [ADR-0004](./decisions/ADR-0004-vertical-track2-fail.md)). Do not invent a lock.

| Column | Meaning |
| --- | --- |
| Status | Frontmatter `status` |
| Last true | Date facts were last verified / written |
| Supersedes / notes | What this replaces, or what it does *not* decide |

---

## Start here

| Doc | What it is | Status | Last true | Supersedes / notes |
| --- | --- | --- | --- | --- |
| [ROADMAP.md](./ROADMAP.md) | Current state, what is stubbed, milestones M0–M7 in order | accepted | 2026-07-25 | **Read before picking up an issue** |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Commands, layout, data flow, invariants, pre-PR checklist | accepted | 2026-07-25 | Contributor runbook |
| [architecture.md](./architecture.md) | How the `src/` packages connect: loop diagram, package/artifact tables, real vs stubbed, invariants | draft | 2026-07-25 | Owns the **chain** between packages; `gate/*.md` own one hop each. Records two unwired hops (issue #52) |
| [README-narrative.md](./README-narrative.md) | Story: thesis → census kill → pivot → two tracks → evidence now | draft | 2026-07-25 | Includes C5 FAIL |
| [INTEGRITY-AUDIT.md](./INTEGRITY-AUDIT.md) | Unsourced claims, placeholders, LOW load-bearing, contradictions | draft | 2026-07-25 | Surfaces conflicts; does not pick winners |
| [README-internal.md](./README-internal.md) | Internal entry point: status table, tracks, public-repo rules, layout, stack | accepted | 2026-08-10 (moved from repo root, content unchanged) | Was `../README.md` until the root became visitor-facing. Track 2 **FAIL** / Track 3 Wave-1 draft match C5 + ADR-0004; INTEGRITY-AUDIT D-04 resolved |
| [../README.md](../README.md) | Repo root **landing page** for first-time visitors: hook, 60-second try-it, where-this-fits | living | 2026-08-10 | Marketing surface only. Carries no metrics — status of record lives in [README-internal.md](./README-internal.md) |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Hard rules + YAML frontmatter standard | living | 2026-07-24 | Doc-shape source of truth |

---

## Decisions (ADRs)

| Doc | What it is | Status | Last true | Triggered by |
| --- | --- | --- | --- | --- |
| [ADR-0001](decisions/ADR-0001-typescript-node-playwright.md) | TypeScript + Node + Playwright stack | accepted | 2026-07-24 | Wave-0 parallel Track-1 agents + typed contracts |
| [ADR-0002](decisions/ADR-0002-repo-privacy.md) | Repo ALL-PRIVATE; still no secrets in git | **superseded** | 2026-07-24 | Superseded by ADR-0005 — historical only |
| [ADR-0003](decisions/ADR-0003-testbed-grafana-oss.md) | Grafana OSS self-hosted Track-1 test-bed | accepted | 2026-07-25 | Pivot Track 1 (no partner / no SaaS ToS) |
| [ADR-0004](decisions/ADR-0004-vertical-track2-fail.md) | Track-2 vertical **FAIL** — no surface lock | accepted | 2026-07-25 | [C5 DECISION.md](research/vertical-search/DECISION.md) after C4 kills |
| [ADR-0005](decisions/ADR-0005-repo-public.md) | Repo is **PUBLIC**, single tree, nothing stripped | accepted | 2026-07-25 | Supersedes ADR-0002; founder decision on issue #42 |
| [ADR-0006](decisions/ADR-0006-track1-gate-task.md) | Track-1 gate task = build + save a TestData Stat dashboard (12 steps) | accepted | 2026-07-28 | Issue #59. Walked by hand on 9.5.21 and 13.0.3; answers ADR-0003's "browser-meaningful" question |
| [ADR-0007](decisions/ADR-0007-post-action-visibility.md) | `visible_landmarks` filtered for real; new `post_action_target_visible` | accepted | 2026-07-26 | Issue #71, out of PR #70 |
| [ADR-0008](decisions/ADR-0008-wait-step-duration.md) | Recorded `wait` duration carried through as `wait_ms`, replacing the `networkidle` fallback for recorder output | accepted | 2026-08-03 | Issue #83 |
| [ADR-0009](decisions/ADR-0009-cache-confidence.md) | Confidence decay (EWMA α=0.3), invalidation below 0.5, repair rewrite; `invalidated_at` + `repair_provenance` | accepted | 2026-08-03 | Issue #64. Thresholds are **chosen defaults, not measured** |
| [ADR-0010](decisions/ADR-0010-amortization-cost-model.md) | One-time `cost_program_build` split from per-run `cost_fresh`; amortization is `no_data` without a measured payment; a recompile is a visible second payment | accepted | 2026-08-11 | Issue #123, before #39 lands a baseline. **No value measured yet** — the split is argued from arithmetic |
| [ADR-0011](decisions/ADR-0011-replay-wall-clock-budget.md) | Per-run wall-clock budget (5 min default); new `BUDGET_EXHAUSTED` outcome; unreached steps emit no row and the shortfall is reported (`steps_attempted`, `truncation`) | accepted | 2026-08-11 | Issue #84. Default is derived from per-step ceilings, **not** from an observed run-duration distribution |
| [ADR-0012](decisions/ADR-0012-repair-context-budget.md) | Repair context budget: `interactive` (role + accessible name), never input values; `serializeRepairContext()` is the only egress | accepted | 2026-08-11 | Issue #125. Blocks #27 in substance |
| [ADR-0013](decisions/ADR-0013-cache-program-entity.md) | Program entity in the cache (`program_id`, `steps_total`, `compiled_at`); a partial hit is a **MISS**; completeness fails closed while confidence stays advisory | accepted | 2026-08-11 | Issue #120. Precondition for #118. **Nothing reads the cache yet** — the resolver has no caller outside its tests |
| [ADR-0014](decisions/ADR-0014-cache-read-path.md) | Cache read path: a hit is `program_source == "cache"` **and** `replay_valid`, stored as two fields not one; `pool_only` scope makes tenant rows invisible to a cross-tenant reader | accepted | 2026-08-11 | Issue #118. Unblocks #67. `--from-cache` is opt-in; **no hit-rate measured yet** |

---

## PRD / briefs

| Doc | What it is | Status | Last true | Supersedes / notes |
| --- | --- | --- | --- | --- |
| [prd/README.md](prd/README.md) | Folder map | accepted | 2026-07-25 | — |
| [PRD v0.2](prd/PRD-trajectory-cache-v0.2.md) | Mechanism, §6 privacy, §9 *proposed* gates, build plan | accepted | 2026-07-29 | §8 selection rule superseded by pivot; **§8 residual + §9 status now redirected by the [v0.4 addendum](prd/PRD-v0.4-addendum.md)** |
| [Pivot brief v0.3](prd/pivot-brief-v0.3.md) | Structural finding + counterparty rule + two-track plan | accepted | 2026-07-24 | **Supersedes PRD §8 selection rule**; trigger A8 FAIL; Wave-2 lock later FAIL (C5) |
| [PRD v0.4 addendum](prd/PRD-v0.4-addendum.md) | §8 anchor redirect, §9 thresholds labelled **proposed**, kill-line precedence | accepted | 2026-07-29 | Resolves INTEGRITY-AUDIT D-02 / D-03 / D-06; **§9 controls** the Track-1 gate, pivot's ~50% is shorthand |

---

## Research — Week-0 census (FAILED — preserve)

| Doc | What it is | Status | Last true | Notes |
| --- | --- | --- | --- | --- |
| [census-week0/README.md](research/census-week0/README.md) | Archive index | killed | 2026-07-24 | Observability anchor killed |
| [A1-datadog.md](research/census-week0/A1-datadog.md) | Scout | killed | 2026-07-24 | Enumeration only |
| [A2-grafana.md](research/census-week0/A2-grafana.md) | Scout | killed | 2026-07-24 | Enumeration only |
| [A3-sentry.md](research/census-week0/A3-sentry.md) | Scout | killed | 2026-07-24 | Enumeration only |
| [A4-adversary.md](research/census-week0/A4-adversary.md) | **51/70 FULLY_API** kill list | killed | 2026-07-24 | Primary Week-0 falsification |
| [A5-evidence.md](research/census-week0/A5-evidence.md) | Frequency/pain proxies | killed | 2026-07-24 | Many LOW — A8 warns |
| [A6-tos.md](research/census-week0/A6-tos.md) | ToS overlay | killed | 2026-07-24 | HIGH for DD/GC |
| [A7-backup.md](research/census-week0/A7-backup.md) | Backup wedge notes | killed | 2026-07-24 | Historical; **not** a lock (C5/C4 close QAuto path) |
| [A8-DECISION.md](research/census-week0/A8-DECISION.md) | **FAIL**, 2/70 survivors | killed | 2026-07-24 | First vertical FAIL |

---

## Research — vertical search (Track 2)

| Doc | What it is | Status | Last true | Notes |
| --- | --- | --- | --- | --- |
| [vendor-security…](research/vertical-search/vendor-security-questionnaires-trust-portals.md) | C1 scout | draft | 2026-07-24 | Hypothesis; C4/C5 kill |
| [procurement…](research/vertical-search/procurement-supplier-onboarding.md) | C1 scout | draft | 2026-07-24 | C4 ERODING; C5 FAIL |
| [healthcare…](research/vertical-search/healthcare-payer-portals.md) | C2 scout | draft | 2026-07-24 | C4 ALREADY_SOLVED |
| [insurance…](research/vertical-search/insurance-broker-carrier-portals.md) | C2 scout | draft | 2026-07-24 | C4 ALREADY_SOLVED |
| [freight…](research/vertical-search/freight-carrier-customs-portals.md) | C3 scout | draft | 2026-07-24 | C4 ALREADY_SOLVED |
| [regulatory…](research/vertical-search/regulatory-government-filing-portals.md) | C3 scout | draft | 2026-07-24 | C4 ALREADY_SOLVED |
| [adversary-report.md](research/vertical-search/adversary-report.md) | C4 durability attack — 6/6 killed | draft | 2026-07-25 | Attack only |
| [DECISION.md](research/vertical-search/DECISION.md) | C5 adjudication — **FAIL**, 2/75, 0 DURABLE | accepted | 2026-07-25 | **No lock**; second consecutive vertical FAIL |

---

## Gate (Track 1)

| Doc | What it is | Status | Last true | Notes |
| --- | --- | --- | --- | --- |
| [testbed.md](gate/testbed.md) | Grafana OSS matrix | draft | 2026-07-25 | ADR-0003 |
| [recorder.md](gate/recorder.md) | Recorder | draft | 2026-07-24 | — |
| [compiler.md](gate/compiler.md) | Compiler | draft | 2026-07-24 | — |
| [runner.md](gate/runner.md) | Replay / repair | draft | 2026-07-24 | Measured gate number pending |
| [cache.md](gate/cache.md) | Persistence, confidence, repair rewrite | draft | 2026-08-03 | ADR-0009; confidence **never gates** the measurement |
| [assertion-audit.md](gate/assertion-audit.md) | Assertion-strength audit of the live bundle | draft | 2026-07-30 | Issue #61; found a strong assertion that is not load-bearing live (locator staleness, #24) |
| [../experiments/gate-v1/README.md](../experiments/gate-v1/README.md) | Throwaway harness | draft | 2026-07-25 | Empty → `no_data` |

---

## Privacy

| Doc | What it is | Status | Last true | Notes |
| --- | --- | --- | --- | --- |
| [boundary-spec.md](privacy/boundary-spec.md) | Write-time allowlist | review | 2026-07-24 | PRD §6; canary merge-blocking |
| [session-custody.md](privacy/session-custody.md) | Session-custody checklist + gap analysis | draft | 2026-08-11 | PRD §7; distinct from §6's pooling allowlist — see doc. SC-01 closed by #98; SC-02/04 enforced; SC-03/05/06 open (#100, #102, #103) |
| [session-state-encryption.md](privacy/session-state-encryption.md) | SC-01 mechanism: threat model per environment, the envelope, and what key custody v1 **defers** | accepted | 2026-08-11 | Issue #98. A capability with **no callers** — nothing persists session material yet, and this does not change that |

---

## Pitch (Track 3)

| Doc | What it is | Status | Last true | Notes |
| --- | --- | --- | --- | --- |
| [pitch/README.md](pitch/README.md) | Pack index | draft | 2026-07-25 | D2 refreshed for C5; some objections prose may lag — INTEGRITY-AUDIT |
| [one-pager.md](pitch/one-pager.md) | One-pager | draft | 2026-07-25 | Wave-1 draft |
| [narrative.md](pitch/narrative.md) | Pitch narrative | draft | 2026-07-25 | Wave-1 draft |
| [deck-outline.md](pitch/deck-outline.md) | Deck outline | draft | 2026-07-25 | Residual slides may lag C5 — INTEGRITY-AUDIT D-01 / E-12 |
| [objections.md](pitch/objections.md) | Objection handling | draft | 2026-07-25 | Two FAILs present tense (D-07); residual prose flagged E-12 |
| [proof-points.md](pitch/proof-points.md) | Claim register | draft | 2026-07-25 | Diligence map |

---

## Contracts

| Doc | What it is | Notes |
| --- | --- | --- |
| [../contracts/](../contracts/) | trajectory / assertion / cache-row / metrics | Integration surface |

---

## Work tracking

Milestones **M0 → M7** on the GitHub issue board are the execution plan; the same sequence,
with current implementation state and what is stubbed, is in [ROADMAP.md](./ROADMAP.md).
M0–M4 are strictly sequential (each milestone's exit criterion is the next one's
precondition); M5 and M7 can run in parallel; M6 is blocked on the M4 gate number.

## Open questions / what I could not verify

- ~~Root README Track 2/3 status lines are still stale (INTEGRITY-AUDIT D-04) — tracked as issue #54.~~
  **Resolved** — the root README status table now records Track 2 as FAIL and Track 3 as a
  Wave-1 draft, both citing in-repo artifacts. The residual deck/objections prose flagged by
  D-01 and E-12 is a separate, still-open lag.
- Founder post-Track-1 choice (intermediary reframe vs shut search) — C5 next action; not decided in docs.
- Measured gate number — still unset; do not invent.
- Whether to buy GitHub Secret Protection. Non-provider patterns and validity checks are
  entitlement-blocked on the org's free plan — attempted and verified 2026-07-25, see
  [ADR-0005](decisions/ADR-0005-repo-public.md) Consequences. Founder cost call.
