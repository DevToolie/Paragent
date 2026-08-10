---
title: "ADR-0008 — Carry a recorded wait's duration through compile and replay"
doc_type: adr
status: accepted
owner: B4
created: 2026-08-03
updated: 2026-08-04
confidence: HIGH
supersedes: null
sources_verified: true
---

# ADR-0008 — Carry a recorded wait's duration through compile and replay

## Status

accepted

## Context

**Triggered by:** issue #83, found while bounding the runner's waits for a latency review.

`TrajectoryRecorder.wait(intent, ms)` (`src/recorder/session.ts`) always takes an explicit
duration — its own `run()` callback is `setTimeout(resolve, ms)` — but never writes `ms`
anywhere the trajectory can carry it:

```ts
async wait(intent: string, ms: number): Promise<void> {
  await this.recordStep({
    intent,
    action: { type: "wait" },      // <- ms is dropped here
    ...
```

At replay, `executeAction`'s `"wait"` case (`src/runner/actions.ts`) looks for a duration via
`firstParam(action, params)` — reading `action.param_refs` against the run's parameter
bindings — finds nothing, and falls through to the bounded `networkidle` probe
(`NETWORK_IDLE_WAIT_MS`, added separately to bound what used to be an unbounded 30 s Playwright
default). So **a recorded "wait 500 ms" replays as "wait for network idle"**: a different
condition, on a different clock, that can pass or fail independently of the one actually
recorded. That is semantic drift, not a rounding error — replay is supposed to reproduce what
was recorded, and for a `wait` step today it structurally cannot.

**Not urgent, but not hypothetical either.** No trajectory or bundle in the tree contains a
`wait` step yet — verified across `experiments/gate-v1/trajectories/*.json`,
`contracts/examples/trajectory.example.json`, and `artifacts/compiled/*.bundle.json` — so
nothing currently exercises the drop. It starts mattering the moment a recorded task includes a
deliberate wait, which the ADR-0006 gate task does not (yet) but a future one plausibly will.

**A second, already-tested mechanism exists and is not the fix.** `executeAction`'s
`firstParam`-based lookup is real, tested behaviour
(`tests/unit/runner-bounded-wait.test.ts`, "still uses a plain sleep when the step carries a
positive duration") — a compiled action can carry a *runtime-bound* wait duration supplied at
replay time via `--param`, the same mechanism `fill`/`select`/`upload` use for caller-supplied
values. That is a legitimate, independent feature (a duration the caller chooses per run) and
this ADR does not touch it. What is missing is the other case: a duration the *recorder*
observed and that replay should reproduce unchanged, which is not something a caller re-supplies
per run.

Per CONTRIBUTING — *"Prefer extending a schema via ADR over ad-hoc JSON fields in one
package"* — this is a schema change (`contracts/trajectory.schema.json` and
`contracts/cache-row.schema.json`), so it gets one.

## Options considered

### A — Synthesize a `param_ref` + literal binding for the recorded duration (rejected)

Route the recorded `ms` through the existing `firstParam`/`params` mechanism by having the
compiler bake a literal binding (e.g. `wait_ms_step3: 500`) into every compiled program.

Honest case for: no schema change; reuses an already-tested code path in
`executeAction`.

Honest case against: conflates two different kinds of value under one mechanism. `param_refs`
names a *slot the caller fills* (username, upload path) — its value is supplied per replay call,
not fixed at record time. Threading a compile-time constant through a mechanism built for
runtime-supplied values means a caller could accidentally (or silently) override the recorded
duration by passing `--param wait_ms_step3=0`, which is exactly the semantic drift this ADR
exists to close, just moved one layer down. It also requires the compiler to invent parameter
names with no trajectory-level meaning, which nothing else in the pipeline does.

### B — Add a literal `wait_ms` field on the action (chosen)

Honest case for: matches the existing pattern for other compile-time-constant action fields —
`key` (press), `url_template` (navigate) — literal values fixed at record time, carried
unchanged through compile, read directly at replay with no runtime binding involved. Additive
and optional: `additionalProperties: false` already governs the action shape in both schemas, so
this is the one deliberate, documented way to grow it. Existing trajectories/bundles (none of
which have a `wait` step) are unaffected.

Honest case against: grows the action shape in two contracts. Mitigated by the field's narrow,
single-purpose meaning ("wait" only) and its optionality.

### C — Remove the `networkidle` fallback entirely once a duration is always recorded (rejected)

Since `TrajectoryRecorder.wait()`'s signature requires `ms`, every recorder-produced `wait` step
will carry a duration under option B, making the `networkidle` fallback path unreachable from
the recorder.

Honest case for: the fallback is not needed for anything the recorder can produce.

Honest case against: `networkidle` is not a weaker version of a missing duration, it is a
different, deliberate primitive (documented at length in `src/runner/actions.ts`) for a
hand-authored or non-recorder-produced program that wants a settle **hint** rather than a fixed
sleep — `loadProgram()` already accepts hand-written `CompiledProgram` fixtures alongside
recorder output. Removing it would take away a real capability to close a code path nothing is
using unsafely today. A bare `wait` action (no `wait_ms`) stays meaningful; it just cannot come
from the recorder's own `wait()` method anymore.

## Decision

**B.** `wait_ms?: number` (non-negative integer, milliseconds) is added to the action shape in:

- `contracts/trajectory.schema.json` (`$defs.action`)
- `contracts/cache-row.schema.json` (`compiled_action`)

**Recorder** (`src/recorder/session.ts`): `wait(intent, ms)` emits `action: { type: "wait",
wait_ms: ms }`. A recorder-produced trajectory can no longer emit a bare, duration-less `wait`
— the only public entry point requires `ms`.

**Compiler** (`src/compiler/compile.ts`): `buildCompiledAction()` copies `wait_ms` straight
through when present, exactly like `key`/`url_template`/`custom_op` — a literal, not a
synthesized param.

**Runner** (`src/runner/actions.ts`): the `"wait"` case now resolves a duration in this order —

1. `action.wait_ms` (recorded literal — what this ADR adds), else
2. `firstParam(action, params)` (existing runtime-bound value — Option A's rejected mechanism
   stays available for whatever already uses it), else
3. the bounded `networkidle` probe, unchanged.

A trajectory that says a duration is honoured exactly; nothing is guessed. The
`networkidle` fallback is preserved for the case where nothing says a duration at all — a
different, explicitly chosen condition, not an invented one.

**Step 1 gates on presence, not magnitude.** Both schemas declare `minimum: 0` and
`recorder.wait(intent, 0)` is a legal call, so `wait_ms: 0` is a value the recorder can
genuinely produce. It means *"a wait was recorded here, of zero duration"* — an observation —
and replay reproduces it as an instant no-op. Gating on `wait_ms > 0` instead would read a
recorded zero as *"no duration given"* and fall through to `networkidle`: the same
condition-swap this ADR exists to close, surviving at the one boundary the schema still calls
valid. `minimum: 0` therefore stays as-is rather than becoming `exclusiveMinimum: 0` — zero is
meaningful, not a value to forbid. A non-finite or negative `wait_ms` is not an observation the
recorder can produce and falls through as if nothing was recorded, rather than reaching
Playwright as a negative timeout.

## Consequences

**Easy.** Additive, optional field; no existing trajectory, bundle, or cache row is invalidated.
No artifact regeneration needed — none of the in-tree fixtures contain a `wait` step, verified
above.

**A recorded wait now reproduces exactly.** `wait(intent, 500)` replays as a 500 ms sleep on
every run, independent of whatever the page happens to be doing — closing the drift this ADR
exists to fix.

**The `networkidle` fallback keeps a real, narrower purpose.** It now only ever fires for a
`wait` action with no usable duration at all — from a hand-authored program, not from the
recorder. Its existing bound, classification (`settled` is a hint, not a failure), and tests
(`tests/unit/runner-bounded-wait.test.ts`) are unchanged.

**Every value the schemas admit has one replay meaning.** `wait_ms: 0` sleeps zero; a positive
`wait_ms` sleeps that long; an absent `wait_ms` probes `networkidle`. No admitted value is
silently reinterpreted as a different condition — which is the whole claim of this ADR, and is
now pinned by tests at the zero boundary rather than only in the positive case.

**Precedence is fixed, not incidental.** `wait_ms` is checked before the `param_refs` lookup so
a recorded literal cannot be silently overridden by a `--param` binding that happens to share a
name — the scenario Option A was rejected over. No code path currently sets both on one action;
this only matters if one ever does.

## Reversal cost

**Low.** `wait_ms` is optional; dropping it from the schemas and the three read/write sites
returns behaviour to today's (buggy) state. The recorder change (always emitting `wait_ms`) is
the only one that changes a currently-possible output shape, and no committed trajectory relies
on the old duration-less `wait` shape.

## Open questions / what I could not verify

- Whether the ADR-0006 gate task will ever record a deliberate `wait` step. Nothing in the task
  as currently walked calls for one; this ADR unblocks it rather than responding to an observed
  need.
- Interaction with a future wall-clock run budget (issue #84): a long recorded `wait_ms` now
  counts fully against any per-run budget that lands, the same as it would have against
  `networkidle`'s bound today. Not sized here.
- Whether `wait_ms` should have an upper bound enforced at record time (the recorder could, in
  principle, be asked to wait an unreasonable duration). No caller does this today; left
  unconstrained until one does, rather than inventing a ceiling nothing has hit.
