---
title: Pitch objections (Wave 1 draft)
doc_type: pitch
status: draft
owner: D1
created: 2026-07-25
updated: 2026-07-25
confidence: MED
supersedes: null
sources_verified: true
---

# Objections — honest answers

Answers prefer "we don't know yet" over invention. Vertical remains **search in progress**.

## 1. Why not Terraform / the vendor API?

**If a clean API or Terraform path exists, Paragent should lose.** Week-0 proved the point: 51/70 observability tasks were FULLY_API with citations; the highest-pain A5 tasks were often already automatable via REST/IaC ([A8-DECISION.md](../research/census-week0/A8-DECISION.md); [A4-adversary.md](../research/census-week0/A4-adversary.md), access_date 2026-07-24). Building a UI replay cache for work competent teams already IaC is exactly the trap A8 named.

We only belong where the laborer is structurally outside the vendor's API roadmap — the counterparty hypothesis (**ASSUMED**, pending Track 2).

## 2. Why won't OpenAI / Anthropic / Browserbase just do this?

**ASSUMED competitive framing:** foundation-model labs and browser-infra vendors optimize general agent capability and session hosting. Paragent's bet is a **compiled, asserted, poolable trajectory cache** with write-time privacy allowlisting — a different layer.

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

Week-0 is **one** failed **anchor**, not two failed censuses yet. A second consecutive FAIL at C5 (≤2 survivors, or surfaces ALREADY_SOLVED / multiplicity 1) is exactly when Wave-pack guidance says to treat the result as evidence about the **thesis**, and let Track-1's number decide whether to continue at all (Wave pack §Agent C5).

Honest present tense: observability is dead as anchor ([A8](../research/census-week0/A8-DECISION.md)); counterparty search is **in progress**; mechanism unproven. **If both tracks fail, there may not be a company** — that is the slide we keep.

## 8. Isn't portal autofill already a crowded category?

A7 notes multiple Chrome extensions (e.g. Vanta questionnaire automation, SafeBase portal autofill) as **demand validation and competition**, not empty space ([A7-backup.md](../research/census-week0/A7-backup.md), access_date 2026-07-24; cites Vanta engineering post and Chrome Web Store listings). Our differentiation claim is compilation + assertions + poolable cache under privacy allowlisting — **ASSUMED** until Track 1/2 prove it. We do **not** lock vendor-security portals as the vertical here.

## 9. Can you measure without a design partner?

For invitation-gated buyer portals, A7 says **brutal no** for a 14-day protocol without a partner or thin self-serve visitor flows ([A7](../research/census-week0/A7-backup.md)). Track 1 deliberately uses self-hosted OSS so the **mechanism** can be measured without third-party ToS or partners (Wave-2 shared context). Commercial proof still needs a reachable surface — **PENDING Track 2 feasibility ranking**.

## Open questions / what I could not verify

- Competitor roadmap intent for OpenAI/Anthropic/Browserbase caching layers — not researched in this draft; treat as ASSUMED.
- Per-portal bot-detection severity for Track-2 candidates — PENDING C1–C4.
- Founder personal capacity / raise structure — out of scope; no claims.
