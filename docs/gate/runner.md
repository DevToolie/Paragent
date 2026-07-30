---
title: Runner, repair loop, and gate metrics
doc_type: spec
status: draft
owner: B4
created: 2026-07-24
updated: 2026-07-29
confidence: MED
supersedes: null
sources_verified: true
---

# Gate — Runner (B4)

Replays a **compiled program** (cache-row actions + assertions) in Playwright,
repairs **actions only** on failure (≤2 repairs/run by default), and emits
**measured** step/run metrics for PRD §9. Never invents token counts or gate rates.

## Package layout (`src/runner/`)

| Module | Responsibility |
| --- | --- |
| `types.ts` | `CompiledProgram`, steps, assertions, repair/run result types |
| `templates.ts` | `interpolate`, `deepFreeze`, `assertionsEqual` |
| `locators.ts` | Playwright `getByRole` / `getByLabel` / `getByTestId` / `getByText` / `getByPlaceholder` / `locator`; `topology_only` → not found |
| `assertions.ts` | `evaluateAssertion` → `PASS` / `ASSERTION_FAILED` / `LOCATOR_NOT_FOUND` / `TIMEOUT` / `PAGE_ERROR` |
| `actions.ts` | `executeAction` for navigate/click/fill/select/check/uncheck/press/hover/wait/upload/custom |
| `page-state.ts` | `capturePageState` / `emptyPageState` — no cookies, storage, or raw HTML. `visible_landmarks` runs the **one** enumeration from `src/shared/landmarks.ts`, byte-identical to what `src/recorder/fingerprint.ts` runs ([ADR-0007](../decisions/ADR-0007-post-action-visibility.md), #74). It owns no role list of its own: before #74 it enumerated 6 `[role=]` selectors and missed `complementary` / `contentinfo` / `region` the recorder reported, so the repair model would be handed landmarks the recorder never produced. The evaluate body is a string on purpose: named function expressions get esbuild's `__name` wrapper, which does not exist in the browser. Covered by `tests/unit/page-state.test.ts` and `tests/unit/landmarks.test.ts` |
| `repair.ts` | `RepairModelClient`, `StubRepairModelClient` (null action, zero tokens), `assertAssertionUnchanged` |
| `replay.ts` | `ReplayRunner` — dry-run, repair loop, metrics emission |
| `metrics/` | Sibling package: emitter + §9 aggregates |

## Bounded waits

Every wait the runner performs has an explicit ceiling. One did not: a `wait` step with no
positive duration parameter called `page.waitForLoadState("networkidle")` with **no timeout**,
inheriting Playwright's 30s default — a number nobody here chose. If the page never goes quiet
for 500ms the step burned all 30s and then failed anyway: maximum latency for zero information.

Now bounded by `NETWORK_IDLE_WAIT_MS` (5000ms, `src/runner/actions.ts`), overridable per run via
`ReplayRunnerOptions.networkIdleWaitMs`. Measured in `tests/unit/runner-bounded-wait.test.ts`
against a page that never reaches idle:

| | unbounded (before) | bounded (after) |
| --- | --- | --- |
| default | 30.8 s | 5.0 s |
| 1s override | 30.0 s | 1.0 s |

**Honest scope.** The seeded Grafana dashboard does *not* trigger this — `networkidle` settles
there in ~3 ms (measured on 11.0.0, `/d/paragent-seed`, 2026-07-28), because the seed dashboard
sets no refresh interval and TestData is generated client-side. This is a **latent** worst case,
reachable on any surface with continuous polling, streaming, or websockets — not a hang observed
on the current test-bed. Bounding it is cheap insurance taken before the gate runs, not a fix
for a live symptom.

**It changes which steps pass.** A page that first goes quiet at 12 s held the step until it did
and does not now — at 5 s the step continues and the assertion decides on whatever is on screen.
Deliberate, and cheap *today* because no gate number exists yet: since
[#62](https://github.com/DevToolie/Paragent/issues/62) `gate:matrix` runs live, but one run per
version over an example program is not a measurement. After a published measurement this would be
an expensive silent shift.

### Reaching the bound is not a step failure

A parameterless `wait` is a settling **hint**. The step's post-condition is the assertion that
runs immediately after it, with its own `timeout_ms` budget. So when the bound elapses the step
**proceeds** and records `settled: false` (`ActionResult.settled`, surfaced as
`StepAttemptResult.notes`) — the same posture as the 250 ms idle probe in
`src/runner/page-state.ts`, where a timeout means *no claim* rather than failure.

Classifying it as `TIMEOUT` would be worse than slow. `replay.ts` routes every non-`PASS`
outcome into the repair loop, so a never-quiet page would fail deterministically at the bound,
consume both repair attempts, and land on `REPAIR_EXHAUSTED` — and no `corrected_action` can
make a polling page go quiet. The run's `success_with_le_2_repairs` would then be reporting a
scaffolding condition as churn, which is the one thing the gate number must not do. On exactly
the surfaces this bound exists for (polling, streaming, websockets), the bound would otherwise
make a doomed step fail 6× faster without making it any less doomed.

If the page really is broken, nothing is hidden: the assertion fails on its own evidence, and
*that* failure is worth a repair attempt. And a step that genuinely needs idle as its
post-condition can say so — `network-idle` is an assertion type
(`src/runner/assertions.ts`), where a timeout is a real failure because it was a real claim.

`tests/unit/runner-bounded-wait.test.ts` pins both halves: the clock (bounded, not 30 s) and the
classification (`repair_count: 0` on a never-idle page, with the note still recorded). Reverting
either fails it.

## Invariants

1. **Assertions are immutable in repair.** `deepFreeze` + `assertAssertionUnchanged` — proposals may only supply `corrected_action`.
2. **No invented metrics.** Stub repair and unwired fresh baselines emit **zeros**; aggregates report `no_data` when denominators are empty.
3. **`maxRepairsPerRun` default 2** — aligns with `success_with_le_2_repairs` on run metrics.
4. **A skip is not a failure.** A version the matrix could not bring up produced no measurement;
   it is recorded in `out/matrix-run.json` with a stage and a reason and never reaches the
   NDJSON. Counting it as a failed run would invent a data point, dropping it would shrink the
   denominator in silence.

## Live matrix (#62)

`npm run gate:matrix` now drives a real browser. The exit-2 guard is gone; `--dry-run` stays,
because it exercises the harness without Docker and the CI job depends on it.

Per version, in `experiments/gate-v1/live-run.ts`: compose up → `/api/health` readiness → seed →
**seed-fingerprint gate** → Chromium → login preamble → `ReplayRunner` with `dryRun: false` →
teardown in a `finally`. Nothing in that file retries a step, downgrades an outcome, or catches
an assertion failure — repair is the only permitted second attempt.

The fingerprint gate is why a version can be skipped for a reason that is not infrastructure: if
its seeded state differs from the base version's, a step failure could be the seed's fault rather
than the surface's, and no honest attribution is possible after the fact. That version yields no
data point instead of a misleading one.

**Dry-run rows stay labelled.** `mode` is recorded per run and dry rows carry
`dry-run — tokens remain 0; not a gate measurement`. Mixing the two in one report is the easiest
way to publish a fabricated gate number.

### The NDJSON cannot yet say *why* a step failed

`contracts/metrics.schema.json` sets `additionalProperties: false` and has no field for a failure
reason. Because `StubRepairModelClient` always proposes `null` (stub 1), every genuine failure
ends as `REPAIR_EXHAUSTED` — so `LOCATOR_NOT_FOUND`, `ASSERTION_FAILED` and `TIMEOUT` are three
findings the gate needs to tell apart, flattened into one value in the emitted row.

Widening the metric row is a contract change and is deliberately **not** made here. Instead
`StepAttemptResult.first_pass_outcome` carries the real outcome in memory, and the driver records
it in its own ledger:

```json
{"step": 1, "outcome": "REPAIR_EXHAUSTED", "first_pass": "LOCATOR_NOT_FOUND"}
```

That is a workaround, not a fix. Until the contract question is answered, the NDJSON alone cannot
distinguish failure modes, and any report built only from it will under-describe them.

## Outcomes

From `contracts/metrics.schema.json` `$defs.stepOutcome`:

`PASS` · `ASSERTION_FAILED` · `LOCATOR_NOT_FOUND` · `TIMEOUT` · `PAGE_ERROR` · `REPAIRED_PASS` · `REPAIR_EXHAUSTED`

## Gate harness

See [`experiments/gate-v1/README.md`](../../experiments/gate-v1/README.md).

```bash
npm run gate:matrix -- --dry-run
npm run gate:report
```

## Sources

| Claim | Source | Access date |
| --- | --- | --- |
| Action + locator strategies | `contracts/cache-row.schema.json` | 2026-07-24 |
| Assertion types / strength / “MUST NOT weaken” | `contracts/assertion.schema.json` | 2026-07-24 |
| Step/run metric fields + outcomes | `contracts/metrics.schema.json` | 2026-07-24 |
| Fingerprint posture (no HTML/cookies) | `contracts/trajectory.schema.json` `$defs.fingerprint` | 2026-07-24 |
| Playwright locators / actions | https://playwright.dev/docs/locators | 2026-07-24 |
| Stack choice | `docs/decisions/ADR-0001-typescript-node-playwright.md` | 2026-07-24 |

## Open questions / what I could not verify

- Exact §9 kill thresholds (numeric gate) — **not invented**; pending founder PRD drop + Track-1 measurement (`docs/prd/` still placeholder).
- Model wiring for `RepairModelClient` — stub only (`TODO(model-wiring)`); real proposals PENDING.
- Whether `compiled_trajectory` bundle `$id` becomes a first-class contract (B3 packaging convention today).
- Fresh-reasoning cost capture for `cost_fresh` — measured separately; defaults to zeros when unwired.
- ~~Live `page` injection API for matrix vs caller-owned browser lifecycle.~~ **Settled (#62)** —
  the driver owns the lifecycle: a fresh Chromium and a fresh context per version, closed in the
  same `finally` as the container. Carrying a context between versions would let one version's
  state decide another's outcome.
- **Whether a metric row should carry the pre-repair outcome.** Today it cannot
  (`additionalProperties: false`, no field), so every failure reads `REPAIR_EXHAUSTED` and the
  driver keeps the real outcome in its own ledger instead. Answering this needs an ADR, and it
  matters before any report is published from the NDJSON alone.
- **What a live run actually measures is still limited by the program.** #62 built the driver;
  the only Grafana-targeted bundle on `main` is a compile of a hand-written example, and its
  step-0 assertion (`getByRole("form")`) matches **zero** elements on real Grafana — an unnamed
  `<form>` has no ARIA role. The gate task bundle arrives with #25.
- ~~Which version list the gate matrix walks.~~ **Settled (#26)** — `scripts/testbed/matrix.json`
  (ADR-0003 pins), read through `src/testbed/matrix.ts`. The placeholder
  `experiments/gate-v1/versions.json` is deleted, so `npm run gate:matrix -- --dry-run` now
  emits one run row per pinned version instead of one row for `pending-b1@placeholder`. Still a
  dry run: outcomes are hard-coded `PASS`, every token count is 0, and the rows say so.
- Whether walking eight versions changes anything the report can *conclude*. It does not — more
  rows over the same hand-written 2-step program is a better-shaped denominator, not a
  measurement. That waits on live execution ([#62](https://github.com/DevToolie/Paragent/issues/62)).
- **`settled: false` is recorded but not aggregated.** It reaches `StepAttemptResult.notes` in
  memory and stops there: `metrics.schema.json` has no field for it, so nothing counts how often
  a wait's hint went unanswered across a matrix run. Adding one is a contract change, and there
  is no measurement yet to justify the shape. Until then a reader cannot tell "this run met a
  never-quiet page eight times" from "never".
- Whether 5000 ms is the right *bound* rather than merely a chosen one. It equals
  `DEFAULT_ASSERTION_TIMEOUT_MS` by coincidence, not by construction — two independent constants
  in two packages, nothing enforcing the match. Neither number has been fitted to an observation
  because no live run exists yet.
