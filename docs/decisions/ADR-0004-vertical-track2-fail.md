---
title: "ADR-0004 — Track-2 vertical decision: FAIL (no surface lock)"
doc_type: adr
status: accepted
owner: C5
created: 2026-07-25
updated: 2026-07-25
confidence: HIGH
supersedes: null
sources_verified: true
related:
  - docs/research/vertical-search/DECISION.md
  - docs/research/vertical-search/adversary-report.md
  - docs/prd/pivot-brief-v0.3.md
  - docs/research/census-week0/A8-DECISION.md
  - docs/decisions/ADR-0003-testbed-grafana-oss.md
---

# ADR-0004 — Track-2 vertical decision: FAIL (no surface lock)

## Status

accepted

## Context

Week-0 census **FAIL**ed observability as anchor (2/70 survivors;
`docs/research/census-week0/A8-DECISION.md`, scored 2026-07-24). Pivot brief
v0.3 replaced the selection rule with counterparty + durability + multiplicity
and opened Track 2 across six surfaces (`docs/prd/pivot-brief-v0.3.md`).

Track 2 inputs (access dates on source docs):

- C1–C3 surface scouts under `docs/research/vertical-search/` (2026-07-24)
- C4 durability adversary `adversary-report.md` (2026-07-25) — **0 DURABLE**
  surfaces; 5 ALREADY_SOLVED + 1 ERODING
- C5 sole scoring in `docs/research/vertical-search/DECISION.md` (2026-07-25)

Gate (Track 2): ≥6 task survivors on **one** surface that also passes durability
and multiplicity → PASS and lock; 3–5 or spread → MARGINAL; ≤2 → FAIL. Surface
fails outright on durability ALREADY_SOLVED or multiplicity of 1. Where scouts
and C4 disagree, C4 wins.

## Options considered

### A — Lock a Wave-2 surface (rejected)

Honest case for: counterparty PASS on all six scouts; real labor pain (e.g. AMA
prior-auth burden cited in healthcare scout); seller questionnaire demand
validated by funded QAuto products.

Honest case against: C4 kills durability on all six; task survivors = **2**
(`HP-10`, `FC-04`); max survivors on one surface = 1; test-beds hostile or
HIPAA/tax/bank gated. Locking would repeat Week-0’s error (anchor before
absorption check).

### B — Declare MARGINAL and keep searching the same six (rejected)

Honest case for: NO_PATH_FOUND residue exists; could interview for frequency.

Honest case against: Gate is ≤2 → FAIL, not MARGINAL. Residue is judgment /
once-ish / long-tail. Another same-shape census will re-discover intermediaries.

### C — FAIL vertical lock; defer commercial wedge to Track-1 number (chosen)

Honest case for: Matches scored gate; two consecutive FAILs are thesis evidence
(frequency causes rails **or** intermediaries). Track-1 (ADR-0003 Grafana OSS)
answers whether the mechanism works without a partner portal.

Honest case against: Leaves go-to-market unset; pitch Track 3 must not invent a
locked vertical.

## Decision

**Do not lock any Track-2 surface.** Vertical search verdict = **FAIL**.
Nominated commercial first task = **N/A**.

Preserve research under `docs/research/vertical-search/`. Continue Track-1 only
as the near-term company-deciding measurement.

## Consequences

Easy: stops partner recruitment and portal ToS exposure for a doomed wedge;
keeps eng focused on gate metrics.

Hard: commercial narrative cannot claim a locked counterparty vertical; any
future wedge must not assume “counterparty ⇒ durable empty browser market.”

Forecloses (for now): Wave-2 lock of security questionnaires, procurement
onboarding, healthcare payer portals, insurance appointment portals, freight/
customs portals, or government filing portals as Paragent’s anchor.

## Reversal cost

**High.** Signal to reverse: new primary evidence that a named surface is
DURABLE (interest-grounded, not backlog), has ≥6 scored survivors with
FREQUENCY/PAIN from measured jobs (not marketing blogs), and a reachable
non-PHI / non-tax-bank test bed — **or** an explicit product pivot to sell
replay infrastructure to existing intermediaries (QAuto / RCM / TMS), which is
a different company shape and needs a new ADR.

## Open questions / what I could not verify

- Track-1 replay-validity number (not yet the subject of this ADR).
- Whether intermediaries would buy a trajectory substrate (not researched here).
- Counsel packet on authorized-user automation of third-party portals (pivot
  brief §5; still pending).
