---
title: "Cache — persistence, confidence, and the repair rewrite"
doc_type: spec
status: draft
owner: B5
created: 2026-08-03
updated: 2026-08-12
confidence: MED
supersedes: null
sources_verified: true
---

# Gate — Cache (B5)

The write-time privacy boundary is specified in
[privacy/boundary-spec.md](../privacy/boundary-spec.md); this doc covers what the cache **does**
once a row is written — persistence, confidence, self-invalidation, and the repair rewrite.

## Package layout (`src/cache/`)

| Module | Responsibility |
| --- | --- |
| `allowlist.ts`, `taint.ts` | The vocabulary and taint rules the boundary enforces |
| `write.ts` | `writeCacheRow` / `writeCacheRowPair` — **the only writer**, and the gatekeeper |
| `store.ts` | `CacheStore` (`write`/`get`/`list`), `JsonlCacheStore` (append-only, two files), `MemoryCacheStore` |
| `confidence.ts` | The §5.3 model: decay, invalidation, repair rewrite ([ADR-0009](../decisions/ADR-0009-cache-confidence.md)) |
| `update.ts` | `recordStepOutcome` — turns a step outcome into the next row version |
| `resolve.ts` | `resolveProgram` — a whole program out of per-step rows, or a MISS with a reason ([ADR-0013](../decisions/ADR-0013-cache-program-entity.md)) |
| `pipeline.ts` | Canary pipeline (merge-blocking) |

## A program is a level above a row

The cache is keyed per step, which is right for a row and insufficient for the thing a hit
serves. Since [ADR-0013](../decisions/ADR-0013-cache-program-entity.md) every row carries a
`program` object — `program_id`, `steps_total`, `compiled_at` — written by the compiler, which
is the only actor that has seen the whole trajectory.

`steps_total` is the field that matters. Without it, rows 0-3 of an 8-step flow are
indistinguishable from a complete 4-step flow, because **every individual row is valid in both
cases**. The consequence is not a bad number: it is a browser executing half a flow and stopping
inside a form.

`resolveProgram(store, { site_key, task_key })` therefore returns a program **only** when it holds
`steps_total` contiguous rows starting at 0, all under one `program_id`. Anything else is a MISS
with a reason — `no_rows`, `no_program_ref` (rows predate ADR-0013; completeness is never
inferred), or `incomplete`. There is no "probably complete", and no shortened program is ever
returned.

`required_params` is **derived** from the resolved rows by `rowsToProgram()`, not stored on them,
so a stale declaration cannot disagree with the steps it describes.

### Completeness fails closed. Confidence does not.

Two questions, deliberately opposite answers — this is the part most likely to be "fixed" later:

| Question | Kind | Behaviour |
| --- | --- | --- |
| Do I hold every step? | structural | **fails closed** — MISS |
| Are those steps still trustworthy? | empirical | **reported, never enforced** |

A program is flagged `invalidated` when any of its rows is (a flow is only as replayable as its
worst step), and is still returned **whole, with every row**. That is the rule below arriving
through a new door: a read path is exactly where someone adds `if (row.confidence < THRESHOLD)
skip`. `tests/unit/cache-resolve.test.ts` pins it, and is guard-proven — making the resolver drop
invalidated rows fails three tests.

## The read path, and what a hit is

Since [ADR-0014](../decisions/ADR-0014-cache-read-path.md) the matrix driver can resolve its
program **from the cache** instead of from a file: `gate:matrix --from-cache <dir> --site-key <k>
--task-key <k>`. It is opt-in, nothing in CI passes it, and `--program <bundle>` is unchanged and
still the default — it is the only thing that works with no cache behind it.

A hit is **provenance plus outcome**, and the two are stored separately:

```
cache hit  ≡  program_source == "cache"  AND  replay_valid
```

Replay uses no model, so a hit cannot mean "skipped a model call" — it means *this run did not
need fresh reasoning to obtain a program*. Whether the program then worked is `replay_valid`,
which already exists and is **not** redefined. A step that needed repair is a miss even though it
passed, because it cost model tokens.

`program_source` is never defaulted. A run that never consulted a cache emits nothing, so it lands
in no hit-rate denominator — `no_data`, not `0%`. Aggregating this into a §9 section is
[#67](https://github.com/DevToolie/Paragent/issues/67).

**A MISS refuses the run.** `--from-cache` exits before any container boots, the same posture an
unbound parameter takes (#122): a refused run is not a failed run, it is an absent one, and it
contributes to no denominator.

### Reading is the first outbound flow

Every control before this one governs what may **enter** the pool. Reading is the other
direction, and *"nothing tenant-scoped got in"* is a different claim from *"nothing tenant-scoped
comes back out to the wrong tenant"*.

A resolution therefore has a scope. `any` (default) is same-tenant reuse. `pool_only` is the
cross-tenant case, where a tenant-scoped row is **invisible** — a program that needs one is a
MISS, not a silently different program. `tests/canary/pool-read-leak.test.ts` is merge-blocking,
asserts it from disk and after a reopen, and is guard-proven: making pool scope fall back to the
merged view fails 4 tests.

Reading never *classifies* — it reads the `pool_eligible` decision `writeCacheRow()` already
stamped. A second classifier would be a second place for the boundary to drift.

> ⚠️ `writeCacheRowPair()` writes **both** copies of a row, and the merged index deliberately lets
> the tenant version win. So `list({ pool_eligible: true })` reads a **second index**, not a
> filtered view of the default one — filtering the default view at pool scope returns nothing for
> every task that has a tenant counterpart, which is all of them.

### Hit-rate is reported (#67)

`cacheHitRate()` in `src/metrics/aggregate.ts` is the fifth §9 secondary metric, and it renders in
`report.json`, `report.csv`, `report.html` and its own `hit-rate.svg`:

```
count(program_source=cache AND replay_valid=true) / count(program_source=cache)
```

It emits a **per-N series** as well as a pooled ratio, because "over time" is part of the metric —
a single number cannot show a trend. `n` indexes **cache-consulting runs**, not all runs, so a run
that never touched the cache cannot flat-line the curve; each point carries its `run_id` for
joining back to the amortized series. §9 pairs the two: amortized cost shows the *effect*,
hit-rate shows the *mechanism*.

**No target and no threshold.** §9 gives a direction ("up") and no number; inventing one would be
the category-B failure `docs/INTEGRITY-AUDIT.md` exists for.

**Still unmeasured.** The section computes, and reports `no_data` — no matrix run has been
executed with `--from-cache` against a populated cache, so there is nothing in the denominator.

## Read order is a store guarantee

`list()` returns rows sorted by `(site_key, task_key, step_index)`. Ordering belongs to the store,
not to each caller: `JsonlCacheStore` loads the pool file to exhaustion before the tenant file, so
insertion order is write order in-process and *file* order after a reload, and a task with mixed
eligibility — the normal case — reads back with its pool rows hoisted to the front. A resolver
assembling a program from `list()` would then replay the flow out of order against a live site
with every row individually valid, which reads as ordinary churn failure.

What "mixed eligibility" actually contains, on the only compiled bundle in the repo: the artifact
itself stamps `1` pool-eligible row of 12 (the compiler's pre-check, `src/compiler/pool.ts`), but
routing the same rows through the **authoritative** write path (`writeCacheRow`, this package) puts
`7` of 12 in the pool file and 5 in the tenant file — see
[`pool-vocabulary.md`](./pool-vocabulary.md) and [ADR-0017](../decisions/ADR-0017-pool-vocabulary-rule.md)
(issue #126). The pool file a real `writeCacheRowPair` call would produce is larger than the
artifact's own stamped field suggests, because nothing today pushes a compiled bundle through this
package automatically (open question below) — the artifact's field is a pre-check, not what
`list({ pool_eligible: true })` would actually return once a row is written for real.

Load order is unchanged and still pool-then-tenant, so a key present in both files reads back as
the tenant-scoped version. Only the read order is sorted. Both stores run the same contract test
(`tests/unit/cache-store.test.ts`), and the reload case is asserted against a `JsonlCacheStore`
reopened from disk — a same-process assertion passes without the fix and proves nothing.

## The one rule that outranks the rest

> **Confidence never gates the gate measurement.**

Nothing in this package is consulted to decide whether to attempt a step. A matrix run attempts
every compiled step regardless of confidence, because skipping a low-confidence row would quietly
shrink the step-validity denominator and inflate the headline number. During Track 1 confidence
is **recorded, not acted on**.

This is exactly the optimisation a later reader will helpfully add — "why replay a step we know
is stale?" — so it is stated in `src/cache/confidence.ts`, in ADR-0009, and pinned by
`tests/unit/cache-non-gating.test.ts`, which replays the same program against a healthy cache and
an invalidated one and asserts the two runs are identical in every field feeding a §9 aggregate.

## Confidence

```
observations = success_count + failure_count
c' = observed                            when observations == 0     (seed)
c' = 0.3 · observed + 0.7 · c            otherwise                  (EWMA)
invalidated when c' < 0.5
```

**`CONFIDENCE_ALPHA = 0.3` and `INVALIDATION_THRESHOLD = 0.5` are chosen defaults, not measured
values,** and no document may cite them as validated. What justifies them is the behaviour:

| Situation | Confidence | Invalidated? |
| --- | --- | --- |
| Fresh row, first PASS | `1.0` | no |
| Fully-confident row, two consecutive failures | `0.49` | **yes** |
| …then one PASS | `0.643` | no |
| Fresh row, first-ever failure | `0.0` | **yes** |
| Passed 100×, then 3 failures today | `0.343` | **yes** |

That last row is PRD §5.3's own example of a stale entry. A plain success *rate* would score it
`100/103 = 0.97` and call it healthy, which is why the weighting is exponential — see ADR-0009
option C.

**Zero observations means no data, not low confidence.** The compiler writes `confidence: 0` on
every fresh row; treating that as staleness would mark the whole cache invalid the moment it was
compiled. An unobserved row is never invalidated, and the first observation seeds the value
directly rather than decaying from zero.

**Invalidated rows are kept, never deleted.** Deletion would destroy the record of what churn
did, which is the entire experiment. `invalidated_at` is stored rather than derived from
`confidence < 0.5` so that later tuning of the threshold cannot retroactively relabel history.

## Outcome mapping

| `StepOutcome` | Effect |
| --- | --- |
| `PASS` | success; refreshes `last_verified_at` |
| `REPAIRED_PASS` | **rewrite** — see below. Not a plain pass: the recorded action failed |
| `ASSERTION_FAILED`, `LOCATOR_NOT_FOUND`, `TIMEOUT`, `PAGE_ERROR`, `REPAIR_EXHAUSTED` | failure; does **not** refresh `last_verified_at` |
| anything unrecognised | row left untouched |

A failure is an observation, but it is not evidence the entry still describes the page, so only a
success re-verifies.

## The repair rewrite

On `REPAIRED_PASS` the new version carries the corrected action at `confidence: 1`,
`success_count: 1`, `failure_count: 0`, plus `repair_provenance` naming the run and attempt. A
new action starts verified-once rather than inheriting the track record of the action it
replaced.

`repair_provenance` describes **the write that produced a version**, not the row's lifetime, so it
is stripped on every non-repair update and re-stamped by each repair. A plain `PASS` after a
repair carries none. Carrying it forward would label a version with a repair that did not write
it, and its `repaired_at` would disagree with that version's own `last_verified_at` — the JSONL
history is the record of what churn did, and a row that misstates its own origin is not a record.
The strip lives in `forRewrite()`, alongside the `pool_eligible` strip and for the same reason, so
neither branch of `applyOutcome` has to remember it.

**A repair is a write, and the boundary applies to it.** This is the new attack surface: before
#64 every cached row came from the compiler, whose output the canary already covers. Now a
*model* proposes a `corrected_action` that becomes a persisted row, so it can introduce a locator
carrying tenant text the compiler never saw. The update path does not re-implement the check — it
hands the candidate to `writeCacheRow()`.

A repair that comes back with an empty fallback chain — correctly classified, and useless — is
refused rather than persisted, and the previous version stands. All-tainted locators are the
common cause but not the only one: a step whose frozen assertion carries a tenant literal is
written with no locators at all, so a repair proposing perfectly clean locators against it hits
the same refusal. The message is worded from `pool_ineligible_reason` rather than assuming
locators were involved. The step's failure is already in the metrics, which is where a
failure belongs. `tests/canary/repair-rewrite.test.ts` covers both directions — a tainted repair
refused with the store untouched, and a clean repair accepted, so the refusal is not blanket.

## Wiring

```ts
const runner = new ReplayRunner({
  page,
  onStepOutcome: createCacheUpdateSink({ store: new JsonlCacheStore({ dir }) }),
});
```

`onStepOutcome` is **optional**, and the runner keeps no dependency on `src/cache/` — the
observation shape is declared structurally in `src/runner/types.ts` and the cache supplies the
implementation. Runner → cache would be backwards: the cache is written *to*. A runner without a
sink behaves exactly as it did before #64, which is what keeps the gate matrix unaffected.

The observer runs **after** the metric row is emitted and its return value is ignored, so it
cannot influence what was measured. A sink that throws is reported and the run continues: the run
is the measurement, and losing the recording is strictly better than losing the measurement.

## Sources

| Claim | Source | Access date |
| --- | --- | --- |
| Confidence-weighting, self-invalidation, repair rewrite | `docs/prd/PRD-trajectory-cache-v0.2.md` §5.3 | 2026-08-03 |
| Staleness as top research-flagged risk | `docs/prd/PRD-trajectory-cache-v0.2.md` §11 | 2026-08-03 |
| Row fields and `additionalProperties: false` | `contracts/cache-row.schema.json` | 2026-08-03 |
| Chosen defaults and the rejected alternatives | `docs/decisions/ADR-0009-cache-confidence.md` | 2026-08-03 |
| Two-file append-only store | `docs/privacy/boundary-spec.md` | 2026-08-03 |

## Open questions / what I could not verify

- **There is still no cache hit.** #64 closes the *update* half of §5.3. Nothing reads the cache
  to skip fresh reasoning, so there is no hit-rate and no amortization measurement behind it —
  `docs/architecture.md` stub 5 stays open on that half.
- **α and the threshold are unvalidated.** [#66](https://github.com/DevToolie/Paragent/issues/66)'s
  repeat-run spread is the first evidence that could inform them: if the harness is flaky at all,
  α = 0.3 will read flakiness as staleness.
- **Nothing recomputes confidence when a bundle is recompiled.** A recompile produces fresh rows
  at `confidence: 0`, discarding the history of the rows they replace. Nothing does this yet
  because nothing reads the cache, but it is the obvious way for the history to be lost silently.
- **The gate matrix does not wire a sink.** `experiments/gate-v1/live-run.ts` passes no
  `onStepOutcome`, so a live matrix run records no confidence today. Wiring it is deliberate
  future work — it would make the gate's own runs mutate a cache, and that ordering deserves its
  own decision.
