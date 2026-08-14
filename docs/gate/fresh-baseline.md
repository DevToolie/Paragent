---
title: Fresh-reasoning baseline (B4, #39)
doc_type: spec
status: draft
owner: B4
created: 2026-08-14
updated: 2026-08-14
confidence: MED
supersedes: null
sources_verified: true
---

# Gate — Fresh-reasoning baseline (#39)

PRD §9's kill line is a ratio:

> **mean repair cost ≥ 70% of fresh-reasoning cost** (tokens + wall-clock, **measured, not
> estimated**) → thesis is dead

and the §12 amortized-cost curve's demo is the *decline* from a full-price first run.
Both need a denominator: what it costs a model to do the gate task **from scratch**, with no
compiled trajectory. This doc defines that denominator in writing, as issue #39 requires, before
any number exists. If you are looking for the number: **there is not one yet.** This PR ships the
harness that measures it. The live measurement — 3+ fresh runs against a real Grafana instance
with a real `ANTHROPIC_API_KEY` — is separate work, costs real money, and is deliberately out of
scope here. See "Status" below.

## What "fresh" means

A model is handed:

1. **The task's stated goal**, in prose — `DEFAULT_TASK_GOAL` in
   [`experiments/gate-v1/fresh-baseline.ts`](../../experiments/gate-v1/fresh-baseline.ts), phrased
   at the same level of intent as [ADR-0006](../decisions/ADR-0006-track1-gate-task.md)'s decision
   table ("add a panel, configure it, save the dashboard, confirm it's listed"). Never the
   compiled program's per-step DOM detail.
2. **The live page**, through the exact same privacy-safe capture the repair model already uses:
   `capturePageState(page, "interactive")` (`src/runner/page-state.ts`) — URL, title, landmark
   roles, and the role + accessible name of interactive elements. No raw HTML, no input values, no
   cookies, no storage ([ADR-0012](../decisions/ADR-0012-repair-context-budget.md)). A fresh agent
   sees no more of the page than a repair does; it sees it for a whole task instead of one failed
   step.

A model is **never** given:

- The compiled program's steps, locators, or assertions.
- Any cached locator, `program_id`, `site_key`/`task_key` it could use to look one up.
- A prior attempt's trajectory to consult.

It drives the browser itself, one action at a time, until it reports the task done. Its own
report of success is provisional — see "What this does not settle" below — but nothing about the
*mechanism* is: it sees the page and the goal, the same way ADR-0006's "honest case against" for
the gate task (§ "the outcome is API-equivalent") concedes the compiled program's outcome could be
reached by one API call, yet eleven of its twelve steps have no API representation at all. A fresh
model reaching the same outcome by driving the DOM is measuring the same kind of cost the compiled
program pays to survive churn — a *different* run of the *same task*, never a shortcut around it.

### Same task, same instance (#39 step 2)

The baseline must be measured against the **same seeded testbed version** and the **same
`site_key`/`task_key`** as the compiled program it is compared to, or the ratio compares two
different things wearing the same units. `experiments/gate-v1/fresh-baseline.ts` enforces this
structurally: it reads `site_key`/`task_key` from the same `--program` bundle `gate:matrix`
replays (never from a separate declaration that could drift), and defaults `--version` to the
matrix's first pin (`9.5.21` — the base recording version, per ADR-0006's "Method").

## Token accounting — matched to the repair client, exactly

§9's ratio is `mean(cost_repair) / mean(cost_fresh)`. If the two sides accounted for tokens
differently, the ratio would compare numbers in different units wearing the same name. So
[`src/runner/fresh-baseline-anthropic.ts`](../../src/runner/fresh-baseline-anthropic.ts) does not
re-derive the convention `src/runner/repair-anthropic.ts` chose for issue #27 — it reuses it:

| Decision | How it's matched |
| --- | --- |
| Billed input tokens | `billedInputTokens()` is **imported from `repair-anthropic.ts`**, not reimplemented. Sums `input_tokens + cache_read_input_tokens + cache_creation_input_tokens` |
| Prompt caching | Off. No `cache_control` on any message block, on either client |
| Retries | None, on either client. A turn that throws ends the attempt; tokens already billed on prior turns are kept, never guessed at for the one that failed |
| Server-side `fallbacks` | Not sent, on either client — the model that was billed must be the model `model_id` names |
| `temperature` / `top_p` / `top_k` | Not sent, on either client — 400s on `claude-opus-5` |
| Output shape | Structured output (`output_config.format: json_schema`) on both — never free-text parsing |
| Missing `ANTHROPIC_API_KEY` | Throws at construction on both (`MissingAnthropicKeyError` / `MissingFreshBaselineKeyError`) rather than degrading to a stub that would report a measurement that looks real |
| Default model | **The same model**, `DEFAULT_FRESH_MODEL = DEFAULT_REPAIR_MODEL` (`claude-opus-5`). A different default model on either side of the ratio would make the comparison about model choice instead of about fresh-vs-repaired reasoning |

One difference, and it is a difference in *what is measured*, not in *how*: the repair client
makes **one call per repair attempt** (a single proposal); the fresh-baseline client makes **one
call per turn**, looping until the model reports the task done or `DEFAULT_MAX_TURNS` (30) is
reached, and sums tokens across every turn. The measured quantity for `cost_fresh` is the whole
task attempt, because that is what §9 compares against — a repair proposal is one decision, a
fresh run is the decision the compiled program's whole trajectory replaces.

## What this harness builds

Three modules under `src/runner/`, deliberately split the way `repair.ts` /
`repair-anthropic.ts` already are:

| Module | Role | Why separate |
| --- | --- | --- |
| [`fresh-baseline.ts`](../../src/runner/fresh-baseline.ts) | `FreshBaselineClient` interface, `FreshBaselineContext`/`FreshBaselineAttempt` types, `StubFreshBaselineClient` | The seam. `ReplayRunner` depends on `RepairModelClient`, not on `AnthropicRepairModelClient`, so the SDK never has to be mocked at the runner level — only at the client's own tests. `FreshBaselineRunner` gets the same property |
| [`fresh-baseline-anthropic.ts`](../../src/runner/fresh-baseline-anthropic.ts) | `AnthropicFreshBaselineClient` — the real SDK wiring, the turn loop, the token accounting | Everything that touches `@anthropic-ai/sdk` lives here and nowhere else, mirroring `repair-anthropic.ts` exactly. A reviewer auditing "does this ever make a network call" has one file to read, not three |
| [`fresh-baseline-runner.ts`](../../src/runner/fresh-baseline-runner.ts) | `FreshBaselineRunner` — measures wall-clock around one attempt, emits a `RunMetric` row via `MetricsEmitter`, catches a client that breaks its own contract | The orchestration layer is client-agnostic: it takes any `FreshBaselineClient` (stub or real) and does the same thing `ReplayRunner` does around `RepairModelClient` — measure, sanitize, emit. Collapsing this into the Anthropic client would mean the emission and zeros-on-failure logic could only be tested by mocking the SDK; kept apart, `fresh-baseline-runner.test.ts` exercises it with a hand-written fake client and never touches `@anthropic-ai/sdk` at all |

Plus one entry point, [`experiments/gate-v1/fresh-baseline.ts`](../../experiments/gate-v1/fresh-baseline.ts)
(`npm run gate:baseline`) — a **separate script from `run-matrix.ts`**, not a mode of it, because
it measures a different experiment against a different (and much smaller) unit of work: one
version, N repeats, no matrix walk. It mirrors `run-matrix.ts`/`live-run.ts`'s conventions
directly: the same `--dry-run` / live split, the same bring-up-seed-browser-teardown sequence
(reusing `src/testbed/docker.ts`, `readiness.ts`, `seed.ts`, `src/recorder/preamble.ts` verbatim,
not a re-implementation), the same "a skip is not a failure" posture, and the same append-as-you-go
NDJSON write.

### Why the split earns its keep here specifically

The alternative — one file — was considered and rejected for the same reason `repair.ts` /
`repair-anthropic.ts` are two files today: `fresh-baseline-anthropic.ts` alone is ~350 lines of
SDK request-shape, turn-loop, and error-path logic, most of which the runner-level tests (cost
mapping, zeros-on-failure, `model_id` propagation) have no reason to exercise through a mocked
`Anthropic` client. Collapsing the three into one file would force every runner-level test to
carry SDK mock scaffolding it does not need, the same tax `repair-anthropic.test.ts` currently
avoids by testing `AnthropicRepairModelClient` in isolation from `ReplayRunner`. The three-way
split is not a new pattern invented for #39; it is the existing one, applied a second time because
the two clients now share exactly the same constraint (§9 wants both measured identically) and
should not drift into different shapes for no reason.

### A failed attempt is zeros, never partial garbage

`AnthropicFreshBaselineClient.attempt()` reports real tokens for every turn that actually billed,
and zero for the turn that did not — mirroring `AnthropicRepairModelClient.propose()`'s catch
block ("tokens consumed are unknowable here, so they are reported as zero rather than guessed").
`FreshBaselineRunner.run()` adds one more layer: if a client breaks its own contract and `attempt()`
throws instead of returning, the emitted row is `cost_fresh: zeroCost()`, `task_success: false`,
and an explicit note — never a `Cost` object partially built from whatever happened to be in scope
at the moment of the throw. `tests/unit/fresh-baseline-runner.test.ts` pins this directly: a client
that throws produces an all-zero row, not a row with some real-looking numbers mixed with garbage.

### Why fresh-baseline rows never reach `gate:matrix`'s own NDJSON

`FreshBaselineRunner` emits through the same `MetricsEmitter` class `ReplayRunner` uses — but to
its **own file**, `out/fresh-baseline/metrics.ndjson`, never `out/metrics.ndjson`. A `RunMetric`
row for a fresh attempt has no compiled steps and no repair loop, so `steps_total`,
`steps_replay_valid`, and `cost_repair` are honestly zero — but `repairCostVsFresh()` and
`taskSuccessLe2Repairs()` in `src/metrics/aggregate.ts` pool **every** run row in the file they are
given, unconditionally. A fresh-baseline row mixed into the matrix's own NDJSON would count as an
extra zero-repair "run" and silently dilute both the real success rate and the real mean repair
cost. `gate:report`'s `generate-amortized.ts` hard-codes `out/metrics.ndjson` as its only input, so
as long as the two files stay apart — which the entry points do by construction — this cannot
happen by accident.

### How a measured baseline reaches the matrix

`gate:baseline` writes `out/fresh-baseline/baseline.json` — the protocol record (below) plus the
mean and spread. `gate:matrix --cost-fresh <path>` reads it, refuses (exit 2) unless
`usable: true`, and attaches its `mean_cost_fresh` to **every live run row's** `cost_fresh` field
via `ReplayRunner`'s existing `costFresh` option (`src/runner/replay.ts`, unchanged by #39). That
is the mechanism issue #39 step 4 describes, and it is the *only* mechanism — the fresh-baseline
runner's own NDJSON plays no part in it. Ignored under `--dry-run`, whose rows must stay all-zero.

## The #123 correction

Issue #39, as filed, predates issue #123 / [ADR-0010](../decisions/ADR-0010-amortization-cost-model.md).
Its step 4 says to "attach [`cost_fresh`] to run rows so `repairCostVsFresh()` **and**
`amortizedTokensOverN()` compute" — that was true when written and is no longer true at `HEAD`.
ADR-0010 split one overloaded field into two:

- `cost_fresh` — the **per-run comparison baseline**, §9's ratio denominator. This is what #39
  measures and what this harness wires in.
- `cost_program_build` — the **one-time capital cost** of producing the compiled program,
  amortized by `amortizedTokensOverN()`. Nothing in this PR measures it, and nothing here wires it.

This harness follows the code at `HEAD`, not the issue's original point 4: `cost_fresh` feeds
`repairCostVsFresh()` only. `amortizedTokensOverN()` stays `no_data` until a `cost_program_build`
is separately measured and attached via `ReplayRunnerOptions.costProgramBuild` /
`programBuildId` — a different measurement than this one, not yet built.

## Status: harness only

This PR ships the measurement **mechanism** — the client, the runner, the entry point, the
wiring into `gate:matrix`, and this definition. It does **not** ship a measured number, because:

- No live model call has been made against this code. `cost_fresh` stays zeros; `repair cost vs
  fresh` and `amortized tokens/task` stay `no_data` in `gate:report`'s output.
- A live baseline run costs real money and needs `ANTHROPIC_API_KEY`. Per CONTRIBUTING rule 3,
  *never invent a metric* — there is no number here to invent, and none is.
- The issue's own checklist wants **at least 3 fresh runs, mean and spread both reported**, and
  `model_id`, effort, date, and testbed version recorded alongside every figure. Doing that
  responsibly is the follow-up work this harness exists to make possible, not something to rush
  through to close the issue early.

### The protocol record — template, to be filled in when the measurement runs

`npm run gate:baseline` writes this shape to `out/fresh-baseline/baseline.json` automatically; the
table below is what a human reads out of it once a live run has actually happened. All fields are
`[PENDING TRACK-1]` today.

| Field | Value |
| --- | --- |
| `model_id` | `[PENDING TRACK-1]` — recorded from the SDK response, not assumed from `--model` |
| `effort` | `[PENDING TRACK-1]` — `DEFAULT_FRESH_EFFORT` unless overridden |
| `testbed_version` | `[PENDING TRACK-1]` — must match the compiled program's base recording version |
| `site_key` / `task_key` | `[PENDING TRACK-1]` — read from the same `--program` bundle `gate:matrix` replays |
| `runs_attempted` / `measured_runs` | `[PENDING TRACK-1]` — at least 3 measured runs before this is treated as a baseline |
| `date` (`generated_at`) | `[PENDING TRACK-1]` |
| `mean_cost_fresh` (tokens_in, tokens_out, wall_clock_ms) | `[PENDING TRACK-1]` |
| `spread` (min/max per field) | `[PENDING TRACK-1]` — a single run is a sample of one; report the spread, not only the mean |
| `successes` | `[PENDING TRACK-1]` — how many of the measured attempts the model itself reported as done+successful |

## What this does not settle

- **The model self-reports task completion.** `done: true, success: true` is the model's own
  claim, checked against nothing external — there is no compiled assertion available to a fresh
  agent by design (that would be handing it the cached locator it must not have). This is a known
  soft spot: an independent, page-state-based success oracle (e.g., re-using the compiled
  program's *final* assertion only, never its intermediate steps or locators) would make
  `task_success` a measurement rather than a claim. Not built here — flagged for whoever runs the
  live measurement to decide before trusting `successes` as anything more than "the model thought
  it finished."
- **Turn budget and effort are chosen, not measured.** `DEFAULT_MAX_TURNS = 30` and
  `DEFAULT_FRESH_EFFORT = "medium"` are defaults carried over from the repair client's own choices
  or picked to be "well above 12 real steps" — neither is fitted to an observed fresh-agent
  trajectory, because none has been run.

## Sources

| Claim | Source | Access date |
| --- | --- | --- |
| §9 kill line, §12 amortized curve | `docs/prd/PRD-trajectory-cache-v0.2.md` §9, §12 | 2026-07-24 |
| Repair client token accounting | `src/runner/repair-anthropic.ts` | 2026-08-14 |
| `cost_fresh` / `cost_program_build` split | [ADR-0010](../decisions/ADR-0010-amortization-cost-model.md) | 2026-08-14 |
| Repair context budget / privacy posture | [ADR-0012](../decisions/ADR-0012-repair-context-budget.md) | 2026-08-14 |
| Gate task definition | [ADR-0006](../decisions/ADR-0006-track1-gate-task.md) | 2026-08-14 |
| `gate:matrix` / live-run conventions | `experiments/gate-v1/run-matrix.ts`, `live-run.ts` | 2026-08-14 |

## Open questions / what I could not verify

- **No live measurement exists.** Every number this harness could produce is `[PENDING TRACK-1]`
  — see "Status" above. This doc defines the measurement; it does not report one.
- **Whether the model's self-reported `success` is trustworthy enough to publish.** See "What
  this does not settle" — an independent oracle was considered out of scope for the harness PR and
  is an open design question for whoever runs the live measurement.
- **Whether 30 turns and `medium` effort are the right defaults.** Both are chosen, not fitted —
  no fresh-agent trajectory has been observed on the real gate task to check whether 30 turns is
  generous or tight, or whether `medium` effort meaningfully changes the outcome versus `high`.
- **Variance across attempts.** The issue warns that "a single fresh run is a sample of one and
  the variance across attempts may be large." Nothing in this harness bounds that variance or
  predicts it; `spread` in the protocol record exists to surface it, not to explain it.
- **Whether `gate:baseline`'s single-version design is the right scope.** #39 step 2 says "the
  same seeded testbed version... as the compiled program," which is one version, not a matrix
  walk — this harness measures against one pin. Whether a published baseline should be measured
  against more than one version (to see how fresh-reasoning cost itself varies with churn) is not
  answered here.
