---
title: Documentation narrative — twenty-minute reconstruct
doc_type: brief
status: draft
owner: D2
created: 2026-07-25
updated: 2026-07-25
confidence: HIGH
supersedes: null
sources_verified: true
---

# Paragent — story in reading order

Twenty-minute reconstruct for an advisor, hire, or investor. Load-bearing facts cite in-repo sources. **No invented metrics.** **No vertical is locked.**

Suggested path:

1. This page
2. [A8-DECISION.md](./research/census-week0/A8-DECISION.md) — first kill
3. [pivot-brief-v0.3.md](./prd/pivot-brief-v0.3.md) — structural fix
4. [adversary-report.md](./research/vertical-search/adversary-report.md) — Track-2 attack
5. [DECISION.md](./research/vertical-search/DECISION.md) — second kill (C5 FAIL)
6. [proof-points.md](./pitch/proof-points.md) — PROVEN vs ASSUMED
7. [INTEGRITY-AUDIT.md](./INTEGRITY-AUDIT.md) — where docs disagree

---

## 1. Original thesis

Paragent is a **stateful execution layer** for browser agents: record → compile with **post-condition assertions** → replay → repair ([repo README](../README.md); [PRD v0.2](./prd/PRD-trajectory-cache-v0.2.md)).

Bet: **compilation, not compression** — amortize reasoning across repeats; pool structural trajectories only behind a write-time privacy allowlist ([PRD §3 / §6](./prd/PRD-trajectory-cache-v0.2.md); [boundary-spec.md](./privacy/boundary-spec.md)).

Pre-seed: thesis unproven; **measured gate number pending**; inventing performance numbers is forbidden ([CONTRIBUTING](../CONTRIBUTING.md)).

---

## 2. Census that killed the first anchor

Week-0 tested SaaS **observability config** (Datadog, Grafana Cloud, Sentry).

| Fact | Source |
| --- | --- |
| Verdict **FAIL** | [A8](./research/census-week0/A8-DECISION.md), 2026-07-24 |
| Survivors **2 / 70** | A8 |
| ≤2 survivors → FAIL applied | A8 |
| **51 / 70 FULLY_API** | A8 ← [A4](./research/census-week0/A4-adversary.md), access_date 2026-07-24 |
| Highest pain often on FULLY_API tasks | A8 |
| DD/GC console-agent ToS **HIGH** | [A6](./research/census-week0/A6-tos.md) |

Archive: [census-week0/](./research/census-week0/) — asset, not embarrassment.

---

## 3. Structural insight

> Vendors API what **their customers** do repeatedly → high-frequency and permanently browser-only barely coexist when the laborer is the vendor’s customer.

Sources: [pivot §1](./prd/pivot-brief-v0.3.md); [census README](./research/census-week0/README.md); A8 narrative.

---

## 4. Pivot

Invert the user ([pivot §2–3](./prd/pivot-brief-v0.3.md)): target **counterparty** labor (guest on someone else’s portal; multiplicity across portals). New selection rule supersedes PRD §8.

Six surfaces scouted (search space): security questionnaires, healthcare payers, freight/customs, insurance appointments, procurement onboarding, government filing ([vertical-search/](./research/vertical-search/)).

---

## 5. Two tracks

| Track | Question | Status (2026-07-25) |
| --- | --- | --- |
| **1 Mechanism** | Do compiled trajectories survive churn? | Harness on Grafana OSS ([ADR-0003](./decisions/ADR-0003-testbed-grafana-oss.md)); **measured number pending**. PRD §9 proposes gates — not results. |
| **2 Vertical** | Does counterparty hold? | **FAIL** — [C5 DECISION](./research/vertical-search/DECISION.md); [ADR-0004](./decisions/ADR-0004-vertical-track2-fail.md) |
| **3 Narrative** | Tell the truth | Wave-1 pitch draft; D2 refreshed for C5 |

---

## 6. Where evidence stands now

### Proven

- Week-0 FAIL + 51 FULLY_API — A8/A4.
- Track-2 FAIL: **2 / 75** survivors, **0 DURABLE** surfaces, no lock — C5 / C4 / ADR-0004.
- Wrong thesis C5 names: counterparty shape alone ≠ durable empty browser-only market — rails or intermediaries absorb high-frequency jobs ([DECISION.md](./research/vertical-search/DECISION.md) kill-list narrative).
- Stack / privacy mode / Grafana OSS bed — ADR-0001–0003.
- Contracts + privacy allowlist spec — [contracts/](../contracts/), boundary-spec.

### Pending / do not invent

- All replay / cost / churn survival figures — **[PENDING TRACK-1]**.
- Founder choice after Track-1 number: reframe to sell-to-intermediaries vs shut vertical search — C5 next-action box; **not decided**.

### Two consecutive FAILs

Week-0 observability FAIL + Track-2 counterparty FAIL is a **thesis signal**, not only bad anchors (C5 evidence-quality + decision narrative). Company now depends on Track-1 proving the mechanism.

---

## Open questions / what I could not verify

- Exact financing ask — founder only.
- Whether pitch objections still deny “two FAILs” in residual sentences — see INTEGRITY-AUDIT.
- Primary portals-per-FTE telemetry — absent (C5 OQ).
