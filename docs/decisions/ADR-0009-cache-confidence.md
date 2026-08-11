---
title: "ADR-0009 — Confidence decay, self-invalidation, and the repair rewrite"
doc_type: adr
status: accepted
owner: B5
created: 2026-08-03
updated: 2026-08-10
confidence: HIGH
supersedes: null
sources_verified: true
---

# ADR-0009 — Confidence decay, self-invalidation, and the repair rewrite

## Status

accepted

## Context

**Triggered by:** issue #64.

`contracts/cache-row.schema.json` has carried `confidence`, `success_count`,
`failure_count` and `last_verified_at` on every row since B5. **Nothing ever updated them.** The
compiler writes zeros; `ReplayRunner` never touched the cache at all. PRD §5.3 makes those fields
the mechanism rather than bookkeeping:

> Entries are confidence-weighted by recent success rate; **stale entries self-invalidate on
> assertion failure**; the repair rewrites the entry — self-healing

and §11 names staleness as the top research-flagged risk, mitigated by "assertion-guards +
confidence decay + self-heal — *Design law, not feature*." Until #64 those were four fields
describing a self-healing cache that did not exist.

Two things had to be decided, and only one of them is arithmetic.

**Marking staleness needs somewhere to put the mark.** `cache-row.schema.json` sets
`additionalProperties: false` and has no field for invalidation or for linking a rewritten row to
the repair that produced it. Per CONTRIBUTING — *"prefer extending a schema via ADR over ad-hoc
JSON fields"* — that makes this a schema change, so it gets an ADR. This is the same route #107
took for `wait_ms`.

**The numbers are choices, not findings.** `docs/INTEGRITY-AUDIT.md` category B exists because
this repo has previously presented unmeasured values as if measured. Nothing here is measured,
and the ADR says so in the decision itself rather than in a footnote.

## Options considered

### A — Derive invalidation from `confidence < threshold` at read time (rejected)

No schema change: a reader computes staleness from the stored confidence.

Honest case for: nothing to add to the contract, and the two can never disagree.

Honest case against: **retroactive relabelling.** Tuning the threshold later would silently
change what every historical row *was*, including rows written during a gate measurement. The
store is append-only precisely so the record of what churn did survives; a derived marker throws
that away for the one field where the history is the point. It also cannot express "invalidated
at 14:02 on the third failure" — only "is currently below a line whose value has since moved".

### B — Store `invalidated_at`, plus `repair_provenance` on rewritten rows (chosen)

Two optional fields on the row.

Honest case for: records the decision **as made at the time**, which is what an audit trail is.
Both are optional and additive, so no existing artifact is invalidated and none needed
regenerating (`npm run validate:contracts` passes unchanged on all six). `invalidated_at`
doubles as the timestamp and the marker — non-null means invalidated — so there is no way for a
boolean and a date to disagree.

Honest case against: two more fields on a contract that governs every cached row, and a
`confidence`/`invalidated_at` pair that a buggy writer could desynchronise. Mitigated by both
being written only by `applyOutcome()`, which sets them together.

### C — A plain success rate (`success_count / (success + failure)`) (rejected)

Honest case for: no decay parameter to justify; trivially explainable.

Honest case against: it fails §5.3's own example. A row that passed 100 times last year and
failed 3 times today scores **0.97** and reads as healthy, when it is exactly the stale entry the
mechanism exists to catch. Recency has to dominate, which an average cannot express.

## Decision

**B**, with an exponentially-weighted confidence.

### Contract

Added to `contracts/cache-row.schema.json`, both optional:

| Field | Meaning |
| --- | --- |
| `invalidated_at` | ISO timestamp at which confidence first fell below the threshold; `null` when not invalidated |
| `repair_provenance` | `{ repaired_at, run_id, repair_attempt, replaced_action_type? }` — present only on a row written by a repair rewrite |

### The confidence function

```
observations = success_count + failure_count
c' = observed                                     when observations == 0
c' = α · observed + (1 − α) · c                   otherwise
observed = 1 on success, 0 on failure
α = CONFIDENCE_ALPHA = 0.3
invalidated when c' < INVALIDATION_THRESHOLD = 0.5
```

**α = 0.3 and threshold = 0.5 are chosen defaults. They are not measured and no measurement is
claimed.** What justifies them is the behaviour they produce, which is stated here and pinned by
`tests/unit/cache-confidence.test.ts`:

| Situation | Result |
| --- | --- |
| Fresh row, first PASS | `1.0` — one observation, and it succeeded |
| Fully-confident row, two consecutive failures | `0.49` → **invalidated** |
| …then one PASS | `0.643` — recovers |
| Fresh row, first-ever failure | `0.0` → **invalidated** immediately |
| Passed 100×, then 3 failures today | `0.343` → **invalidated** |

Lower α would make the cache slow to notice churn — the thing it exists to notice. Higher would
make a single flake look like staleness, and [#66](https://github.com/DevToolie/Paragent/issues/66)
has not yet established how flaky the harness is; when it has, these are the two numbers to
revisit, and revisiting them is a decision, not a tuning.

**Zero observations is `no_data`, not low confidence.** The first observation seeds the value
directly rather than decaying from the compiler's `confidence: 0`, and an unobserved row is never
invalidated — otherwise the entire cache would be marked stale the moment it was compiled. This
is the same distinction `src/metrics/aggregate.ts` draws when it reports `no_data` rather than 0.

### The repair rewrite

On `REPAIRED_PASS` the recorded action was wrong and a different one worked. The new version
carries the corrected action, `confidence: 1`, `success_count: 1`, `failure_count: 0` — a new
action starts as verified-once rather than inheriting the record of the action it replaced — plus
`repair_provenance` linking it to the run and attempt that produced it. The superseded version
stays on disk; the store is append-only.

**"Only on a row written by a repair rewrite" is enforced, not just documented**
([#114](https://github.com/DevToolie/Paragent/issues/114)). The next `PASS` or failure on that
lineage clears the field, so provenance describes exactly one version. Carried forward it would
make every later version claim to be the repair's output, with a `repaired_at` that no longer
matches its own `last_verified_at` — an internally inconsistent row in the one place the design
calls an audit trail. The repair itself is not lost: the earlier version is still on disk, which
is where the history lives.

`REPAIRED_PASS` is deliberately **not** scored as a plain pass. Scoring it that way would raise
confidence in an action that had just failed.

## Consequences

**Confidence never gates the gate measurement.** Nothing consults it to decide whether to attempt
a step. During Track 1 it is *recorded*, not *acted on*, because skipping a low-confidence row
would quietly shrink the step-validity denominator and inflate the headline number.
`tests/unit/cache-non-gating.test.ts` pins the strong form: the same program replayed against a
healthy cache and against an invalidated one produces byte-identical runs.

**A repair rewrite is a write, and the boundary applies.** A model-proposed `corrected_action`
can carry a locator the original never had, so the update path hands every candidate to
`writeCacheRow()` rather than re-implementing the check. A repair whose locators are *all*
tainted comes back correctly classified but with an empty fallback chain — an action that cannot
resolve — and is **refused** rather than persisted, leaving the previous version standing. The
step's failure is already in the metrics, which is where a failure belongs.

**Opt-in.** `ReplayRunnerOptions.onStepOutcome` is optional and the runner keeps no dependency on
`src/cache/`. A runner without a sink behaves exactly as it did before #64, which is what keeps
the gate matrix unaffected.

**Still no cache hit.** This closes the *update* half of §5.3. Nothing yet reads from the cache to
skip fresh reasoning, so there is still no hit-rate — `docs/architecture.md` stub 5 stays open on
that half.

## Reversal cost

**Low.** Both fields are optional, so rows written under this ADR remain valid if it is reversed;
the update path is one module plus an optional callback, and removing the callback restores
pre-#64 behaviour exactly. What would be lost is the recorded history — invalidation timestamps
and repair provenance cannot be reconstructed after the fact.

## Open questions / what I could not verify

- **Whether α = 0.3 and threshold = 0.5 are the right values.** They are chosen, not measured.
  #66's repeat-run spread is the first evidence that could inform them: if the harness turns out
  to be flaky at all, α = 0.3 will read flakiness as staleness.
- **Whether recovery should be symmetric with decay.** A row deep in the hole (confidence 0 after
  many failures) needs several successes to climb back, while a perfect row falls below the line
  in two. That asymmetry is deliberate — a failure is stronger evidence than a success — but it
  is asserted, not demonstrated.
- **What should happen when a repair is refused.** Today the previous version stands and the
  failure appears only in the metrics. An alternative is recording the refusal on the row itself,
  which would need a third field and is not obviously worth it before anything reads the cache.
- **Whether `confidence` should be recomputed when a bundle is recompiled.** A recompile produces
  fresh rows at `confidence: 0`, discarding the history of the rows they replace. Nothing does
  this yet because nothing reads the cache, but it is the obvious way for the history to be lost
  silently.
