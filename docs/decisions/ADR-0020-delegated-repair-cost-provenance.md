---
title: "ADR-0020: a repair client that cannot observe its cost marks the row, and the row leaves the §9 cost aggregates"
doc_type: adr
status: accepted
owner: B4
created: 2026-09-06
updated: 2026-09-06
confidence: MED
supersedes: null
sources_verified: true
---

# ADR-0020 — Delegated repair and cost provenance

**Status:** accepted · **Trigger:** [#189](https://github.com/DevToolie/Paragent/issues/189).
Builds on [ADR-0010](ADR-0010-amortization-cost-model.md) (which cost means what) and
[ADR-0012](ADR-0012-repair-context-budget.md) (what a repair client may see).

## Context

`RepairModelClient` had two implementations: the stub, and
[`AnthropicRepairModelClient`](../../src/runner/repair-anthropic.ts), which owns an API key and
calls the Anthropic API itself. The second imposes a shape the product thesis does not require.
Paragent's pitch is giving an agent *that already exists* the ability to drive a browser without
paying full reasoning cost every run — and such an agent already has model access. Requiring it to
provision `ANTHROPIC_API_KEY` means the user pays twice for inference and manages a credential
they did not need. With `npx paragent` now the advertised Quick Start (#179), that is the
difference between "works out of the box" and "works after you provision a key".

A third client fixes that: `propose()` hands the **caller** the authorized repair request and
takes back a proposal. But it creates a measurement problem that is far more dangerous than the
ergonomics problem it solves.

**The host pays, and a host does not report per-call usage back to a library.** So a delegated
repair records `tokens_in: 0, tokens_out: 0`. In a `Cost`, that zero is arithmetically identical
to the stub's zero — which is an *honest* zero, because no inference ran. Two different claims,
one representation:

| Row | `cost_repair` tokens | What it means |
| --- | --- | --- |
| Stub repair | 0 | Measured. No model ran, so nothing was spent |
| Anthropic repair | 9,412 | Measured, from a real `usage` block |
| Delegated repair | 0 | **Unknown.** Real tokens were spent, by somebody else |

§9's kill line is `mean(cost_repair) >= 70% * mean(cost_fresh)`. Fold unmeasured zeros into that
mean and the ratio moves **down** — and down is the direction that reads as *"repair is cheap,
the thesis passed"*. A fabricated pass is worse than a fabricated fail, because nobody goes
looking for the bug behind good news. The same zeros enter `amortizedTokensOverN`'s numerator,
where a *sum* understates every point after the first delegated run and produces a decline for
the wrong reason — the exact failure [#123](https://github.com/DevToolie/Paragent/issues/123) was
filed about.

## Decision

**1. A proposal declares whether its cost was observed.** `RepairProposal.cost_measured?:
boolean`. `false` means "real tokens may have been spent and nobody counted them". **Absent means
measured** — every client that runs inference counts it, and the stub's zeros are true.

The flag lives on the *proposal*, not on the client, because it is a fact about one answer rather
than about a class. A run could mix clients; the run row must reflect what actually happened.

**2. The runner makes it sticky per run.** One unmeasured proposal makes the whole run's
`cost_repair` an undercount, so `ReplayRunner` ORs the flag across the run and emits
`repair_cost_measured: false` on the run row. Only when false: emitting `true` on a run that never
asked anybody anything would assert a measurement that did not happen.

**3. Marked rows leave the cost aggregates — excluded, not zero-filled, not silently dropped.**

- `repairCostVsFresh()` computes over `filterCostMeasuredRuns()`. All rows excluded → `no_data`,
  never `0`.
- `amortizedTokensOverN()` returns `no_data` if **any** run inside the window is unmeasured. The
  window is ordered first and filtered second, so exclusion cannot slide a later run into it.

**4. Outcome aggregates keep those rows.** `selfHealRate`, `taskSuccessLe2Repairs` and
step-validity are unchanged. Whether a repair *worked* is observed by the runner regardless of
whose budget paid for it, and discarding that would throw away real data to solve a cost problem.

**5. Wall-clock goes with tokens.** A delegated repair's elapsed time is the host's whole turn —
its own tool loop, its queueing, possibly a human — so it is not the same quantity as an API
call's latency, and it is not comparable against `cost_fresh`'s wall-clock either.

**6. The report states what it skipped.** `buildGateReport` publishes `cost_provenance`
(`runs_total`, `runs_cost_measured`, `runs_cost_unmeasured`) beside the sample floor and the
truncation summary, for the same reason both of those exist: a `no_data` has to be explainable
from the report itself. Without it, the honest exclusion and a silent drop look identical.

**7. The transport stays a callback.** An injected async function is the primitive; an MCP tool
would wrap it rather than replace it. No wire format is frozen by this ADR.

## Alternatives rejected

- **Let the host report its own token counts.** It is the obvious ergonomic answer and it is an
  estimate by another name — a host reporting *its* usage for *its* turn is not reporting what the
  repair cost, and CONTRIBUTING rule 3 does not have a "the user said so" exemption.
- **Excluding by `notes` string.** The note exists for humans. An aggregate that greps prose for
  its exclusion rule breaks the first time someone rewords a message.
- **Refusing to emit a run row at all for a delegated run.** It would keep §9 clean and lose the
  self-heal and task-success data, which are measured and valuable.
- **Defaulting `cost_measured` to `false` and requiring clients to opt in to `true`.** Safer in
  the abstract; in practice it would retroactively invalidate every row already written and every
  measuring client that predates the field, for no gain — there is exactly one client that cannot
  measure.

## Consequences

- `sanitizeProposedAction` moved from `repair-anthropic.ts` to `repair.ts`. Two clients now share
  the frozen-assertion guard, and the client whose whole purpose is needing no API key does not
  load the Anthropic SDK to get it. Same function, same behaviour; the package index still
  exports it.
- **#189 does not unblock [#39](https://github.com/DevToolie/Paragent/issues/39), and this ADR is
  the reason it cannot be described as if it does.** A measured denominator needs a real `usage`
  block, which is exactly what a delegated client cannot produce.
- A gate run configured with the delegated client will report `no_data` for both cost metrics.
  That is the correct outcome and it is also a trap for whoever runs it: **the §9 measurement run
  must use `AnthropicRepairModelClient`**, and `--repair-model` remains the way to get it.
  `cost_provenance` is what makes that mistake visible after the fact.
- `contracts/metrics.schema.json` gains one optional boolean. Additive; every existing row stays
  valid and means exactly what it meant before.

## Open questions / what I could not verify

- **No delegated repair has ever run against a real host agent.** The client is exercised by a
  fake callback in the unit and canary suites. Whether a host agent given
  `RepairEgressPayload` actually proposes a *useful* `corrected_action` — as opposed to a
  well-formed one — is unmeasured, and the payload was designed for a prompt this codebase
  controls, not for an arbitrary caller's reasoning loop.
- **Whether `no_data` is loud enough.** A gate run that silently produced no cost numbers because
  someone left the delegated client wired is a plausible way to waste a Docker matrix run.
  `cost_provenance` reports it; nothing *refuses* it. A hard failure in `run-matrix.ts` when the
  repair client cannot measure may be the better posture, and is not decided here.
- **The 120-second default ceiling is a guess**, not a measurement of how long host agents take.
  No host has been observed. It is a hang guard, not a tuned budget.
- **The package has no root entry point.** `package.json` declares `bin` and no `main`/`exports`,
  so a host agent embedding this client deep-imports
  `paragent/dist/src/runner/repair-delegated.js`. That works and it is not what a library consumer
  expects. Adding a root export freezes a public API surface, which is a packaging decision this
  ADR deliberately does not make — but #189's premise ("works out of the box for an agent that
  already has model access") is only half-delivered until someone does.
- Whether an MCP wrapper should carry the same flag automatically, or whether a host reaching
  Paragent over MCP has some way to report usage that a callback does not. Not investigated.
