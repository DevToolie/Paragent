---
title: Pitch deck outline (Wave 1 draft)
doc_type: pitch
status: draft
owner: D1
created: 2026-07-25
updated: 2026-08-12
confidence: MED
supersedes: null
sources_verified: true
---

# Deck outline — slide by slide

Compression of [`narrative.md`](./narrative.md). One point per slide. Vertical: **FAIL — no surface locked** ([DECISION.md](../research/vertical-search/DECISION.md); [ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md)).

| # | Title | One point | Evidence | Source / status |
| --- | --- | --- | --- | --- |
| 1 | Paragent | Stateful execution layer for browser agents: record → compile with assertions → replay → repair | Product definition in repo README | [README.md](../../README.md) — PROVEN as stated intent; mechanism unproven |
| 2 | Pre-seed honesty | Thesis unproven; gate number pending; no invented metrics | Explicit pre-seed framing | [README.md](../../README.md) — PROVEN |
| 3 | The trap | High-frequency + permanently browser-only barely coexist when the user is the vendor's customer | Structural finding after census FAIL | [census-week0/README.md](../research/census-week0/README.md); [A8-DECISION.md](../research/census-week0/A8-DECISION.md) — PROVEN (observability); ASSUMED if generalized |
| 4 | Proof of process | We killed our own first anchor before writing the product | FAIL: 2/70 survivors; gate ≤2 → FAIL | [A8-DECISION.md](../research/census-week0/A8-DECISION.md) (2026-07-24) — PROVEN |
| 5 | The kill list | 51 of 70 tasks were FULLY_API with cited REST/Terraform paths | A4 adversary census | [A4-adversary.md](../research/census-week0/A4-adversary.md); A8 join — PROVEN |
| 6 | Wrong thesis falsified | "Platform engineers live in observability consoles for recurring config" is dead | Highest A5 pain sat on FULLY_API tasks | [A8-DECISION.md](../research/census-week0/A8-DECISION.md) §killed-by-A4 — PROVEN |
| 7 | The insight | Invert: counterparty labor → permanently browser-only + multiplicity across portals | Pivot hypothesis | Wave-2 shared context / founder pivot — **ASSUMED** as originally framed; Track 2 has since tested and **FAILed** this as a lockable wedge — [DECISION.md](../research/vertical-search/DECISION.md); [ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md) |
| 8 | Falsifiability | Track 2 can kill this thesis (API / EDI / intermediary) | C4/C5 gate design in Wave pack | Wave pack Track 2 method — ASSUMED process; outcome: **FAIL** — [DECISION.md](../research/vertical-search/DECISION.md); [ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md) |
| 9 | Vertical | **FAIL** — no surface locked (2 survivors vs the ≥6-on-one-surface gate; 0 DURABLE surfaces) | C5 adjudicated all six Wave-2 surfaces, 2026-07-25 | [DECISION.md](../research/vertical-search/DECISION.md); [ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md) — PROVEN |
| 10 | Mechanism | Compilation, not compression | Contracts for trajectory, assertion, cache-row, metrics | [contracts/](../../contracts/) — PROVEN as schema; runtime **PENDING TRACK-1** |
| 11 | Replay economics | Amortized cost trends down vs flat snapshot compression | None measured | **[PENDING TRACK-1]** — never invent a number |
| 12 | Gate metrics (named, empty) | We instrument replay-validity, ≤2 repairs, repair vs fresh (tokens + wall-clock), self-heal, time-to-repair | Field names in metrics schema | [metrics.schema.json](../../contracts/metrics.schema.json) — PROVEN field defs; values **[PENDING TRACK-1]** |
| 13 | Moat | Under counterparty model, cross-portal pooling is the product | Product thesis | **ASSUMED**; requires Track 2 multiplicity |
| 14 | Cold start | v1 is single-tenant ROI; pooling compounds later | GTM thesis | **ASSUMED**; not measured |
| 15 | Privacy boundary | Pooled rows fail-closed; tenant literals stay out of the pool | PRD §6 / B5 track | Boundary **PENDING** (PRD file missing from tree at draft); schema has `pool_eligible` — [cache-row.schema.json](../../contracts/cache-row.schema.json) |
| 16 | Why not Terraform / API? | When API/IaC exists, we lose on purpose — census proved that | 51 FULLY_API kills | [A4](../research/census-week0/A4-adversary.md); [A8](../research/census-week0/A8-DECISION.md) — PROVEN |
| 17 | ToS reality | Console automation against major SaaS can be HIGH risk without written consent | Datadog AUP / Grafana ToS overlay | [A6-tos.md](../research/census-week0/A6-tos.md) (access_date 2026-07-24) — PROVEN for those vendors; next vertical **PENDING** |
| 18 | Backup lead (not locked) | Seller-side portal questionnaire fill is a conditionally credible wedge | A7 scout; Chrome extensions as demand signal | [A7-backup.md](../research/census-week0/A7-backup.md) (access_date 2026-07-24) — PROVEN as scout notes; not a vertical lock |
| 19 | Two tracks | Technical churn gate ∥ commercial vertical search | Neither waits on the other | Wave-2 shared context; [README.md](../../README.md) — ASSUMED operating plan |
| 20 | What would make us wrong | Replay below threshold; intermediary owns labor; ToS blocks; models too cheap; two vertical FAILs | Explicit kill table | [narrative.md](./narrative.md) §wrong — mix PROVEN (A6/A8 process) + PENDING/ASSUMED kills; **intermediary-owns-labor and two-vertical-FAILs are already realized, not hypothetical** — [DECISION.md](../research/vertical-search/DECISION.md); [ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md) |
| 21 | Ask | Support to finish Track 1 number + Track 2 adjudication — not to scale an unmeasured cache | Status table | [README.md](../../README.md) — PROVEN status; ask details **ASSUMED** / founder |

## Slide notes for designers

- Do **not** put a cost % or latency chart on slide 11 until Track 1 emits measured rows.
- Slide 4–6 are the unusual opening; do not bury the failed census.
- Slide 9 must say **FAIL — not locked** — C5 ran 2026-07-25 ([DECISION.md](../research/vertical-search/DECISION.md); [ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md)).

## Open questions / what I could not verify

- Founder-preferred slide count / fundraising ask amounts — not invented here.
- PRD §9 numeric thresholds for slide 12 — pending PRD drop + measurement.
- Whether A7 portal-fill remains the lead after C1–C5 — **resolved, no.** C5 ranks security-questionnaires first only "for residual honesty" among *failed* surfaces and explicitly rejects locking it "because A7 said so" ([DECISION.md](../research/vertical-search/DECISION.md) §Surface scorecard).
