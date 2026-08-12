---
title: Compiler and assertion synthesis
doc_type: spec
status: draft
owner: B3
created: 2026-07-25
updated: 2026-08-12
confidence: MED
supersedes: null
sources_verified: true
---

# Gate — Compiler (B3)

Compiles a recorded **trajectory** into an executable **cache-row bundle**: one
row per step, each with a locator fallback chain and a synthesized post-condition
assertion. Does not run browsers (B4) and does not enforce the privacy allowlist
authoritatively (B5) — the compiler fail-closes `pool_eligible` honestly.

## Input / output

| Direction | Artifact | Schema |
| --- | --- | --- |
| In | Trajectory JSON | `contracts/trajectory.schema.json` |
| Out (per step) | Cache row | `contracts/cache-row.schema.json` |
| Out (embedded) | Assertion | `contracts/assertion.schema.json` |
| Out (bundle) | Compiled trajectory | documented below (not a contract `$id` yet) |

**B2 input:** ~~no real recording exists; fell back to
`contracts/examples/trajectory.example.json`.~~ **Closed 2026-07-28 (#24 → #25).** The compiler
now runs against the live 12-step ADR-0006 recording, and the example is kept only as a fixture:

```bash
npm run compile -- --in experiments/gate-v1/trajectories/grafana-create-stat-dashboard-from-testdata-9.5.21.json
# → artifacts/compiled/traj-gate-live-create-stat-dashboard-from-testdata-9.5.21.bundle.json
```

The bundle is **byte-identical on re-compile**, including `compiled_at` — the CLI pins it rather
than stamping wall-clock time, so a diff between two compiles is always a real difference.

## What real input produced

Compiling the live recording, after the three defects below were fixed:

| Step | Action | Assertion | Strength | Poolable | Reason if not |
| --- | --- | --- | --- | --- | --- |
| 0 | navigate | `url-matches` | **strong** | no | `literal_in_assertion` |
| 1 | click — add visualisation | `url-matches` | **strong** | no | `tenant_locator_text` |
| 2 | click — open viz picker | `element-visible` | weak | no | `tenant_locator_text` |
| 3 | click — choose Stat | `element-visible` (gone) | **strong** | no | `tenant_locator_text` |
| 4 | fill — series alias | `element-visible` | weak | no | `tenant_locator_text` |
| 5 | fill — series count | `element-visible` | weak | no | `tenant_locator_text` |
| 6 | fill — panel title | `element-visible` | weak | **yes** | — |
| 7 | click — apply panel | `url-matches` | **strong** | no | `tenant_locator_text` |
| 8 | click — open save drawer | `element-visible` | weak | no | `tenant_locator_text` |
| 9 | fill — dashboard title | `element-visible` | weak | no | `tenant_locator_text` |
| 10 | click — save | `url-matches` | **strong** | no | `tenant_locator_text` |
| 11 | click — back to list | `url-matches` | **strong** | no | `tenant_locator_text` |

**6 strong, 6 weak, 1 poolable, 0 `custom`.** Every row carries `notes`.

### Read against ADR-0006

[ADR-0006](../decisions/ADR-0006-track1-gate-task.md) predicted **5 strong / 7 weak** from the
priority table. Actual is 6/6 — it predicted step 3 (choose Stat) would be strong via ADR-0007
and it was, and it under-called step 1. **Half the steps carry a strong post-condition, so the
task supports step-level statistics** and the gate can proceed on it.

The weak six are all the same shape and none of them is a surprise: three fills whose typed
value the compiler may not assert, two clicks that open a picker or a drawer without changing
the URL, and one fill with no rendered echo. ADR-0006's route to 8/4 stands and is unbuilt: the
alias, series count and panel title are all rendered back into the page, so a recorder that
recorded *where* the value landed would let synthesis emit `text-matches` / `count-equals`
against a typed hole. That is [#61](https://github.com/DevToolie/Paragent/issues/61), and
nothing here promotes a weak assertion to strong to make the number look better.

> **Update 2026-08-12 (issue #126):** the `1/12` below is this file's own pre-check number,
> confirmed unchanged. Routed through the authoritative write path instead
> (`src/cache/write.ts`), the same bundle is `7/12` — see
> [`pool-vocabulary.md`](./pool-vocabulary.md) and
> [ADR-0017](../decisions/ADR-0017-pool-vocabulary-rule.md). The gap is the pre-check being
> stricter than its own authority (safe, per this file's own rule below), not an error here.

### One row in twelve is poolable, and that is the honest number

Ten rows are `tenant_locator_text`: the recorder marks `role_name`, `label` and `text`
candidates `tenant_scoped: true`, so any chain containing one is refused. On real Grafana every
useful control has an accessible name, so **cross-tenant pooling is currently vacuous** — the
cache would be almost entirely tenant rows. The single poolable row is the one whose only
candidate is a structural path.

This is fail-closed working as designed, not a defect, and the compiler must not "fix" it by
second-guessing the recorder's flag: B5's allowlist
([#B5 vocabulary](../privacy/boundary-spec.md)) is what decides that chrome like *Save dashboard*
is not tenant data, and until that vocabulary exists, refusing is the only safe answer. It is
recorded here because a pool hit-rate measured on this bundle would be ~0 by construction, and
that has to be read as "the allowlist is missing", not as "pooling does not work".

## Bundle shape

```json
{
  "schema_version": "1.0.0",
  "bundle_kind": "compiled_trajectory",
  "source_trajectory_id": "<trajectory_id>",
  "site_key": "...",
  "task_key": "...",
  "compiled_at": "<ISO-8601>",
  "compiler": { "version": "0.1.0-b3", "input_path": "...", "notes": "..." },
  "rows": [ /* CacheRow, one per step_index */ ]
}
```

Each `rows[i]` validates against `cache-row.schema.json`; each `rows[i].assertion`
against `assertion.schema.json`. The wrapper is a B3 packaging convention so B4
can load one file per compiled flow.

**Worked artifact:**
`artifacts/compiled/traj-example-grafana-login-nav.bundle.json`

## Locator fallback chains

Candidates from the trajectory are sorted into **B2 preference order**, then by
recorder `rank` ascending:

1. `role_name`
2. `label`
3. `testid`
4. `structural`
5. `text`
6. `placeholder`
7. `css_vocab`

Source for the order: `contracts/trajectory.schema.json` `$defs.locatorCandidate`
description (repo contract, accessed 2026-07-25).

- Navigate / wait steps may emit an **empty** chain (valid).
- If every candidate is tenant-tainted, the chain keeps marked locators for
  tenant-scoped replay and appends `topology_only` (pool ineligible:
  `topology_only_degraded`).

## Assertion synthesis strategy

For each step, synthesize **exactly one** post-condition from observed
`post_state` (+ optional `assertion_hint`). Expected values are **templates with
typed holes** — never tenant literals.

| Priority | Signal | Assertion `type` | Typical strength |
| --- | --- | --- | --- |
| 1 | Toast / success / notification in hint signals | `text-matches` | strong (template `{success_message}`) |
| 2 | Count / rows / items in hint signals | `count-equals` | **weak** (structured count not in fingerprint yet) |
| 3 | **`click` that changed `url_template`** | `url-matches` | **strong** — see the rule below |
| 4 | **Click-like step whose target went visible → hidden** (`post_action_target_visible: false`) | `element-visible` with `expected.visible: false` | **strong** — ADR-0007 |
| 5 | Hint `element-visible`, new landmarks, or fill/click target | `element-visible` | strong for navigate→login surface; **weak** for fill/select |
| 6 | `pre_state.url_template ≠ post_state.url_template` | `url-matches` | strong for navigate/click navigations |
| 7 | `post_state.network_idle === true` | `network-idle` | **weak** |
| 8 | Nothing else | `custom` (`post_digest_changed_or_stable`) | **weak** |

Priorities 3 and 4 are ordered deliberately: a click that **both** navigates and hides its
control — submitting a login form — is asserted on its destination, because where it landed is
better evidence than what vanished.

### Navigating clicks never assert the clicked control

A `click` whose `url_template` changed skips the `element-visible` branch entirely
(priority 3 above) and is asserted on its **destination**.

The reason is that the alternative is not merely weak, it is usually **wrong**. A click that
transitions the page routinely hides the surface the control lived on — submitting a login
form, closing a modal, navigating away — so "the button I clicked is still visible" is a
post-condition the step itself falsifies.

Found by [`tests/integration/pipeline.test.ts`](../../tests/integration/pipeline.test.ts) on
its first run: replaying a compiled login step timed out waiting for the submit button to be
visible after it had been clicked. Pinned by the `click assertion target` cases in
`tests/unit/compiler.test.ts`.

### A control that hides itself is asserted gone

Since [ADR-0007](../decisions/ADR-0007-post-action-visibility.md) the recorder observes whether
the acted-on control survived the action and stores it as `post_action_target_visible`. A
click-like step whose target went visible → hidden is asserted `element-visible` with
`expected.visible: false` on that target.

This is the case the URL rule above cannot reach — a dismiss, close, or collapse control has no
destination to assert. It is labelled `strong` because for such a control the disappearance
**is** the purpose of the step, and the assertion fails if the click is a no-op.

Note this also repaired the landmark fallback. `visible_landmarks` used to be collected by
walking the DOM with no visibility filter, so a landmark that had just been hidden was still
listed and the fallback was useless. It is now genuinely visibility-filtered, and since
[#74](https://github.com/DevToolie/Paragent/issues/74) the recorder and the runner's
`page-state` run **one** enumeration (`src/shared/landmarks.ts`) rather than two that agreed
only on markup with redundant `role=` attributes.

### `timeout_ms` is part of strength, not a performance knob

Every synthesized assertion carries `DEFAULT_ASSERTION_TIMEOUT_MS` (5000 ms,
`src/compiler/assertions.ts`) — previously seven separate `5000` literals, now one named
constant, overridable per compile via `CompileOptions.assertionTimeoutMs`.

**The value is deliberately unmoved.** A shorter timeout is a *stricter* check and a longer one
laxer, so "tuning it for speed" would move step-level replay-validity — the number PRD §9 gates
on — while looking like a perf change. That is the shape the assertion-immutability invariant
forbids.

It is also the dominant term in worst-case replay latency, because
`src/runner/assertions.ts` spends the full budget on **failure**: a 12-step task with three
stale locators waits 3 × 5 s before repair even starts. That is a real cost worth revisiting —
but on evidence, after a measurement, not before one. `tests/unit/compiler.test.ts` pins the
emitted default so it cannot drift silently.

**Strength rule:** `strong` = unambiguous proof the step achieved its purpose;
`weak` = consistent with success but also with several failures. Weak is allowed
and **must stay labelled** (`strength` + `notes`). Silent promotion is forbidden
(`contracts/assertion.schema.json`).

**Fill / select honesty:** typed values are parameter slots and are never stored
in the trajectory. The compiler therefore cannot assert “value equals X”; it
emits **weak** `element-visible` on the target control and says so in `notes`.

## `pool_eligible` (fail-closed)

Default posture: ineligible until checks pass.

| Condition | `pool_eligible` | `pool_ineligible_reason` |
| --- | --- | --- |
| Topology-only degradation | `false` | `topology_only_degraded` |
| Any `tenant_scoped` locator | `false` | `tenant_locator_text` |
| `text` / `placeholder` free-text strategies | `false` | `tenant_locator_text` |
| Tenant-looking literal in assertion target/expected | `false` | `literal_in_assertion` |
| Unknown ARIA role (provisional vocab) | `false` | `non_vocab_role` |
| Otherwise clean chrome / templates | `true` | `null` |

Notes and assertion ids are compiler metadata and are **not** scanned for pooling.
B5 remains authoritative for write-time allowlist (CONFIDENCE: MED on role
vocabulary until B5 publishes it).

### The pre-check may be stricter than B5. It may never be looser.

`writeCacheRow` **throws** `CacheWriteRejectedError` when a caller claims `pool_eligible: true`
and B5's own checks disagree. So a pre-check that is too permissive is not a leak — it is a
crash in the one path that has to work, and it stays invisible until something actually calls
the cache.

Routing the live bundle through `writeCacheRowPair()` found exactly that (#25). B5's
`assertionHasTenantLiteral` treats **anything left in `expected.template` after the holes are
removed** as a literal, so it refuses every `url-matches` row — the residue of
`http://{host}:{port}/dashboard/new?orgId=1` is its path. The compiler called all five poolable.
It now applies the same rule and agrees, and
[`tests/integration/live-bundle-pool.test.ts`](../../tests/integration/live-bundle-pool.test.ts)
pins the implication over the real bundle rather than over a synthetic row.

Two things that test also establishes, both requirements of #25: no pool row carries a
tenant-scoped or free-text locator, and the tenant row never loses candidates in the split.

**Left open deliberately:** whether B5 should refuse a URL path at all. A path is site topology,
not tenant data, and refusing it is what makes four of this task's six strong rows unpoolable.
Loosening a privacy rule is B5's call and does not belong in a compiler PR — filed as a finding
here, not fixed. Note the direction: B5 refusing too much is safe; the compiler claiming too
much was not.

## CLI

```bash
npm run compile -- --in contracts/examples/trajectory.example.json
# writes artifacts/compiled/<trajectory_id>.bundle.json
```

Options: `--out <path>`, `--no-validate`, `--help`.

## Known blind spots (cannot yet assert)

1. **Typed input values** — forbidden to store; fill success is weak visibility only.
2. **Toasts / notifications** — not in fingerprint; only via `assertion_hint` signals; message body is always a hole.
3. **Structured counts** — no `post_state` count field; `count-equals` is placeholder-bound and weak.
4. **Network request semantics** — `network-idle` is not “expected XHR settled”; no URL/method allowlist from B2 yet.
5. **Visual / screenshot diffs** — out of scope for Phase-1 contracts.
6. **Cross-frame / shadow DOM** — no trajectory signal.
7. **Auth session validity** — cookies/storage excluded from compiler input by construction; cannot assert “still logged in” from trajectory fields alone.
8. **Side effects on elements other than the target** — resolved for the acted-on control by [ADR-0007](../decisions/ADR-0007-post-action-visibility.md), which records `post_action_target_visible`. Still open: a click that hides or reveals *something else* (opens a modal, collapses a sibling panel) is asserted on the clicked control, because only the target's fate is captured. Closing that needs a post-action fingerprint diff rather than a single boolean — no defect currently demands it.
9. ~~**B2 live recordings** — no path found; example trajectory only.~~ **Closed (#24/#25).**
10. **B5 allowlist** — chrome label / role sets here are provisional; do not treat `pool_eligible: true` as final pool admission.

## What the real input broke

Three defects, none of which could fire on `contracts/examples/trajectory.example.json`. All
three were fixed in `src/compiler/` with unit tests; **the bundle was never hand-edited**.

**1. Every structural locator was read as tenant prose.** `looksLikeTenantLiteral` ends with
"three or more whitespace-separated words is human text", which is right for a name and wrong
for a CSS path, where the whitespace is the descendant combinator — `body > button` is three
tokens, and a real Grafana path is thirty. Since the recorder marks `role_name`/`label`/`text`
tenant-scoped, *every* candidate looked tainted, so every chain was declared degraded: **11 of
12 rows came out `topology_only_degraded`** with a `topology_only` entry appended, for a reason
that existed only in the heuristic. New `looksLikeTenantSelector` applies the identifier checks
(email, uuid, opaque id, secret-shaped) to selector fields and drops the prose rule. The same
bug had a second site in `decidePoolEligibility`, which scanned assertion leaves without knowing
which key they came from; the scan is now key-aware.

**2. A parameter name was read as a page signal.** Filling the ADR-0006 series-count field emits
the recorder signal `param slot series_count filled`, and `signalMentions` was a substring match
— so "count" tripped the `count-equals` branch and the compiler asserted a **count on a text
input**, with `expected.count: 0` and a note admitting the 0 was a placeholder. An assertion
that cannot be satisfied is worse than a weak one that can. `signalMentions` now matches whole
words; `_` is a word character, so `\bcount\b` does not match inside `series_count`. A real
count signal still takes the branch.

**3. The pool pre-check outran the authority** — see the fail-closed section above.

Not fixed, and deliberately: the `count-equals` branch still emits `expected.count: 0` bound to
a `{item_count}` hole nothing binds at replay. It is now unreachable for this task, but it would
produce an unsatisfiable assertion the moment B2 emits a real count signal. That is the same
missing capability as blind spot 3 and belongs with #61.

## Sources

| Claim | Source | Access date |
| --- | --- | --- |
| Assertion types + strength semantics | `contracts/assertion.schema.json` | 2026-07-25 |
| Cache-row + `pool_eligible` rules | `contracts/cache-row.schema.json` | 2026-07-25 |
| Locator preference order | `contracts/trajectory.schema.json` | 2026-07-25 |
| Ajv draft-2020-12 validator API | https://github.com/ajv-validator/ajv/blob/v8.17.1/docs/json-schema.md | 2026-07-25 |

## Open questions / what I could not verify

- Will B2 add structured `post_state` fields for toast text templates, item counts, and network URL patterns? No path found in contracts today (searched: `trajectory.schema.json` fingerprint + `assertion_hint` only).
- Final B5 role / testid / CSS attribute vocabularies — compiler uses a provisional role set; CONFIDENCE: MED.
- Whether a `compiled_trajectory` bundle schema should become a first-class contract `$id` — deferred to B0/ADR.
- Gate replay-validity thresholds — not invented here; see Track-1 measurement (PENDING).
- **Whether B5 should refuse a URL path as a tenant literal.** It refuses every `url-matches`
  row on that basis, which is four of this task's six strong rows. Safe direction, but it is the
  single biggest reason the live bundle pools 1 row in 12 — the other reason being the missing
  chrome vocabulary. Not touched here: loosening a privacy rule is B5's decision, not a
  compiler PR's.
- **Whether one poolable row in twelve is a finding about pooling or about the allowlist.** On
  this evidence it is the allowlist: every refusal traces to the recorder's blanket
  `tenant_scoped` on named controls, not to anything tenant-specific on the page. A pool
  hit-rate measured before that vocabulary exists ([#67](https://github.com/DevToolie/Paragent/issues/67))
  would be ~0 by construction and must not be reported as a property of the design.
- **Whether the six weak rows can be lifted before the matrix runs.** ADR-0006's route is real —
  the alias, the series count and the panel title are all rendered back into the page — but it
  needs the recorder to capture *where* the value landed. Unbuilt; [#61](https://github.com/DevToolie/Paragent/issues/61).
