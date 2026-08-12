---
title: "ADR-0015 — Task identity, intent resolution, and the site_key/address split"
doc_type: adr
status: accepted
owner: B4
created: 2026-08-12
updated: 2026-08-12
confidence: MED
supersedes: null
sources_verified: true
---

# ADR-0015 — Task identity, intent resolution, and the site_key/address split

## Status

accepted

## Context

**Triggered by:** issue #124.

`task_key` is a string a human types on the command line
(`src/recorder/cli.ts`, pre-#124: `args["task-key"] ?? (useFixture ?
"login-open-dashboards-list" : TASK_KEY)`). It flows unchanged through the
trajectory, the compiler, every cache row, and every metric row — it is the
identity of a task everywhere in the system, and nothing produced it except a
person choosing a slug.

[#118](https://github.com/DevToolie/Paragent/issues/118) gives the runner a
lookup by `(site_key, task_key)` — done, `src/cache/resolve.ts`,
[ADR-0014](./ADR-0014-cache-read-path.md). That closes the *wiring*. It does
not close the product question, because an agent arrives with a goal in
natural language, not a slug: to get a cache hit today you must already know
the exact `task_key`, which means you already knew a compiled program for this
task existed — at which point the cache saved nothing a filename would not
have.

`site_key` has the same property and one extra problem. The only real
compiled bundle on `main` carried `site_key: "grafana-oss@127.0.0.1:3000"` —
host and port baked into cache identity — while the same host and port were
*already* parameterized inside the same rows as `{host}` and `{port}`
(`base_url_template`, `parameters.host`/`port`, `bindings`). One fact, two
homes, and the two could disagree.

Two things had to be decided, and this ADR makes both:

1. **What a task's identity is** — whether phrasing, parameter values, and
   site address are part of it, and if not, how a natural-language goal
   resolves to the `task_key` that already exists.
2. **What a site's identity is** — specifically, whether `site_key` should
   keep encoding an address it also parameterizes.

## Decision — part 1: task identity

### The four questions issue #124 asked

| Question | Answer | Why |
| --- | --- | --- |
| Same task when the goal is phrased differently? | **Yes**, if the phrasing paraphrases a goal already on file for that `task_key`. | `task_key` is an opaque identifier, not a rendering of any one phrasing. Any number of descriptions may point to it — that is the whole shape of `KnownTask` in `src/intent/catalog.ts`: one `task_key`, `descriptions: string[]`. |
| Same task when a parameter value differs? | **Yes, always.** | This was already decided, upstream of #124: the recorder lifts every typed value into a parameter slot (`parameters`, `param_refs`, `bindings`) precisely so the *identity* of a step never depends on the value that filled it. #124 only reinforces it — a catalog description that named a parameter value would be describing one run of the task, not the task, so `src/intent/catalog.ts` forbids it and `tests/unit/intent-resolve.test.ts` guards against a digit appearing in a description as a cheap tripwire. |
| Same task when the site is the same product at a different host? | **Yes** — same `site_key`, because host/port are not part of site identity at all (part 2, below). | An identity that changed with the address it also parameterized was the specific inconsistency #124 named. |
| Same task when the site is a different *version* of the same product? | **No** — different `site_key`. | Locators are version-specific by design (ADR-0006: the recorded trajectory is deliberately *not* version-tolerant, so churn shows up as measured failure rather than being laundered away). A program compiled against 9.5.21 replayed against 13.0.3 on the strength of "same product" is exactly the silent-wrong outcome #124's constraints forbid — a browser agent executing the wrong flow because two things that look similar were treated as identical. |

The throughline: **task identity is what the compiled program does, not how the
request was typed.** Phrasing and parameter values vary freely without
changing identity; the site's product+version does not, because that is what
actually determines whether a recorded locator resolves.

### Resolving a phrase to a task_key

**Chosen: normalized exact match against a hand-maintained catalog of known
task descriptions**, behind a swappable `IntentMatcher` interface
(`src/intent/types.ts`). `ExactNormalizedMatcher`
(`src/intent/matcher.ts`) is the only implementation:

```
normalize(query) == normalize(description)   for some description
                                              registered under a task_key
```

`normalizeIntentText` (`src/intent/normalize.ts`) is: Unicode-`NFKC`,
lowercase, strip everything that is not a letter/number/whitespace, collapse
whitespace, trim. It does **not** stem, drop stopwords, or reorder — any of
those would make "exact match" a fuzzy matcher wearing an exact matcher's
name, which is the permissive behavior item 3 of #124 warns against.

#### Options considered

**A — Embedding similarity from the start (rejected).** The obvious long-run
answer, and #124 says so explicitly: "the least clever thing that works" is
the mandate, and a similarity threshold with no measurement behind it is
exactly the `docs/INTEGRITY-AUDIT.md` category-B failure this repo has a
standing rule against. There is no gate data yet on how real phrasings
distribute, so any threshold chosen today would be a guess wearing a decimal
point. Deferred, but not vaguely: `IntentMatcher` is the seam it drops into
without touching a caller.

**B — Normalized exact match against a catalog (chosen).** Honest case for:
zero tunable parameters, therefore nothing for category B to flag; a match is
either exactly on file or it is a MISS, so "wrong match executed silently" —
item 3's central worry — cannot happen by construction, not by tuning.
Honest case against: coverage is exactly as wide as the catalog someone
remembered to write, and `"make me a stat panel using the testdata source"`
will not resolve until that phrasing is added, even though a human reads it
as obviously the same request as `"create a stat dashboard from testdata"`.
That gap is real and is the reason A is the *documented* next step, not a
hedge.

**C — Substring / keyword overlap (rejected).** Sits between A and B in
cleverness and inherits the worst of both: still has an implicit threshold
(how much overlap counts), and still has no measurement to set it by. It also
actively invites the failure item 3 names — "delete the dashboard" and
"delete every dashboard on the instance" share every keyword and mean
opposite things for a browser agent with write access. Rejected without a
staged trial; the false-positive shape is disqualifying on its own.

### The third state: needs_confirmation

`IntentResolution` is `resolved | needs_confirmation | miss`
(`src/intent/types.ts`), not a two-way hit/miss. `ExactNormalizedMatcher`
never returns the middle state — an exact match after normalization has no
partial credit to hedge with — but the type exists now, on this PR, so a
future scored matcher has somewhere to put a near-miss *instead of* a silent
resolve. A caller must treat `needs_confirmation` exactly like a miss for
execution purposes: `src/recorder/select-task.ts` refuses the recording on
either. This is item 3 taken literally — "prefer a conservative matcher plus
an explicit confirmation path over a permissive one" — implemented as a type
the current matcher happens not to use yet, rather than deferred to whenever
the next matcher lands.

### A miss is no_data-shaped, not a guess

Every non-resolution carries a `reason` (`empty_query | no_match |
ambiguous`) and a human-readable `detail`, the same shape
`ProgramMissReason` takes in `src/cache/resolve.ts` — a MISS is a measurement
in its own right (#67 precedent), not a bare `undefined`. `ambiguous` is the
case where two `task_key`s share a normalized description: a catalog-authoring
bug, and it is **never** resolved by picking one, for the same reason
`resolveProgram()` never returns a "probably complete" program (ADR-0013).
Guessing here is exactly how a browser agent ends up running the wrong flow
against a real account — the concern named directly in #124's constraints.

### This is not a second row classifier

`resolveTaskIntent()` decides *which* `task_key` a phrase means. It does not
call `resolveProgram()`, does not open the cache, and does not write a row.
`writeCacheRow()` remains the only thing that decides what a row is — #124's
own constraint, restated here because it is the same shape of rule
`src/cache/resolve.ts` already lives under (a read path must not become a
second place classification happens).

## Decision — part 2: site_key drops the address

**Chosen: `site_key = "<product>@<version>"`. Host and port are never part of
it.**

`contracts/trajectory.schema.json`'s own field description has read
`"Logical site identity, e.g. grafana-oss@10.2.0"` since the schema was
written. The live recorder path disagreed with its own schema's example,
building `grafana-oss@{host}:{port}` instead
(`src/recorder/cli.ts`, pre-#124). This is not a new design question so much
as the code catching up to a convention the schema already stated — but it
had a concrete, negative consequence: the same product at the same version,
recorded once against `127.0.0.1:3000` and again against `10.0.0.4:3000`,
produced two different `site_key`s for what is, by every field the schema
actually checks, the identical program. Cross-instance reuse — the thing a
pool of cached programs is *for* — was impossible by construction.

`{host}`/`{port}` do not disappear: they are exactly where they already were
— `base_url_template`, `parameters.host`/`parameters.port`, `bindings` — and
now they are the *only* place. `src/recorder/site-identity.ts::buildLiveSiteKey`
is deliberately shaped so the old bug cannot come back: it takes a product and
a version and **nothing else**. There is no host or port parameter to thread
through by mistake — the guarantee is in the function's signature, not in a
caller remembering to omit something.

### Why version and not something coarser

A `site_key` of bare `"grafana-oss"` (no version) would be the more radical
generalization and was considered. Rejected: ADR-0006 already established
that a compiled program is version-specific — the recorded trajectory is
deliberately *not* locator-tolerant across versions, so that churn is a
measured failure rather than a laundered one. Collapsing `site_key` to the
product alone would let a program recorded against 9.5.21 resolve for a
request against 13.0.3, replay several steps that happen to still work, and
fail — or worse, silently misfire — partway through on a moved control. That
is precisely the "near-miss that has already clicked things" item 3 of #124
warns about, one layer down from intent matching. Version is the coarsest
grain that does not reintroduce it.

### Landing this in the same PR

#124's scoping explicitly allows deferring this split to a follow-up if it
is not one logical unit with the resolver. It is landed here instead, because
the actual change turned out small once traced: `site_key` was already an
unconstrained string in every schema that carries it (`trajectory`,
`cache-row`, `metrics` — all `{"type": "string", "minLength": 1}`, no format),
nothing in `src/` parses it structurally (`grep`-verified — no `.split("@")`
or similar on a `site_key` anywhere in `src/`), and no test asserts the exact
literal `grafana-oss@127.0.0.1:3000` string. The change is therefore
string-construction-only: `src/recorder/site-identity.ts` (new, 20 lines),
its call site in `src/recorder/cli.ts`, and the one committed live trajectory
+ bundle recompiled to match. No contract changed.

## Consequences

**Cross-instance reuse is now representable.** Two recordings of the same
product+version at different addresses produce the same `site_key`, which is
the precondition for the pool (#126, being worked in parallel — this ADR
does not touch `src/cache/allowlist.ts` or pool-vocabulary logic) to mean
anything across more than one address.

**Coverage is bounded by the catalog, honestly.** `KNOWN_TASKS`
(`src/intent/catalog.ts`) has two entries — the two tasks
`src/recorder/cli.ts` actually records today. Widening coverage means adding
descriptions to that table (safe: `ExactNormalizedMatcher` treats a collision
across `task_key`s as `ambiguous`, never a tiebreak) or swapping in a scored
matcher behind the same interface. Neither is this issue's job.

**Hit-rate gets an honest denominator, once the resolver is wired into a
`--from-cache` caller.** `docs/gate/cache.md` is updated alongside this ADR:
today's `cacheHitRate()` denominator is *cache-consulting runs*, which
presumes a `task_key` the caller already typed; once a caller reaches the
cache through `resolveTaskIntent()` instead, the honest denominator is
*tasks requested*, and the two differ by exactly what this issue adds. Both
are stated, not conflated.

**One real call site, not a library nobody calls.**
`src/recorder/cli.ts` calls `resolveTaskKeyForRecording()` before falling
back to its historical default — `--intent "<goal>"` as an alternative to
`--task-key`, refusing the recording rather than guessing on a miss. The more
obviously "cache-shaped" call site — `experiments/gate-v1/run-matrix.ts
--from-cache`, which already takes `--task-key` for a lookup — is a natural
second wiring point and is **not done here** (Open Questions).

## Reversal cost

**Intent resolution: low.** `src/intent/` has exactly one caller
(`src/recorder/select-task.ts`) and no schema, store, or contract depends on
it existing. Deleting the package and the one call site restores exact
pre-#124 behavior (`--task-key` only) with no data migration.

**site_key split: low for new data, real for historical continuity.** Every
schema field was already an unconstrained string, so nothing rejects either
form. What is not reversible for free is the one committed live bundle, which
now carries `grafana-oss@9.5.21` — regenerated from its source trajectory by
`npm run compile`, not hand-edited, so it remains a real compiler output, but
a revert would need the same regeneration step run backward.

## Open questions / what I could not verify

- **The intent → cache-read call site is not wired in this PR.**
  `experiments/gate-v1/run-matrix.ts --from-cache` already takes `--task-key`
  for a lookup and is the more natural second caller of `resolveTaskIntent()`
  — a caller resolving "have I done this before" from a goal, not just a
  recorder deciding what to label a new recording. Tracking this as a
  follow-up: **wire `--intent` into `gate:matrix --from-cache` as an
  alternative to `--task-key`**, resolving through `src/intent/` before
  calling `resolveProgram()`, with the same refuse-on-miss posture used here.
  Not done in this PR to keep the diff to one call site, per #124's scoping
  guidance ("a well-tested library with one realistic call site wired in is
  enough").
- **The catalog is hand-maintained and will drift.** Nothing keeps
  `src/intent/catalog.ts` in sync with the tasks the recorder actually knows
  how to record; a third task added to `src/recorder/cli.ts` without a
  matching catalog entry would simply be unreachable by `--intent` (falling
  back to `--task-key`, not broken, but silently uncovered). No test catches
  that omission today.
- **Whether embedding similarity is worth building at all before there is
  real phrasing data.** #124 names it as the obvious upgrade; this ADR keeps
  the seam (`IntentMatcher`) open rather than committing to it, because there
  is no evidence yet — zero recorded queries — about how far normalized exact
  match actually falls short in practice.
- **Cross-tenant intent resolution is not addressed.** `resolveTaskIntent()`
  has no notion of scope or tenancy; it maps a phrase to a `task_key` and
  stops. Whether the *catalog itself* should ever be tenant-scoped (a phrase
  that only makes sense for one tenant's flows) is not decided here and has
  not come up, because the only catalog today is the two public ADR-0006 /
  fixture tasks.
- **No measurement.** Like every ADR in this track, the mechanism is argued
  from the schema and pinned by tests, not observed against real phrasings
  from a real caller. `tests/unit/intent-resolve.test.ts` and
  `tests/unit/recorder-select-task.test.ts` prove the decision logic; they do
  not prove the catalog covers what people actually type.
