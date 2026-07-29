---
title: "PRD v0.4 addendum — §8 anchor, §9 gate status, and which kill line controls"
doc_type: brief
status: accepted
owner: D2
created: 2026-07-29
updated: 2026-07-29
confidence: HIGH
supersedes: "docs/prd/PRD-trajectory-cache-v0.2.md §8 (residual body text), §9 (status of the thresholds, not their values)"
sources_verified: true
---

# PRD v0.4 addendum

Resolves [INTEGRITY-AUDIT](../INTEGRITY-AUDIT.md) **D-02 (Critical)**, **D-03 (High)** and
**D-06 (Medium)**, plus the pivot brief's own open question about which document controls the
Track-1 kill line.

**This is an addendum, not a rewrite.** [PRD v0.2](./PRD-trajectory-cache-v0.2.md) stays intact
as the historical record; only a superseded-by pointer was added to it. Rewriting an accepted
document would destroy the audit trail that makes the two FAILs credible — the same reason the
[pivot brief](./pivot-brief-v0.3.md) superseded §8 rather than editing it.

Nothing here invents a number, softens a finding, or resolves a disagreement that needs a founder
decision. Where a question is the founder's, it is named as open below rather than answered.

## 1. If you are reading PRD §8, read this instead (D-02)

PRD §8 is an accepted document that currently tells a new reader the test-bed is **Grafana Cloud**
and the commercial anchor is **Datadog**. Both were superseded, and the PRD's own open questions
concede it — "§8 residual text still names Datadog / Grafana Cloud … **not rewritten in body**".
That concession has been sitting in the same file as the stale text, which is not a fix: the
stale document is the one people open.

| PRD §8 says | Actually | Authority |
| --- | --- | --- |
| Test-bed is **Grafana Cloud** (free tier) | **Self-hosted Grafana OSS**, eight pinned versions walked forward release by release | [ADR-0003](../decisions/ADR-0003-testbed-grafana-oss.md) (accepted) |
| Commercial anchor is **Datadog** | **No commercial anchor exists.** Observability config was rejected outright | [A8-DECISION](../research/census-week0/A8-DECISION.md) — census FAIL, 2 survivors, 51 tasks killed as FULLY_API |
| First gate task is *install a data-source integration, then create an alert rule* | **Build and save a TestData Stat dashboard**, 12 steps, on self-hosted Grafana | [ADR-0006](../decisions/ADR-0006-track1-gate-task.md) (accepted) |
| Selection rule: high-frequency + browser-only + no meaningful API + painful | **Replaced** by the counterparty / durability / multiplicity rule | [Pivot brief v0.3 §3](./pivot-brief-v0.3.md) (accepted) |
| Backup vertical: vendor security-review portals | **No vertical is locked.** Track 2 returned FAIL and no surface was locked | [ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md) (accepted) |
| "If fewer than **~6 survive**, the anchor vertical is wrong" | Superseded in practice — see §4 below | A8 and C5 both applied a **≤2-survivor** FAIL line |

**What is decided:** the test-bed, the gate task, and the selection rule.
**What is not decided:** the vertical. Two searches returned FAIL and nothing replaced them. A
reader should leave §8 knowing there is no anchor, not guessing at one.

## 2. §9's thresholds are **proposed**, not accepted (D-03)

PRD §9 states four numbers:

> Step-validity **≥ 80%** … task-level success (≤2 repairs/run) **≥ 90%** … Step-validity
> **< ~50%** … mean repair cost **≥ 70%** of fresh-reasoning cost

The pitch pack simultaneously says no gate number is set. Both are accurate about different
things, and the disagreement is that the documents do not label which is which.

**Resolution — a status label, not a number:**

> The §9 thresholds are **PROPOSED and UNVALIDATED**. No document may cite them as accepted
> gates, as measured results, or as evidence that the thesis holds or fails.

This addendum deliberately **does not** choose different numbers. D-03 is not a disagreement about
what the thresholds should be; it is a disagreement about their status, and inventing a value here
would be precisely the category-B failure the audit exists to catch.

**Who can accept them, and when.** The founder owns the PRD (`owner: founder`). Acceptance
belongs at **gate-memo time**, on the first Track-1 measurement that clears PRD §9's own sampling
protocol — **≥42 runs and ≥400 step-executions**. Accepting a threshold before there is a
measurement to test it against would make the gate unfalsifiable, which is the failure mode §9
was written to prevent.

Until that memo exists, every citation of 80 / 90 / ~50 / 70 must carry the word *proposed*.

## 3. Which kill line controls — §9 does (pivot open question)

The pivot brief's open questions ask: "Track-1 kill line 'replay-validity < ~50%' vs PRD §9 fuller
gate set — **which document controls when Track 1 reports**."

**It is answerable from the pivot brief itself, and the answer is §9.** Three pieces of evidence,
all in the pivot brief:

1. **§5 states it outright:** "**Gate:** unchanged from §9."
2. **Its supersession table enumerates what it replaces.** Decision 2 is "§8 selection rule —
   **Replaced**". §9 does not appear in that table at all; the only §-level supersession the
   pivot claims is §8, matching its own frontmatter (`supersedes: … §8`).
3. **The "~50%" is a restatement, not a replacement.** The pivot writes "Kill condition,
   **restated**" and then gives *both* of §9's kill clauses — `< ~50%` validity **and** repair
   cost ≈ fresh-reasoning cost. A document proposing a competing single-number gate would not
   reproduce the other document's second clause.

**Precedence rule, stated for the gate memo:**

> PRD §9 is the gate specification. The pivot brief's "~50%" is shorthand for §9's kill half and
> introduces no separate gate. Where the two appear to differ, §9 controls; where the pivot adds
> framing (version-bump churn as a proxy, no design-partner dependency), that framing applies to
> **how** the number is obtained, not to what the number must clear.

This closes the pivot brief's open question. It has to be settled before the gate memo is
written, or the memo argues with the spec while reporting the number.

**Still open, and the founder's call:** whether the §9 thresholds *remain binding at those values*
after two vertical FAILs. That is PRD v0.2's own first open question and it is a judgement about
appetite, not a documentation defect — this addendum fixes the label, not the level.

## 4. §8's "~6 survivors" fail line is historical (D-06)

PRD §8 says: "If fewer than **~6 survive**, the anchor vertical is wrong — switch to the backup
vertical." Both searches that actually ran applied a **≤2-survivor** FAIL line instead:

| Search | Survivors | Verdict |
| --- | --- | --- |
| Week-0 census (A8) | 2 | **FAIL** — 51 tasks killed as FULLY_API |
| Vertical search (C5) | ≤2 | **FAIL** — no surface locked ([ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md)) |

The "~6" line was never the operative rule and is recorded here so no reader treats it as live.
Note this makes the executed gate **stricter** than the written one: both searches would have
failed under either line, so the discrepancy changed no outcome. It is a documentation defect,
not a decision defect.

## 5. Category-D items this addendum does not close

Named rather than quietly skipped:

| Item | Why it stays open |
| --- | --- |
| **D-01** | Residual deck slides may still cite the A7 "conditionally credible" seller-portal lead. Requires walking the deck, and it is FOUNDER-marked |
| **D-05** | Stale diligence register — already refreshed; no PRD-side action |
| **D-07** | Objections prose updated; the deck may still lag |
| **D-08** | Pivot's "5-day vertical search" optimism vs C5's "do not re-run same-shape census" — C5 already wins as the later adjudicator; no new decision needed |

## Sources

| Claim | Source | Access date |
| --- | --- | --- |
| Test-bed is self-hosted Grafana OSS | `docs/decisions/ADR-0003-testbed-grafana-oss.md` | 2026-07-29 |
| No vertical locked; Track 2 FAIL | `docs/decisions/ADR-0004-vertical-track2-fail.md` | 2026-07-29 |
| Gate task = TestData Stat dashboard | `docs/decisions/ADR-0006-track1-gate-task.md` | 2026-07-29 |
| §8 residual text, §9 thresholds, PRD open questions | `docs/prd/PRD-trajectory-cache-v0.2.md` §8, §9, Open questions | 2026-07-29 |
| "Gate: unchanged from §9"; supersession table; kill condition restated | `docs/prd/pivot-brief-v0.3.md` §5, §7 | 2026-07-29 |
| D-02 / D-03 / D-06 wording and severities | `docs/INTEGRITY-AUDIT.md` category D | 2026-07-29 |
| Census FAIL, 2 survivors | `docs/research/census-week0/A8-DECISION.md` | 2026-07-29 |

## Open questions / what I could not verify

- Whether the §9 threshold **values** remain binding after two vertical FAILs. Founder's call at
  gate-memo time; this addendum fixes their status label, not their level.
- Whether any deck or pitch surface still cites the superseded §8 anchors. Not walked here —
  that is D-01 / E-12, and this addendum's authority comes from not overreaching into files it
  did not read.
- Whether "task-level success ≥ 90%" is measurable at all on a 12-step task that
  [ADR-0006](../decisions/ADR-0006-track1-gate-task.md) predicts compiles to **5 strong / 7
  weak** assertions. ADR-0006 raises this itself and leaves it open; it may make one of the §9
  gates unreachable for reasons that have nothing to do with the thesis.
- Whether the addendum pattern scales. This is the second document superseding PRD v0.2 by
  pointer (after the pivot brief). A third would argue for consolidating into a v0.5 body rather
  than a chain of addenda a reader must assemble.
