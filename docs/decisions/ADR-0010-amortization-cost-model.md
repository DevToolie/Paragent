---
title: "ADR-0010: one-time program-build cost is a separate field from the per-run fresh baseline"
doc_type: adr
status: accepted
owner: B4
created: 2026-08-11
updated: 2026-08-11
confidence: MED
supersedes: null
sources_verified: true
---

# ADR-0010 — Amortization cost model: `cost_program_build` vs `cost_fresh`

**Status:** accepted · **Trigger:** [#123](https://github.com/DevToolie/Paragent/issues/123),
filed before [#39](https://github.com/DevToolie/Paragent/issues/39) lands a measured baseline.

## Context

`cost_fresh` was one field carrying two incompatible meanings, and nothing enforced either:

| Consumer | What it needs | Shape |
| --- | --- | --- |
| `repairCostVsFresh` (§9 kill line) | what a fresh run costs **now**, on every row, as a ratio denominator | per-run operating cost |
| `amortizedTokensOverN` (§12 demo curve) | what the compiled program cost to produce **once** | one-time capital cost |

The amortization formula summed `cost_fresh` over the first N runs and divided by N. That
produces the declining curve PRD §12 calls *the demo* only if **exactly one** run in the window
carries a non-zero value. If every run carries its own fresh cost — which is precisely what
`repairCostVsFresh` requires, and what #39 step 4 instructs — the numerator grows linearly with
N, the mean is flat, and the plot shows nothing.

The disagreement was invisible because the field was always zeros: `ReplayRunner` defaults
`costFresh` to `zeroCost()` and no caller passes it. So the curve was `sum(replay + repair)/N`,
replay costs no tokens, and the published series was a flat line at zero labelled `computed`.

Nothing caught it — no assertion, no comment on the field, no test. The number carrying the
entire value proposition would have become wrong at the moment the project first had real data,
and a flat curve reads as *"the thesis failed"* rather than *"the metric is misconfigured."*

## Decision

**1. Two fields, two names, both on the run row.**

- `cost_fresh` — **per-run comparison baseline.** What a fresh (uncompiled) run of this task
  costs now. Legitimately present on every row; it is the §9 ratio's denominator. Never summed
  into an amortization numerator. Zeros continue to mean "not measured", which
  `repairCostVsFresh` already reports as `no_data`.
- `cost_program_build` — **one-time capital cost.** What it cost to produce the compiled program
  this run replays. Optional, present only on the run that consumed the payment.

**2. A payment must be attributable: `program_build_id` is required alongside it.**
Enforced in the contract with `dependentRequired`, and again in `ReplayRunner`'s constructor,
which throws rather than emitting an unattributable payment. Without an id the aggregate cannot
tell a second payment from a duplicate row.

**3. Never measured → `no_data`, never a seeded curve.** If no run in the window carries a
`cost_program_build`, `amortizedTokensOverN` returns `status: "no_data"` and **no points** — not
a zero-valued series. An empty series renders as `no_data` in the SVG; a zero-valued one renders
as a flat line under the caption "amortized tokens/task", which is the strongest possible
version of the claim published on the strength of a field nobody filled in. This is a
**behaviour change**: the same rows previously reported `computed`.

**4. A recompile is a second payment inside the same series, not a new window.**

This is the decision #123 asks for explicitly, and it is the one with a real trade-off. A task
recorded against 9.5.21 and re-recorded after churn at 10.0.0 has paid full price twice. Two
options were available:

| Option | What the reader sees | Why not |
| --- | --- | --- |
| Reset N per build | two clean declining curves | Hides that full price was paid twice. Each window looks like the demo; the task's actual lifetime cost does not appear anywhere |
| **One series per `(site_key, task_key)`** *(chosen)* | one curve that declines, **steps up** at the second payment, then declines again | The step is ugly. That is the finding |

PRD §12's claim is about the steady state, and **churn is the thing under test** — so the cost
of surviving churn belongs inside the curve that carries the claim, not outside it. Payments are
marked on the plot (`program_build_paid` per point, drawn as a dot) so a reader can see how many
there were and where.

**5. Nothing is dropped at aggregation time.** Every measured value in the window enters the
arithmetic. If the same `program_build_id` appears with a payment twice, both are summed and the
report states `payments: 2, distinct_builds: 1` — an emitter bug made visible rather than
corrected into a prettier curve. Silently ignoring measured data to make a curve decline is the
exact failure mode `docs/INTEGRITY-AUDIT.md` exists to catch.

**6. The published `formula` string states what is summed**, and a test pins that it names
`cost_program_build` and does not name `cost_fresh`.

## Migration

Both new fields are **optional**, so every NDJSON row written before this ADR stays valid and
readable, and `npm run validate:contracts` passes unchanged on them. What changes for those rows
is the *report*: an amortized section that previously read `computed: 0` now reads `no_data`.
That is the correction, not a regression — no run in those files ever measured a build cost.

## Consequences

- #39 must attach a measured baseline to `cost_fresh` **and**, separately, the one-time
  compilation cost to `cost_program_build` on the single run that paid it. Its step 4 as written
  ("attach it to run rows so `repairCostVsFresh()` and `amortizedTokensOverN()` compute") would
  now satisfy only the first consumer, and a comment on #39 says so.
- The demo curve stays `no_data` until a build cost is actually measured. That is honest and it
  is also a gap: the plot PRD §12 calls the demo cannot be produced by anything in the repo
  today, and that is #39's and #118's work, not this ADR's.
- `sumRunCosts` gained a `program_build` bucket; `buildGateReport` gained an `amortization`
  block (`payments`, `distinct_builds`, `builds_paid`).

## Open questions / what I could not verify

- **Is one-time-per-`(site_key, task_key, build)` the right granularity?** A program is compiled
  from one trajectory today, so build ≈ recording. If #120's program-level cache entity lands
  and a program can be assembled from rows of several recordings, "what it cost to produce this
  program" stops being one payment and this ADR needs revisiting.
- **No value has ever been measured for either field.** Both readings are still zero-valued at
  HEAD; this ADR separates two meanings, it does not supply a number. The split is therefore
  argued from the arithmetic, not validated against data.
- Whether a *failed* re-record — tokens spent on a compilation that never produced a usable
  program — should enter the numerator. It is a real cost of surviving churn, and today nothing
  emits it either way.
