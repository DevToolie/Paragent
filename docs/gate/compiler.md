---
title: Compiler and assertion synthesis
doc_type: spec
status: draft
owner: B3
created: 2026-07-25
updated: 2026-07-28
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

**B2 input:** Prefer a real recording from `track1/b2-recorder` when present.
Searched 2026-07-25: no path found for `origin/track1/b2-recorder` (searched:
`git ls-remote --heads origin "track1/*"`, `gh pr list`). Fell back to
`contracts/examples/trajectory.example.json`.

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
9. **B2 live recordings** — no path found for `track1/b2-recorder` at compile time; example trajectory only.
10. **B5 allowlist** — chrome label / role sets here are provisional; do not treat `pool_eligible: true` as final pool admission.

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
