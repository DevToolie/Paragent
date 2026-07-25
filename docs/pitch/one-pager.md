---
title: Pitch one-pager (Wave 1 draft)
doc_type: pitch
status: draft
owner: D1
created: 2026-07-25
updated: 2026-07-25
confidence: MED
supersedes: null
sources_verified: true
---

# Paragent — one-pager (Wave 1 draft)

**Status:** Pre-seed. Thesis unproven. Gate number pending. Wave-2 vertical search **FAIL** (C5) — no surface locked.

## What it is

A **stateful execution layer** for browser agents: record a successful UI trajectory → compile it with a post-condition assertion on every step → replay → repair on assertion failure ([README.md](../../README.md)).

## Why now (insight)

Vendors API what their **customers** do repeatedly. Our Week-0 census killed SaaS observability config as an anchor: **2/70 survivors**, **51 FULLY_API** ([A8-DECISION.md](../research/census-week0/A8-DECISION.md), 2026-07-24). Pivot hypothesis (counterparty) was tested in Track 2 and **FAIL**ed as a lockable wedge ([DECISION.md](../research/vertical-search/DECISION.md), 2026-07-25) — rails/intermediaries absorb high-frequency counterparty labor.

## Proof of process

We lead with the failed census and the 51-item kill list — self-falsification before product ([A4-adversary.md](../research/census-week0/A4-adversary.md); [A8](../research/census-week0/A8-DECISION.md)).

## Mechanism vs competitors

**Compilation, not compression.** Value hypothesized for repeated browser tasks with no clean API. Replay cost, churn survival, and repair overhead: **[PENDING TRACK-1]** — we will not invent a number.

## Moat (careful)

If counterparty multiplicity holds, **cross-portal pooling** is the product; **v1 cold-start is single-tenant ROI** (**ASSUMED**). Privacy: pool-eligible rows fail-closed (schema: [`cache-row.schema.json`](../../contracts/cache-row.schema.json); [PRD §6](../prd/PRD-trajectory-cache-v0.2.md) / [boundary-spec.md](../privacy/boundary-spec.md)).

## Kill criteria (we keep these)

- Track 1: replay / repair metrics below PRD §9 *proposed* gates — **measured number PENDING TRACK-1**.
- Track 2: **already FAIL** (C5); company depends on Track-1 number ([DECISION.md](../research/vertical-search/DECISION.md)).
- ToS / portal blocks; models cheap enough that cache economics vanish.

## Ask

Help finish the **Track 1 gate number** and **Track 2 vertical adjudication** — not to scale an unmeasured cache. Details of financing: founder.

## Contact / docs

- Narrative: [`narrative.md`](./narrative.md)
- Diligence map: [`proof-points.md`](./proof-points.md)
- Census archive: [`../research/census-week0/`](../research/census-week0/)

## Open questions / what I could not verify

- Exact ask size / instrument — not invented.
- Named vertical — **none** (C5 FAIL); design-partner portal pilots deferred per C5.
- All performance figures — PENDING TRACK-1.
