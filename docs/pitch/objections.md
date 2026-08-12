---
title: Pitch objections (Wave 1 draft)
doc_type: pitch
status: draft
owner: D1
created: 2026-07-25
updated: 2026-08-12
confidence: MED
supersedes: null
sources_verified: true
---

# Objections — honest answers

Answers prefer "we don't know yet" over invention. Vertical: **FAIL — no surface locked** ([DECISION.md](../research/vertical-search/DECISION.md); [ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md)).

## 1. Why not Terraform / the vendor API?

**If a clean API or Terraform path exists, Paragent should lose.** Week-0 proved the point: 51/70 observability tasks were FULLY_API with citations; the highest-pain A5 tasks were often already automatable via REST/IaC ([A8-DECISION.md](../research/census-week0/A8-DECISION.md); [A4-adversary.md](../research/census-week0/A4-adversary.md), access_date 2026-07-24). Building a UI replay cache for work competent teams already IaC is exactly the trap A8 named.

We only belong where the laborer is structurally outside the vendor's API roadmap — the counterparty hypothesis (**ASSUMED** as originally framed; tested by Track 2 and **FAILed** as a lockable wedge — [DECISION.md](../research/vertical-search/DECISION.md); [ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md)).

## 2. Why won't OpenAI / Anthropic / Browserbase just do this?

**ASSUMED competitive framing:** foundation-model labs and browser-infra vendors optimize general agent capability and session hosting. Paragent's bet is a **compiled, asserted, poolable trajectory cache** with write-time privacy allowlisting — a different layer. "Poolable" is a tested write-time mechanism, not yet a measured yield: on the one live bundle, 7 of 12 rows are pool-eligible through the authoritative path, unchanged by the latest allowlist addition ([docs/gate/pool-vocabulary.md](../gate/pool-vocabulary.md); [ADR-0017](../decisions/ADR-0017-pool-vocabulary-rule.md)).

What we do **not** claim: that they cannot enter; that we have a moat today; that model vendors will ignore caching. Diligence answer: if Track 1 shows compilation does not survive churn, there is no company regardless of who ships browsers ([README.md](../../README.md) Track 1 status — gate number pending).

## 3. Why a solo founder?

**ASSUMED / process answer:** the Week-0 self-kill (FAIL memo 2026-07-24, 51 FULLY_API) is the hiring and fundraising credential — we falsify before we build ([A8](../research/census-week0/A8-DECISION.md)). Solo is a capacity risk; it is not a substitute for a gate number. Track 1/2 run in parallel with agent swarm under contracts to compress calendar time (**ASSUMED** operating model; Wave pack).

## 4. ToS — won't portals ban agents?

**Yes, that can kill a vertical.** Observability already showed HIGH customer-consented console-agent risk for Datadog (AUP framing/scraping without prior written consent) and Grafana Cloud (ToS spidering/harvesting / interaction bans); Sentry MED with multi-tenant product-model risk ([A6-tos.md](../research/census-week0/A6-tos.md), access_date 2026-07-24). A8 treated counsel + written consent as prerequisite, not polish.

For any next surface: spike host ToS **before** pilot; prefer flows with explicit user-driven automation consent; never scrape third-party content into git. Vertical-specific ToS for Track-2 candidates: **PENDING** per-surface.

## 5. What if models get cheap?

Then the economic wedge of caching shrinks. We treat "fresh reasoning cheaper than replay+repair overhead" as a real kill condition ([narrative.md](./narrative.md)). Track 1 must emit repair-vs-fresh **token and wall-clock** costs ([metrics.schema.json](../../contracts/metrics.schema.json)) so the curve is measured, not narrated. **[PENDING TRACK-1]** — no break-even number exists yet.

## 6. What if portals block agents (bot detection / MFA / CAPTCHA)?

Hard product risk. MFA and human gates already appear as browser-bound residues in both observability PARTIAL rows and A7 portal-fill notes ([A4](../research/census-week0/A4-adversary.md); [A7-backup.md](../research/census-week0/A7-backup.md)). Design implication: stay in user-consented sessions; do not promise silent unattended takeover of hostile portals. Feasibility is **PENDING** per vertical test-bed.

## 7. Two failed censuses — is there a company here?

**Present tense (post-C5):** two consecutive vertical FAILs — Week-0 observability ([A8](../research/census-week0/A8-DECISION.md), 2/70) and Track-2 counterparty search ([DECISION.md](../research/vertical-search/DECISION.md), 2/75, 0 DURABLE surfaces; [ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md)). C5 treats that as evidence about the **selection thesis**, not merely bad anchors, and directs the company at the **Track-1 gate number**.

Honest present tense: observability is dead as anchor; Wave-2 surfaces are **not locked**; mechanism still unproven. **If Track 1 fails, C5 says stop the company thesis** — that is the slide we keep.

## 8. Isn't portal autofill already a crowded category?

Yes — and C4/C5 treat that as a **kill**, not an open wedge: QAuto intermediaries already productize seller-side portal fill ([adversary-report.md](../research/vertical-search/adversary-report.md); C5: do not lock questionnaires “because A7 said so”). A7’s Chrome-extension notes remain historical demand signal ([A7-backup.md](../research/census-week0/A7-backup.md), access_date 2026-07-24). Differentiation vs extensions (compilation + assertions + poolable cache) stays **ASSUMED** until Track 1 measures — the one partial measurement so far is pool *yield*, not the full gate number, and it does not move this claim ([docs/gate/pool-vocabulary.md](../gate/pool-vocabulary.md)).

## 9. Can you measure without a design partner?

Track 1 deliberately uses self-hosted Grafana OSS so the **mechanism** can be measured without third-party ToS or partners ([ADR-0003](../decisions/ADR-0003-testbed-grafana-oss.md); pivot §4). C5 defers design-partner portal pilots until after that number. Commercial vertical lock for Wave-2 is **closed** (FAIL).

## Open questions / what I could not verify

- Competitor roadmap intent for OpenAI/Anthropic/Browserbase caching layers — not researched in this draft; treat as ASSUMED.
- Founder post-Track-1 choice (sell-to-intermediary reframe vs shut search) — C5 next-action box; not decided here.
- Founder personal capacity / raise structure — out of scope; no claims.
