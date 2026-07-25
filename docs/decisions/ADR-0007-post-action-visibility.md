---
title: "ADR-0007 — Capture real visibility and post-action target visibility"
doc_type: adr
status: accepted
owner: B2
created: 2026-07-26
updated: 2026-07-26
confidence: HIGH
supersedes: null
sources_verified: true
---

# ADR-0007 — Capture real visibility and post-action target visibility

## Status

accepted

## Context

**Triggered by:** issue #71, opened out of [PR #70](https://github.com/DevToolie/Paragent/pull/70),
which added the first end-to-end pipeline test and immediately caught the compiler asserting
*"the button I clicked is still visible"* as the post-condition for logging in.

#70 fixed only the **navigating** case: a `click` whose `url_template` changed is asserted on
its destination. It left the root cause, recorded as blind spot #8 in
[compiler.md](../gate/compiler.md). Two separate defects sit underneath.

### Defect 1 — `visible_landmarks` does not mean visible

Both capture sites collect landmark roles with no visibility filter.
`src/recorder/fingerprint.ts` walks every element under `document.body`;
`src/runner/page-state.ts` uses `querySelector`, which matches hidden nodes just the same.

In the bundled fixture the whole app view is `hidden` on load, so a freshly loaded login page
already reports `banner` and `navigation` as "visible". The field name is a claim the value
does not support.

The runner's copy feeds `RepairContext.page_state`, so once #27 wires a real repair model the
model is handed hidden landmarks as visible context — misleading input that inflates measured
repair cost against the PRD §9 "70% of fresh" kill line.

### Defect 2 — nothing records whether the acted-on control survived

The trajectory carries `pre_state` and `post_state` fingerprints but nothing about the element
the step acted on. So the compiler cannot distinguish "clicked a filter chip, still there" from
"clicked a dismiss button, it's gone", and guesses. #70 could only rescue the subset where the
URL happens to change.

Reproduced by adding a self-hiding, non-navigating control to the fixture:

```
step 5: REPAIR_EXHAUSTED — locator.waitFor: Timeout 5000ms exceeded.
  14 × locator resolved to hidden <button data-testid="dismiss-notice">Dismiss</button>
```

## Options considered

### A — Filter in place, keep the field name (chosen for defect 1)

Honest case for: the name already promises visibility. The value not matching it is a **bug in
the implementation**, not a change of meaning, so fixing the implementation is the minimal true
change. No schema edit, no consumer churn, no rename cascade through
`src/compiler/`, `src/runner/`, and four example artifacts.

Honest case against: silently changes what every previously recorded artifact means. Anything
recorded before this ADR has unfiltered semantics under a filtered name, and nothing in the
file marks which it is. Mitigated only by regenerating every in-tree artifact here, and by the
fact that no live trajectory exists yet (#24 is deliberately sequenced after this — see below).

### B — Rename to `landmark_roles`, add a separate filtered `visible_landmarks`

Honest case for: strictly truthful; old artifacts keep a field whose name still matches their
content.

Honest case against: a breaking `trajectory.schema.json` change that touches every consumer, to
preserve a field whose only current use is a signal we have just established is wrong. Carrying
both invites a future reader to pick the wrong one.

### C — Add per-step `post_action_target_visible` (chosen for defect 2)

Honest case for: directly records the missing observation. Orthogonal to A/B — needed whichever
of those is picked, because no landmark-level signal can tell you about a specific control.
Additive and optional, so existing artifacts stay schema-valid.

Honest case against: grows the trajectory contract, and the recorder must resolve the locator a
second time after the action, which costs a round-trip per step.

## Decision

**A + C.**

1. `visible_landmarks` becomes genuinely visibility-filtered, in **both**
   `src/recorder/fingerprint.ts` and `src/runner/page-state.ts`, using the same in-page
   `Element.checkVisibility()` predicate so recorder and repair context cannot disagree.
   ([MDN `checkVisibility`](https://developer.mozilla.org/en-US/docs/Web/API/Element/checkVisibility)
   — access_date: 2026-07-26.)
2. `trajectory.schema.json` `$defs.step` gains optional `post_action_target_visible: boolean`,
   recorded only for steps that acted through a locator. The recorder observes it with
   Playwright's `Locator.isVisible()`.
3. The compiler consumes it: a `click` whose target went **visible → hidden** is asserted
   `element-visible` with `expected.visible: false` on that target.

### Why the recorder uses Playwright for the target and the DOM API for landmarks

Deliberate, not an inconsistency. The post-action target assertion is later evaluated by
`src/runner/assertions.ts` via `waitFor({ state: "hidden" })`, which is **Playwright's**
visibility definition. Recording that observation with `Locator.isVisible()` means the recorder
claims exactly what the runner will check. Using a DOM-level predicate there would let the two
disagree at the edges.

Landmarks are a bulk structural signal never asserted by locator, so an in-page pass is both
cheaper and the only way to keep the recorder and the runner's `page-state` identical — which
is the consistency that matters for *that* field.

### Strength of the new assertion

`strong`. Per [compiler.md](../gate/compiler.md), strong means unambiguous proof the step
achieved its purpose. For a self-hiding control the disappearance **is** the purpose, and the
assertion fails if the click is a no-op — which is the load-bearing test #61 will apply. The
notes on the emitted assertion state precisely what it proves (the acted-on control is no
longer visible) and what it does not (nothing about downstream state).

## Consequences

**Easy.** The compiler gains a real signal instead of a guess. `element-visible` with
`visible: false` is already supported end to end — `src/runner/assertions.ts` honours
`expected.visible`, so no runner change is needed.

**Hard — every recorded artifact shifts.** `dom_digest` is derived from the same structural
signals, so filtering the landmark list changes digests. `contracts/examples/trajectory.example.json`,
the committed fixture recording, and `artifacts/compiled/*.bundle.json` all move. All are
regenerated by command; none are hand-edited.

**Deliberately not changed:** `role_counts`, `form_count`, `heading_count`, `link_count`,
`button_count`, and `input_count` remain DOM-wide. They are structural counts, not visibility
claims, and no field name promises otherwise. Filtering them would be a larger behavioural
change with no defect motivating it.

**Sequencing.** This lands **before** #24 records the live gate task. Doing it after would mean
re-recording that trajectory across the matrix, and it is the input to #25, #61, and the full
gate run.

**Still open after this ADR.** A non-navigating click that hides *something other than itself*
(opens a modal, collapses a sibling) is still asserted on the clicked control. That needs a
post-action fingerprint diff rather than a single boolean, and no defect currently demands it.

## Reversal cost

**Low for C, moderate for A.** `post_action_target_visible` is additive and optional — ignoring
it returns the compiler to its previous behaviour. Reverting A means restoring the unfiltered
walk and regenerating artifacts again; the cost is entirely in the artifact churn, not the code.

Signal to reverse A: a consumer emerges that genuinely needs *DOM presence* rather than
visibility. The right answer then is option B, adding a separate field, not un-fixing this one.

## Open questions / what I could not verify

- Whether `Element.checkVisibility()` and Playwright's `isVisible()` agree in every case we
  will meet on real Grafana. They agree on the `hidden` attribute and `display:none`, which is
  what the fixture exercises; `content-visibility` and zero-size-but-rendered elements are not
  covered by any test here.
- Whether `strong` is the right label once #61 audits a real 8–12 step task. If a self-hiding
  click turns out to be routinely ambiguous on Grafana, the label should drop to `weak` — that
  is a finding, not a bug in this ADR.
- Whether `role_counts` should eventually be visibility-filtered too. Left alone deliberately;
  revisit only if a consumer depends on it meaning "visible".
