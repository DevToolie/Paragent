---
title: "Gate — pool vocabulary yield (issue #126)"
doc_type: gate-result
status: draft
owner: B5
created: 2026-08-12
updated: 2026-08-12
confidence: MED
supersedes: null
sources_verified: true
---

# Gate — pool vocabulary yield (#126)

Measurement backing [ADR-0017](../decisions/ADR-0017-pool-vocabulary-rule.md). Scope: the **one**
real compiled bundle in this repo,
[`artifacts/compiled/traj-gate-live-create-stat-dashboard-from-testdata-9.5.21.bundle.json`](../../artifacts/compiled/traj-gate-live-create-stat-dashboard-from-testdata-9.5.21.bundle.json)
— Grafana OSS **9.5.21**, 12 steps, live-recorded per [ADR-0006](../decisions/ADR-0006-track1-gate-task.md).
**Single bundle, single version.** No other pinned version has a compiled trajectory to measure.

## Scope and honesty

This doc measures what it can measure and says plainly what it cannot. It follows
[`docs/gate/cache.md`](./cache.md)'s own precedent ("Still unmeasured... reports `no_data`") and
CONTRIBUTING rule 3: no invented or extrapolated metric.

**In scope, measured today:** yield on the one live 9.5.21 bundle, two different ways (below),
and the effect of the new vocabulary rule on it.

**Out of scope, blocked:** the ADR-0003 matrix has 8 pinned versions
(`scripts/testbed/matrix.json`); measuring yield per version needs a live recording session
against each, which needs the Docker testbed. **This environment has no running Docker daemon**
(verified directly: `docker ps` fails — "failed to connect to the docker API ...: dial unix
...: connect: no such file or directory", i.e. no daemon socket present) and no
`ANTHROPIC_API_KEY` for a live agent-recorded session even if a daemon existed. Per-version yield
for 10.0.13, 10.4.19, 11.0.0, 11.5.2, 12.0.0, 12.2.1, 13.0.3 is **`no_data`**, not zero, not
interpolated from 9.5.21. This is a follow-up that needs an environment with a working Docker
testbed — the mechanism this PR ships is not blocked on it, but a claim about yield *across the
matrix* is.

## Two different numbers, and why they disagree

The bundle's own `pool_eligible` / `pool_ineligible_reason` fields are stamped by the
**compiler's pre-check** (`src/compiler/pool.ts`, `decidePoolEligibility`), which
[`docs/gate/compiler.md`](./compiler.md) already documents as deliberately conservative: "a
pre-check may be stricter than the authority; it may never be looser." The **authoritative**
decision is `writeCacheRow` / `buildPoolRow` (`src/cache/write.ts`) — B5, per
[`docs/privacy/boundary-spec.md`](../privacy/boundary-spec.md). Nothing in the live gate pipeline
currently pushes a compiled bundle through that authoritative path automatically (`docs/gate/cache.md`
open questions: "the gate matrix does not wire a sink"); `tests/integration/live-bundle-pool.test.ts`
does it for audit purposes, one-directionally (compiler says poolable ⇒ B5 must agree). This doc
does it in both directions, to measure yield rather than only guard a non-regression.

### 1. As stamped on the committed artifact (compiler pre-check)

Read directly off `artifacts/compiled/traj-gate-live-create-stat-dashboard-from-testdata-9.5.21.bundle.json`,
and independently reproduced bit-for-bit (aside from the `program` field ADR-0013 added after this
artifact was committed) by re-running the compiler against its source trajectory:

```bash
npm run compile -- --in experiments/gate-v1/trajectories/grafana-create-stat-dashboard-from-testdata-9.5.21.json --out <scratch>
# → rows=12 pool_eligible=7   (was 1 before #170 / ADR-0019)
```

| Outcome | Count |
| --- | --- |
| `pool_eligible: true` | **7 / 12** (58.3%) |
| `tenant_locator_text` | 4 |
| `literal_in_assertion` | 1 |

**Updated 2026-08-21 by [#170](https://github.com/DevToolie/Paragent/issues/170) /
[ADR-0019](../decisions/ADR-0019-pool-precheck-topology.md):** the pre-check now strips
`tenant_scoped` siblings the same way `buildPoolRow` does, so the stamped field matches the
authoritative write path. The historical `1 / 12` figure below is retained only as the
pre-alignment baseline.

### 2. As the authoritative write path (`src/cache/write.ts`) decides today

Each row's `compiled_action` + `assertion` fed into `buildPoolRow()` directly (the same shape
`writeCacheRowPair` consumes; `tests/integration/live-bundle-pool.test.ts` does the equivalent for
its own assertions). Measured **before any change in this PR** (verified with `git stash` against
the pre-PR `src/cache/taint.ts`) and **after**:

| Outcome | Before this PR | After this PR (vocabulary rule added) |
| --- | --- | --- |
| `pool_eligible: true` | **7 / 12** (58.3%) | **7 / 12** (58.3%) — unchanged |
| `literal_in_assertion` | 5 | 5 — unchanged |

The authoritative number is **7/12**. Before #170 the compiler pre-check stamped **1/12** on the
same bundle — a conservative disagreement, safe per `docs/gate/compiler.md`, but misleading
anyone who read the artifact's stamped field as the real number. Six rows (steps 2, 3, 4, 5, 8, 9)
pool via the existing `isPoolSafeStructuralPath` allowance (boundary-spec.md rule 2: structural
position without quoted attrs / free text) — none of them needed a name-vocabulary rule. Since
ADR-0019 the stamped field and the write path agree at 7/12.

**This PR's vocabulary rule changes the row-level count on this bundle by exactly zero**, and
that is reported here rather than hidden. Two independent, already-out-of-scope reasons:

1. **Five rows are blocked by `literal_in_assertion`, not by locator vocabulary.** Steps 0, 1, 7,
   10, and 11 all carry a `url-matches` assertion whose `expected.template` residue (after typed
   holes are stripped) is a URL path — `assertionHasTenantLiteral()` refuses the **row**
   unconditionally, before any locator is even considered. `docs/gate/compiler.md`'s own open
   questions already name this as "the single biggest reason" the bundle under-pools, and flag
   loosening it as B5's call, deliberately not made in a compiler PR. It is not made here either —
   this PR's scope is the positive allowlist, not the assertion-literal rule, and reopening it
   needs its own decision.
2. **The recorder blanket-tags every `role_name` / `label` / `text` locator candidate
   `tenant_scoped: true`, independent of content.** Confirmed directly in the source trajectory
   (`experiments/gate-v1/trajectories/grafana-create-stat-dashboard-from-testdata-9.5.21.json`,
   e.g. step 2's `toggle-viz-picker` candidates) — this is also stated in
   `docs/gate/compiler.md` ("the recorder marks role_name, label and text candidates
   tenant_scoped: true"). `caller_marked_tenant` (`src/cache/taint.ts`) correctly and
   independently honors that upstream claim ahead of, and regardless of, any vocabulary match —
   that is the fail-closed behavior the boundary spec requires, not a bug. But it means a
   content-based vocabulary rule is **structurally inert on every locator this recorder has ever
   produced**, including all 12 rows of the only bundle in this repo. This is `src/recorder/`
   territory, explicitly out of scope for this PR (see PR description).

### 3. Where the rule *does* have effect: per-locator, and on a different code path

Two things are real and demonstrated, even though row-level yield on this bundle does not move:

- **Per-locator, on this bundle's testid dimension.** Step 7's `data-testid Apply changes and go
  back to dashboard` locator (the only locator strategy the recorder does *not* blanket-tag) moves
  from `non_vocab_testid`-tainted to pool-safe under the new rule. It does not change step 7's
  `pool_eligible` boolean (still blocked by `literal_in_assertion`, reason 1 above), but it is a
  real, individually-verifiable change in what the write path would keep, auditable the same way
  as the row-level numbers above.
- **On repair-proposed locators (ADR-0009, #64), which the recorder never touches.** A repair
  rewrite's `corrected_action` is a model proposal, not a recorded candidate — nothing in
  `src/cache/update.ts` / `src/cache/confidence.ts` stamps `tenant_scoped` on it (confirmed: no
  such assignment exists in either file), and `tests/canary/repair-rewrite.test.ts` already models
  repair candidates this way (no `tenant_scoped` field on its `role_name` locator). A repair
  proposing a locator named `toggle-viz-picker` was refused before this PR (not in
  `UI_CHROME_NAMES`) and pools after it, purely on content — demonstrated in
  `tests/canary/vocabulary.test.ts`. This is real, live-today code (the repair *rewrite* landed in
  #64); what has not landed is the model that would generate a repair proposal (#27,
  [ADR-0012](../decisions/ADR-0012-repair-context-budget.md)) — so this path has no bundle to
  measure a yield number on yet, and none is claimed.

## Verified vocabulary entries (`src/cache/vocabulary.ts`)

Each independently checked against the public `grafana/grafana` GitHub repository at tag
`v9.5.21` on 2026-08-12 (network access confirmed working in this environment; no live fetch at
write time or in CI — the snapshot is committed, per the PR constraints).

| String | Kind | Source | Confirms bundle step |
| --- | --- | --- | --- |
| `Add new panel` | accessible name | [`DashboardEmpty.tsx`](https://raw.githubusercontent.com/grafana/grafana/v9.5.21/public/app/features/dashboard/dashgrid/DashboardEmpty.tsx) line 42, `aria-label="Add new panel"` | step 1 |
| `toggle-viz-picker` | accessible name | [`VisualizationButton.tsx`](https://raw.githubusercontent.com/grafana/grafana/v9.5.21/public/app/features/dashboard/components/PanelEditor/VisualizationButton.tsx) line 45, `aria-label={selectors...toggleVizPicker}`; selector value at [`components.ts`](https://raw.githubusercontent.com/grafana/grafana/v9.5.21/packages/grafana-e2e-selectors/src/selectors/components.ts) line 139 | step 2 |
| `Plugin visualization item Stat` | accessible name | [`PanelTypeCard.tsx`](https://raw.githubusercontent.com/grafana/grafana/v9.5.21/public/app/features/panel/components/VizTypePicker/PanelTypeCard.tsx) line 42, `aria-label={selectors...PluginVisualization.item(plugin.name)}`; template at `components.ts` line 273; `plugin.name === "Stat"` confirmed in [`public/app/plugins/panel/stat/plugin.json`](https://raw.githubusercontent.com/grafana/grafana/v9.5.21/public/app/plugins/panel/stat/plugin.json) | step 3 |
| `Alias` | accessible name | [`QueryEditor.tsx`](https://raw.githubusercontent.com/grafana/grafana/v9.5.21/public/app/plugins/datasource/testdata/QueryEditor.tsx) line 204, `<InlineField label="Alias" ...>` | step 4 |
| `data-testid Apply changes and go back to dashboard` | testid | [`PanelEditor.tsx`](https://raw.githubusercontent.com/grafana/grafana/v9.5.21/public/app/features/dashboard/components/PanelEditor/PanelEditor.tsx) line 362, `data-testid={selectors...applyButton}`; selector value at `components.ts` line 138 | step 7 |

All five access dates: **2026-08-12**, fetched via `raw.githubusercontent.com` and
`api.github.com` (GitHub code search needs auth and was not usable; directory listing + raw file
fetch was).

**Not included, and why:** `"Apply"` (step 7's `role_name`/button text) was a candidate — it is
plausibly real Grafana chrome — but was not independently verified against a public source within
the time available, so it is not in the snapshot (CONTRIBUTING rule 2/3: no unsourced entry). It
would not have changed anything above even if verified: the recorder already marked that specific
locator `tenant_scoped: true` in the source trajectory, which `caller_marked_tenant` refuses
regardless of vocabulary.

## Open questions / what I could not verify

- **Multi-version yield is `no_data`.** Blocked by the lack of a running Docker testbed in this
  environment (see "Scope and honesty" above). A follow-up run needs `docker run
  grafana/grafana-oss:<tag>` for each `scripts/testbed/matrix.json` entry, a live recording
  session per version, and re-running this same measurement.
- **Version-blind matching.** `src/cache/vocabulary.ts` does not currently key its lookup by which
  pinned version compiled a given row — `CacheRowCandidate` / `CompiledLocator` carry no field for
  it (the trajectory's `provenance.testbed_version` is not threaded through the compiler). A match
  can only ever *add* a source-cited vendor string to the allowlist, so this cannot admit tenant
  content, but it does mean the snapshot's version tags are documentation, not yet enforcement.
  Fixing this needs a schema change to `CacheRowCandidate` — deferred; see ADR-0017.
- **The recorder's blanket tagging is the load-bearing constraint on this bundle, not
  vocabulary — and is out of scope here.** `src/recorder/` was explicitly excluded from this PR.
  If it stops blanket-tagging `role_name`/`label`/`text` candidates (or starts doing so
  selectively), the vocabulary rule in this PR would immediately have real, measurable row-level
  effect on future bundles without further changes to `src/cache/`.
- **`literal_in_assertion` on `url-matches` residue is the other load-bearing constraint**, and is
  also out of scope — `docs/gate/compiler.md` already names it and defers the decision to B5 as a
  separate question from this one.
