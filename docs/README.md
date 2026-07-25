---
title: Documentation index
doc_type: brief
status: review
owner: D2
created: 2026-07-24
updated: 2026-07-25
confidence: HIGH
supersedes: null
sources_verified: true
---

# docs/ — map

Live index. Update this file when you add or supersede a document.
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
| [architecture.md](./architecture.md) | How the six `src/` packages connect: loop diagram, package/artifact tables, real vs stubbed, invariants | draft | 2026-07-25 | Owns the **chain** between packages; `gate/*.md` own one hop each. Records two unwired hops (issue #52) |
| [README-narrative.md](./README-narrative.md) | Story: thesis → census kill → pivot → two tracks → evidence now | draft | 2026-07-25 | Includes C5 FAIL |
| [INTEGRITY-AUDIT.md](./INTEGRITY-AUDIT.md) | Unsourced claims, placeholders, LOW load-bearing, contradictions | draft | 2026-07-25 | Surfaces conflicts; does not pick winners |
| [../README.md](../README.md) | Repo root status | living | 2026-07-25 | May lag Track 3 / C5 — see INTEGRITY-AUDIT |
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

---

## PRD / briefs

| Doc | What it is | Status | Last true | Supersedes / notes |
| --- | --- | --- | --- | --- |
| [prd/README.md](prd/README.md) | Folder map | accepted | 2026-07-25 | — |
| [PRD v0.2](prd/PRD-trajectory-cache-v0.2.md) | Mechanism, §6 privacy, §9 *proposed* gates, build plan | accepted | 2026-07-24 | §8 **selection rule** superseded by pivot; residual §8 still names Datadog / Grafana Cloud |
| [Pivot brief v0.3](prd/pivot-brief-v0.3.md) | Structural finding + counterparty rule + two-track plan | accepted | 2026-07-24 | **Supersedes PRD §8 selection rule**; trigger A8 FAIL; Wave-2 lock later FAIL (C5) |

---

## Research — Week-0 census (FAILED — preserve)

| Doc | What it is | Status | Last true | Notes |
| --- | --- | --- | --- | --- |
| [census-week0/README.md](research/census-week0/README.md) | Archive index | killed | 2026-07-24 | Observability anchor killed |
| [A1](research/census-week0/A1-datadog.md)–[A3](research/census-week0/A3-sentry.md) | Scouts | killed | 2026-07-24 | Enumeration only |
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
| [../experiments/gate-v1/README.md](../experiments/gate-v1/README.md) | Throwaway harness | draft | 2026-07-25 | Empty → `no_data` |

---

## Privacy

| Doc | What it is | Status | Last true | Notes |
| --- | --- | --- | --- | --- |
| [boundary-spec.md](privacy/boundary-spec.md) | Write-time allowlist | review | 2026-07-24 | PRD §6; canary merge-blocking |

---

## Pitch (Track 3)

| Doc | What it is | Status | Last true | Notes |
| --- | --- | --- | --- | --- |
| [pitch/](pitch/) | Wave-1 pack | draft | 2026-07-25 | D2 refreshed for C5; some objections prose may lag — INTEGRITY-AUDIT |
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

- Root README Track 2/3 status lines are still stale (INTEGRITY-AUDIT D-04) — tracked as issue #54.
- Founder post-Track-1 choice (intermediary reframe vs shut search) — C5 next action; not decided in docs.
- Measured gate number — still unset; do not invent.
- Whether to buy GitHub Secret Protection. Non-provider patterns and validity checks are
  entitlement-blocked on the org's free plan — attempted and verified 2026-07-25, see
  [ADR-0005](decisions/ADR-0005-repo-public.md) Consequences. Founder cost call.
