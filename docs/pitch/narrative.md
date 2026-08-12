---
title: Pitch narrative (Wave 1 draft)
doc_type: pitch
status: draft
owner: D1
created: 2026-07-25
updated: 2026-08-12
confidence: MED
supersedes: null
sources_verified: true
---

# Paragent — pitch narrative (Wave 1 draft)

Vertical: **FAIL — no surface locked.** C5 adjudicated all six Wave-2 surfaces on 2026-07-25: 2 task survivors against the ≥6-on-one-surface gate, 0 DURABLE surfaces ([DECISION.md](../research/vertical-search/DECISION.md); [ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md)).

## The insight (falsifiable)

A SaaS vendor builds an API for whatever **its paying customers** do repeatedly. Week-0 tested that claim on observability config and falsified the first anchor: of 70 candidate tasks across Datadog, Grafana Cloud, and Sentry, **51 were FULLY_API** with cited REST/Terraform paths, and only **2 survivors** cleared all four gates — below the FAIL threshold of ≤2 survivors ([`docs/research/census-week0/A8-DECISION.md`](../research/census-week0/A8-DECISION.md), decision date 2026-07-24; FULLY_API count from [`A4-adversary.md`](../research/census-week0/A4-adversary.md), access_date 2026-07-24 per A8).

Structural reading of that kill list: **high-frequency** and **permanently browser-only** are nearly mutually exclusive **when the laborer is the vendor's customer** ([`docs/research/census-week0/README.md`](../research/census-week0/README.md); A8 decision narrative).

**Pivot hypothesis (tested — FAILed as a vertical lock):** invert the relationship. Target work where the person doing it is the **counterparty** to the software's customer — no API, no bulk tools, no roadmap sympathy, permanently, because the portal owner has no incentive to reduce *their* labor; frequency accrues because one worker faces **many** portals (shared Wave-2 context; founder pivot framing). This claim was falsifiable by Track 2, and Track 2 falsified it: C4/C5 found every one of the six candidate surfaces already API'd, EDI'd, or owned by an intermediary (5× ALREADY_SOLVED, 1× ERODING, 0 DURABLE) — the thesis FAILed as a lockable wedge, not merely the first vertical ([DECISION.md](../research/vertical-search/DECISION.md); [ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md)).

## The proof of process

We lead with a failure. Before building a product on observability console RPA, we ran an adversary census and **killed our own anchor**: FAIL, 2/70 survivors, no single-vendor concentration of 4+, no Grafana free-tier gate task ([A8](../research/census-week0/A8-DECISION.md)). The 51-item FULLY_API kill list is the asset — it is what a competent diligence process would eventually discover, produced **before** we wrote the execution layer ([A4](../research/census-week0/A4-adversary.md); A8 §"Tasks killed by A4").

Operating narrative in the Wave pack frames this as roughly a 48-hour self-falsification cycle. **ASSUMED** as pack framing; the dated, citable fact is the FAIL memo of 2026-07-24. For a solo founder facing "why hasn't a funded team done this," disciplined self-kill is stronger than a polished first story.

## The mechanism — compilation, not compression

Paragent is a **stateful execution layer** for browser agents ([repo README](../../README.md)):

1. **Record** a successful trajectory through a web UI.
2. **Compile** it into a deterministic replayable script with a **post-condition assertion on every step**.
3. **Replay** at near-zero token cost (**[PENDING TRACK-1]** — not measured).
4. **Repair** with a model when an assertion fails, then recompile that step.

Contracts already name the measurable fields for step-level replay-validity, task success with ≤2 repairs, repair vs fresh cost (tokens and wall-clock), self-heal rate, and time-to-repair ([`contracts/metrics.schema.json`](../../contracts/metrics.schema.json)). **No gate number exists yet.** Any amortized-cost or "near-free" claim in investor materials remains **[PENDING TRACK-1]**.

The product bet (ASSUMED until measured): compilation amortizes reasoning across repeats; snapshot-compression approaches stay flat on every run. Track 1 measures churn survival on self-hosted OSS version upgrades as an accelerated proxy — not as organic production churn (Track-1 honesty requirement from Wave pack / B1 brief).

## The moat (stated carefully)

Under the counterparty model, **no single customer** warms a cache across hundreds of portals they each touch a few times a year — so **cross-agent / cross-portal pooling** is the product, not a v2 feature (**ASSUMED** product thesis; depends on Track 2 multiplicity holding).

Honest cold-start: **v1 must be economically self-justifying single-tenant** (**ASSUMED** go-to-market; not measured). Pooling is the compounding layer if, and only if, privacy allowlisting keeps pooled rows free of tenant literals ([PRD §6](../prd/PRD-trajectory-cache-v0.2.md); [boundary-spec.md](../privacy/boundary-spec.md)).

## What would make us wrong

Real kill conditions — not theater:

| Kill | What it looks like | Owner |
| --- | --- | --- |
| Mechanism fails churn | Replay validity / success-with-≤2-repairs below the (still unset) Track-1 threshold | Track 1 |
| Thesis fails twice — **already occurred** | Second consecutive vertical FAIL (≤2 survivors or ALREADY_SOLVED / multiplicity 1 across surfaces) → question whether there is a company, not just a bad anchor. **Realized:** Week-0 FAIL (2/70, 2026-07-24) + Track-2 FAIL (2/75, 2026-07-25, 0 DURABLE surfaces) — [DECISION.md](../research/vertical-search/DECISION.md); [ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md) | Track 2 / C5 — closed |
| Intermediary owns the labor — **already occurred, all six surfaces** | Clearinghouse / network / GRC autofill already absorbs the work; "counterparty" is their customer. **Realized:** C4 found 5× ALREADY_SOLVED + 1× ERODING across all six Wave-2 surfaces, 0 DURABLE — [adversary-report.md](../research/vertical-search/adversary-report.md); [DECISION.md](../research/vertical-search/DECISION.md) | C4 durability — closed |
| ToS / portal blocks | Hosted portals ban automated interaction without consent; pilots become counsel+MSA gated (A6 already HIGH for Datadog/Grafana consoles — [`A6-tos.md`](../research/census-week0/A6-tos.md), access_date 2026-07-24) | Legal + GTM |
| Models get cheap enough | Fresh reasoning cost falls until caching's economic wedge collapses | Market / Track 1 cost curves |

We would rather lose on an explicit kill than raise on an unmeasured number.

## Where we are (honest status)

| Track | Question | Status |
| --- | --- | --- |
| 1 | Do compiled trajectories survive site churn? | Harness in progress — **gate number pending** |
| 2 | Is there a vertical where counterparty holds? | **FAIL** — [DECISION.md](../research/vertical-search/DECISION.md) (C5, 2026-07-25); no Wave-2 lock |
| 3 | Narrative | This Wave-1 draft, reconciled to the C5 FAIL of 2026-07-25 — no lock to finalize ([DECISION.md](../research/vertical-search/DECISION.md); [ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md)) |

A7’s seller-side questionnaire lead was **not locked**; C5 FAIL + C4 ALREADY_SOLVED (QAuto) close that Wave-2 wedge ([DECISION.md](../research/vertical-search/DECISION.md); [adversary-report.md](../research/vertical-search/adversary-report.md)). Historical A7 notes remain in [A7-backup.md](../research/census-week0/A7-backup.md).

## Open questions / what I could not verify

- PRD/pivot are in-tree; C5 FAIL recorded 2026-07-25 — earlier “pending C5 / PRD absent” notes are obsolete.
- PRD §9 states proposed numeric gates; **measured** Track-1 gate number still unset — see docs/INTEGRITY-AUDIT.md.
- Whether "48 hours" is measured wall-clock — **ASSUMED** until founder confirms.
- All performance / cost / replay figures — **[PENDING TRACK-1]**.
- Founder choice after Track-1 number (intermediary reframe vs shut search) — per C5 next action; not decided here.
