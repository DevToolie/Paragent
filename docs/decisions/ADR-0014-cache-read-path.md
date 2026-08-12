---
title: "ADR-0014 — The cache read path, and what a hit is"
doc_type: adr
status: accepted
owner: B4
created: 2026-08-11
updated: 2026-08-11
confidence: MED
supersedes: null
sources_verified: true
---

# ADR-0014 — The cache read path, and what a hit is

## Status

accepted

## Context

**Triggered by:** issue #118. Builds on [ADR-0013](./ADR-0013-cache-program-entity.md).

**The cache was written to and never read from.** Nothing outside `src/cache/`
imported the package; the only caller of `store.get()` in the tree was a unit
test asserting that a miss returns `undefined`. `run-matrix.ts` loaded a program
from a **path on the command line** and replayed it — the harness was *handed*
the answer and never looked one up.

So the cache was an output-only artifact: a log of what the compiler produced,
not a thing anything consulted. Two PRD §9 secondary metrics sit downstream of
that hop, and neither was computable — not because the arithmetic was missing
(`amortizedTokensOverN` has existed since B4) but because **nothing had ever
served a task from cache**. There was no hit to count.

## Decision

### 1. What a hit is

Replay is deterministic and uses no model; the model appears only in repair. So a
hit cannot mean "skipped a model call during replay". It means:

> **This run did not need fresh reasoning to obtain a program.** The program was
> resolved from the cache instead of being handed over as a file.

That is *provenance*. Whether the program then **worked** is a separate fact
already recorded as `replay_valid`. A cache hit for §9 is the conjunction:

```
cache hit  ≡  program_source == "cache"  AND  replay_valid
```

**The two facts are stored separately and combined at aggregation time.** #67 is
explicit that hit-rate must not be squeezed into an existing field, and
`replay_valid` already means "the assertion passed on the first attempt".
Overloading it to also mean "came from cache" would make one field answer two
questions and neither answerable alone. So `program_source` is added — to the
step row and the run row — and nothing pre-chews the conjunction into a stored
boolean.

**A step that required repair is a miss** even though it eventually passed: it
cost model tokens, which is the thing hit-rate exists to track.

**Absent means absent.** `program_source` is not defaulted to `"file"`. A run
that never consulted a cache belongs in **no hit-rate denominator** — it reports
`no_data`, not `0%`, which is the distinction CONTRIBUTING rule 3 and every
existing aggregate section already enforce.

### 2. A hit changes where a program came from. It never changes what is attempted.

#64 pinned this and #118 named it as the thing a read path is most likely to
break:

> A hit may change where the program came from; it must never change whether a
> step is attempted.

Concretely: nothing on the read path filters, reorders, or skips a step.
An invalidated program resolves **whole** (ADR-0013) and every step runs.
`cache_program_invalidated` is recorded on the run row so a reader can segment
hit-rate by cache health, and it is **advisory** — it is written *after* the run,
never consulted during it.

### 3. An invalidated row is a hit if it works

#118 asked whether an invalidated row should resolve as a hit, a miss, or a third
state. The answer follows from decision 1: the hit is determined by **what
actually happened**, not by a confidence flag.

- Invalidated row that replays valid → **hit**. The cache served a working
  program; that is exactly what hit-rate measures.
- Invalidated row that fails and needs repair → **miss**, by the same rule that
  makes any repaired step a miss.

Counting it a miss *while still replaying it* would make hit-rate stop describing
what happened. Counting it a hit *because* it came from cache, regardless of
outcome, would inflate it. Neither is needed: outcome already decides.

### 4. Reading is the first outbound flow across the privacy boundary

Every control built so far points the other way. `writeCacheRow()`, the taint
rules, the allowlist and the canary suite all govern what may **enter** the pool.
*"Nothing tenant-scoped got in"* is a different claim from *"nothing
tenant-scoped comes back out to the wrong tenant"*, and only the first had a
merge-blocking test.

A resolution therefore has a **scope**:

| Scope | Meaning |
| --- | --- |
| `any` (default) | Same-tenant reuse. The caller hands over its own store; every row in it already belongs to the caller. |
| `pool_only` | Cross-tenant reuse. A tenant-scoped row is **invisible**, not deprioritized. |

Under `pool_only` a program that depends on a tenant row is a **MISS**, not a
silently different program. `tests/canary/pool-read-leak.test.ts` is
merge-blocking and asserts it from disk, after a reopen, and guard-proven:
making pool scope fall back to the merged view fails 4 tests.

**Reading does not classify.** The scope filter reads `pool_eligible` off the row
— the decision `writeCacheRow()` already stamped — and never re-derives it. A
second classifier would be a second place for the boundary to drift.

### 5. The store needed an eligibility-aware index

Implementing scope surfaced a real collision. `writeCacheRowPair()` writes
**both** a pool row and a tenant row for the same key, and the store's merged
index deliberately lets the tenant version win (a key present in both files reads
back as the tenant-scoped one — the conservative choice for a same-tenant read).

The consequence: filtering the default view at pool scope returns **nothing** for
every task that has a tenant counterpart, which is all of them. Pool-scope
reading would have been a feature that could never return a row.

So `IndexedCacheStore` keeps a second index keyed by
`(site_key, task_key, step_index, pool_eligible)`, and `list({pool_eligible})`
reads it. The merged view and `get()` are unchanged — changing what they return
would change the meaning of every existing caller.

### 6. The file path stays, untouched

`--program <bundle>` is unchanged and remains the default. It is the only thing
that works with no cache behind it, and every existing gate run is reproducible
only through it. `--from-cache <dir>` is opt-in, requires `--site-key` and
`--task-key`, and **refuses the run** on a MISS — exiting before any container
boots, for the same reason an unbound parameter does (#122). A refused run is not
a failed run; it is an absent one, and it contributes to no §9 denominator.

## Consequences

**Hit-rate is now computable, and is still not computed.** This ADR records
provenance on every row a cache-resolved run emits. Aggregating it into a §9
section is #67, which can now assume `program_source` exists and that
`no_data`-on-empty-denominator falls out of "absent means absent".

**No gate run changes behaviour.** `--from-cache` is opt-in and nothing in CI
passes it. A run without it emits `program_source: "file"` and is otherwise
byte-identical to before.

**Cross-tenant reuse has a mechanism but no deployment story.** `pool_only`
answers "which rows may a cross-tenant reader see". It does **not** answer where
a shared pool lives, who writes to it, or how a tenant's store is separated from
it on disk — today both files sit in one directory, which is a
single-tenant-with-pool-contributions model. That is a deployment decision this
ADR does not make.

**Two indexes is a real cost.** The store now holds each row twice in memory in
the common case. At the size the cache is designed for (a few thousand rows) that
is not worth optimising, and the alternative — making the merged view
eligibility-aware — would have changed `get()` semantics for every existing
caller.

## Reversal cost

**Low.** `--from-cache` is opt-in with no default, the scope parameter defaults to
today's behaviour, and `program_source` is an optional additive field. Removing
the read path leaves the write path and the file path exactly as they are. The
store's second index is internal and unobservable except through
`list({pool_eligible})`.

## Open questions / what I could not verify

- **Nothing has been measured.** No hit-rate number exists, because no gate run
  has been executed with `--from-cache` against a populated cache. The read path
  is exercised by tests and by an integration test that compiles, writes,
  resolves and replays — not by a matrix run against a live site.
- **Where a shared pool lives.** See Consequences. `pool_only` is the read rule;
  the deployment shape is undecided.
- **Whether `site_key` is the right tenancy boundary.** A `CacheRow` has no
  tenant identifier; tenancy is expressed by which directory a store points at.
  That is sufficient for the single-tenant case and is not obviously sufficient
  for anything else. #126 is the related open question about whether product
  vocabulary and tenant data can be told apart at all.
- **What a hit means once repair can rewrite a program mid-run.** Today a repair
  makes a step a miss. If a repaired row is written back and later resolved, the
  same program is a hit on the next run — which is the intended self-healing
  behaviour and also means hit-rate is path-dependent across runs. Nothing
  measures that yet.
- **Partial-hit behaviour is inherited, not revisited.** ADR-0013 chose MISS over
  prefix replay because the in-flight handoff does not exist. That constraint is
  unchanged here.
