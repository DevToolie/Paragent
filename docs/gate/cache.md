---
title: "Cache — persistence, confidence, and the repair rewrite"
doc_type: spec
status: draft
owner: B5
created: 2026-08-03
updated: 2026-08-10
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
| `pipeline.ts` | Canary pipeline (merge-blocking) |

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

## Read order is a store guarantee

`list()` returns rows sorted by `(site_key, task_key, step_index)`. **Step order is a property of
the store, not something each caller re-establishes** ([#121](https://github.com/DevToolie/Paragent/issues/121)).

It has to be, because insertion order is not step order and cannot be made to be. The index is a
`Map`, and `JsonlCacheStore` loads `pool.jsonl` to exhaustion before `tenant.jsonl` — deliberately,
so a key present in both reads back as the tenant-scoped version, the conservative direction. That
load order is unchanged. Within one process the difference is invisible, because rows enter the
index as they are written; after a reopen, every pool row is inserted before every tenant row, and
a task with mixed eligibility comes back interleaved wrong. Mixed eligibility is the normal case —
1 of the 12 rows in the only committed live bundle is pool-eligible.

The consequence is not a cosmetic one. A resolver assembling a program from `list()` would replay
a real flow out of order — click before navigate, submit before fill — with every row individually
valid, which reads as ordinary churn rather than as a bug. `bundleToProgram` already sorts by
`step_index` for the same reason (`src/runner/program.ts`); the store is the other way in.

Sorting lives in `IndexedCacheStore` so `MemoryCacheStore` and `JsonlCacheStore` cannot diverge,
and the contract test in `tests/unit/cache-store.test.ts` reopens the JSONL store from disk — a
same-process assertion passes without the fix and proves nothing.

## The repair rewrite

On `REPAIRED_PASS` the new version carries the corrected action at `confidence: 1`,
`success_count: 1`, `failure_count: 0`, plus `repair_provenance` naming the run and attempt. A
new action starts verified-once rather than inheriting the track record of the action it
replaced.

**A repair is a write, and the boundary applies to it.** This is the new attack surface: before
#64 every cached row came from the compiler, whose output the canary already covers. Now a
*model* proposes a `corrected_action` that becomes a persisted row, so it can introduce a locator
carrying tenant text the compiler never saw. The update path does not re-implement the check — it
hands the candidate to `writeCacheRow()`.

A repair whose locators are **all** tainted comes back correctly classified but with an empty
fallback chain: an action that cannot resolve anything. That is refused rather than persisted,
and the previous version stands. The step's failure is already in the metrics, which is where a
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
