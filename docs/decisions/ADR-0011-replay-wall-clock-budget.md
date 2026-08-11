---
title: "ADR-0011: per-run wall-clock budget, and how a truncated run is reported"
doc_type: adr
status: accepted
owner: B4
created: 2026-08-11
updated: 2026-08-11
confidence: MED
supersedes: null
sources_verified: true
---

# ADR-0011 — Replay wall-clock budget

**Status:** accepted · **Trigger:** [#84](https://github.com/DevToolie/Paragent/issues/84).

## Context

`ReplayRunner` capped how many times it would repair (`maxRepairsPerRun`, default 2) and
**nothing capped elapsed time**. A run's worst case was unbounded in the dimension a user
actually feels.

The shape of that worst case, with today's constants: a failing step spends its full assertion
timeout (`DEFAULT_ASSERTION_TIMEOUT_MS`, 5000 ms) before it is even classified as a failure, a
repair is proposed, and the retry spends it again. A 12-step task with several stale locators
sits for a long time with no output and no ceiling — and once
[#27](https://github.com/DevToolie/Paragent/issues/27) wires a real repair model, each proposal
adds model latency on top of that.

This is a product claim, not only a test-runtime concern. PRD §3 sells replay as *"near-zero
tokens, near-zero latency"*, and §9's kill line is explicitly *"mean repair cost ≥ 70% of
fresh-reasoning cost (tokens **and wall-clock**, measured, not estimated)"*. A run with no time
ceiling can blow that line with nothing reporting that it did.

The timer is the easy half. The decisions are about **reporting**, because a budget that
silently removes steps from a denominator flatters every ratio in §9.

## Decisions

**1. The budget is checked at step boundaries and before each repair proposal — never
mid-action.** A step that has started runs to its own conclusion under its own per-step
ceilings. Cutting an assertion short would change *what is measured*: the step would report a
failure that belongs to the budget rather than to the site, which is precisely the confusion
`docs/gate/compiler.md`'s `timeout_ms` note warns about. The consequence is that a run can
overshoot its budget by at most one step, and that is the right trade.

**2. Budget exhaustion gets a new `StepOutcome` member: `BUDGET_EXHAUSTED`.** A contract change,
taken deliberately rather than by reusing a member that means something else:

| Existing member | Why it does not fit |
| --- | --- |
| `TIMEOUT` | Means the page did not respond in time — a property of the **site**, and a churn datum. Budget exhaustion is a property of the **harness configuration**. Pooling them would let a config change look like site churn in the §9 aggregates |
| `REPAIR_EXHAUSTED` | Claims repair was attempted and ran out of **attempts**. Under a spent budget, attempts remain and *time* ran out. Recording it would overstate how hard the runner tried |

It is emitted only for a step that was **attempted and failed** and whose recovery the clock
ended. `replay_valid` stays `false` because the first pass genuinely did fail — the observation
is real; only the repair is missing.

**3. A step the run never reached emits no row at all.** This is the second question #84 asks:
is a truncated run's step-validity a measurement? For the steps it executed, yes — those are
real observations and they stay. For the steps it never started, there is nothing to report:
counting them as failures would invent a result, and counting them as passes is absurd. So they
produce no row, exactly as [#122](https://github.com/DevToolie/Paragent/issues/122)'s refused run
produces none.

**4. The resulting denominator shrink is stated, not left to be inferred.** The honest objection
to decision 3 is that dropping steps quietly shrinks the denominator, and a shrinking denominator
is how a gate number gets flattered. Three things make it visible:

- `steps_attempted` on the run row, beside the existing `steps_total`. Below it ⇒ the run
  stopped early.
- `budget_exhausted` and `wall_clock_budget_ms` on the run row, so the *reason* is on the same
  row as the shortfall.
- A `truncation` block in `buildGateReport`, printed beside the §9 sample floor:
  `runs_truncated_by_budget` and `steps_unattempted` across the whole matrix. Reported, never
  enforced — a truncated run is still a real measurement of the steps it reached.

**5. `selfHealRate` counts against attempted steps, not `steps_total`.** Its denominator is
"runs that failed a step on first pass". A run truncated after two passing steps of twelve has
nothing to have healed; measuring it against `steps_total` put it in the denominator and scored
it as a self-heal *failure* — a value invented out of steps that never executed. Rows written
before this ADR have no `steps_attempted`, where it equals `steps_total` by construction, so the
fallback is exact rather than assumed.

**6. Default 300 000 ms (5 min), overridable, disable-able.** Generous by design: the 12-step
ADR-0006 task has a worst case near 120 s under the per-step ceilings already in force (5 s
assertion + 5 s `networkidle` per step), and a healthy live gate run takes ~30 s. `runBudgetMs
<= 0` disables the guard entirely and restores the pre-#84 behaviour; that is recorded on the run
row as `wall_clock_budget_ms: 0` rather than left blank, because "the guard was off" is a fact
about the run.

The default is deliberately **not** derived from repair latency, which is unmeasured until #27
lands a real model. When that number exists, this constant should be revisited against it — not
quietly stretched to fit.

## Consequences

- `contracts/metrics.schema.json` gains one `stepOutcome` member and three optional run fields
  (`steps_attempted`, `wall_clock_budget_ms`, `budget_exhausted`). All optional, so existing
  NDJSON stays valid; a consumer that switches on `StepOutcome` must handle the new member.
- Nothing about assertions changed. No timeout was shortened to fit a budget (#84's first
  constraint), and `assertAssertionUnchanged` is untouched.
- The gate matrix ledger (`out/matrix-run.json`) records `steps_attempted` and, when it fired,
  the budget — so a human reading the ledger can tell "the run stopped on its own clock" from
  "the site broke".

## Open questions / what I could not verify

- **The default has never fired in anger.** It is derived from the per-step ceilings, not from an
  observed distribution of run durations — the matrix has not been run enough times to have one.
  If a healthy run ever trips it, the number is wrong and the fix is to measure, not to raise it
  reflexively.
- **A budget interacts with `--runs`**: a matrix of 8 pins × 6 runs has no aggregate ceiling, only
  a per-run one. Whether the driver should have its own overall budget is not decided here.
- Whether `BUDGET_EXHAUSTED` should also be reachable *mid-action* on a surface whose per-step
  ceilings are themselves too generous. Today it cannot be, by decision 1.
