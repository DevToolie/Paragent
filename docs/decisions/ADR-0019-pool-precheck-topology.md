---
title: "ADR-0019 — Compiler pool pre-check agrees with write-time authority on locator stripping"
doc_type: adr
status: accepted
owner: B3
created: 2026-08-21
updated: 2026-08-21
confidence: HIGH
supersedes: null
sources_verified: true
---

# ADR-0019 — Compiler pool pre-check agrees with write-time authority on locator stripping

## Status

accepted

## Context

**Triggered by:** [#170](https://github.com/DevToolie/Paragent/issues/170), filed out of
[#169](https://github.com/DevToolie/Paragent/issues/169) once `paragent compile --to-cache`
made the compiler pre-check (`decidePoolEligibility`) and the write-time authority
(`buildPoolRow` / `writeCacheRow`) comparable on real data.

On the committed 12-step live gate bundle the pre-check marked **1** row poolable and the
authority marked **7**. The gap was one rule, measured against the live trajectory:

- **Authority** (`src/cache/write.ts::buildPoolRow` / `classifyLocators`): strip
  `tenant_scoped` / taint-failing locators, keep the survivors. When a `structural`
  sibling remains, pool it. When nothing remains but `flow_topology` exists, pool a
  locator-less `topology_only` row.
- **Pre-check** (`src/compiler/pool.ts::decidePoolEligibility`): refused the **whole
  chain** on `chain.some(l => l.tenant_scoped)` — so a single tenant-tagged candidate
  made the row ineligible even when a pool-safe `structural` survived.

Nothing tenant-derived escaped either way. The dangerous direction (pre-check looser than
authority) is already pinned by `tests/integration/live-bundle-pool.test.ts`. The problem was
silent drift between two fail-closed implementations of one rule, plus an understated
`pool_eligible` flag on every committed bundle — a §9 / ADR-0014 input about how much of a
task is shareable.

Three options were on the table in #170:

1. Teach the pre-check to strip the same way the authority does (agree).
2. Make the authority stricter (drop survivors / topology_only pooling).
3. Delete the pre-check now that the authority runs on a shipped path.

## Decision

**Option 1, implemented by calling the authority's own checker.**
`decidePoolEligibility` no longer re-derives the vocabulary; it calls
`checkLocatorTaint` (`src/cache/taint.ts`) — the same predicate `classifyLocators` and
`assertionHasTenantLiteral` use — and mirrors `buildPoolRow`'s branch order:

1. Assertion first. `expected.template` residue, **the assertion's own
   `target.locator` through `checkLocatorTaint`**, then the prose/selector heuristics.
2. Classify the chain with `checkLocatorTaint`. Any untainted survivor ⇒ eligible. A
   `topology_only` sentinel is untainted by definition (`createTaintChecker`
   short-circuits on it), so a degraded chain lands in the pool set on both sides
   without a rule written twice.
3. Otherwise degrade to a locator-less topology row **only if the row will carry
   `flow_topology`** — the authority's actual gate. `compileStep` now computes
   `flow_topology` before deciding and passes `hasFlowTopology` in.
4. Otherwise refuse, naming the first taint reason.

### Why call the checker rather than re-filter by strategy

A first cut of this ADR filtered by strategy (`tenant_scoped` / `text` / `placeholder` /
`topology_only`) instead. It aligned the live bundle at 7/12 and passed
`live-bundle-pool.test.ts` — and still shipped a **looser-than-authority** pre-check,
because a strategy filter cannot see a vocabulary violation. A `testid` of
`dismiss-notice` is not tenant-tagged and is not free text, so the filter kept it; the
authority's `isPoolSafeTestId` rejects it, and the assertion carrying it in
`target.locator` made `writeCacheRow` throw `CacheWriteRejectedError` on the fixture
recording — crashing `record -> compile -> cache`, the one path that has to work.

The gap predated #170 and was merely unreachable: the blanket `chain.some(tenant_scoped)`
refusal caught those rows a step earlier, so the two implementations agreed by accident.
Removing that refusal (correctly) exposed it. Two copies of one vocabulary is the defect;
one copy with two callers is the fix.

### Why not option 2

Surviving `structural` locators and the `topology_only` degradation are already
canary-tested as the safe path. Narrowing the pool now would change the authority without
evidence those rows are useless cross-tenant, and would need an ADR-0014 amendment of its
own. That is a separate question; this ADR does not decide it.

### Why not option 3

The bundle's `pool_eligible` is still what humans and docs read when they reason about a
committed artifact without running `--to-cache`. Keeping a pre-check that *agrees* with the
authority preserves that prediction; deleting it would leave the field as a historical lie
or force every reader through the write path. The direction invariant (pre-check never
looser) still needs a named function to pin.

## Consequences

- Committed live bundle regenerated: `pool_eligible` moves from **1/12** to **7/12**,
  matching `--to-cache`. Recompiling it under the final implementation reproduces it
  **byte-for-byte**, so the alignment is a property of the rule, not of one run.
- Committed fixture bundle (`traj-example-grafana-login-nav.bundle.json`) regenerated:
  step 5 moves `true → false` / `literal_in_assertion`, now matching the authority. It is
  **4/6 → 3/6**. That row was never safe to pool; the pre-check simply could not see it.
- Divergence measured at **0** on all three corpora — live bundle, fixture bundle, and a
  freshly recorded fixture trajectory (12 / 6 / 6 rows).
- `docs/gate/compiler.md` and related pool docs stop recording the divergence as open.
- `live-bundle-pool.test.ts` now runs its two invariants over **both** committed bundles.
  Scoping them to the live bundle is what let the fixture-only divergence through.
- `compileStep` computes `flow_topology` before the pool decision rather than after.
- Canary suite unmodified.

## Sources

- `src/compiler/pool.ts`, `src/cache/write.ts` at the commit that lands this ADR
- [#170](https://github.com/DevToolie/Paragent/issues/170)
- [ADR-0014](./ADR-0014-cache-read-path.md) (pool as cross-tenant reuse population)

## Open questions / what I could not verify

- Whether a locator-less `topology_only` pool row is *useful* to a different tenant at replay
  time — this ADR only aligns the pre-check with the authority that already emits them; it does
  not measure cross-tenant hit rate (#67 / hit-rate still `no_data`).
- Whether B5 should refuse URL-path residues in assertions (still open in
  `docs/gate/compiler.md`); that disagreement is separate and still safe-direction.
- ~~Whether `decidePoolEligibility` should eventually call the same `checkLocatorTaint` the
  authority uses, rather than trusting the compiler's `tenant_scoped` bit.~~ **Resolved
  here — it does.** The question was raised as a future risk and turned out to be a present
  one: the filtered-chain approach shipped a looser-than-authority pre-check that crashed
  the fixture path. A new taint rule now reaches both callers at once.
- `src/compiler/pool.ts` importing from `src/cache/` points the compiler at a downstream
  package. It is not a new edge — `src/compiler/cli.ts` has imported `ingestBundle` /
  `writeCacheRow` / `JsonlCacheStore` since [#166](https://github.com/DevToolie/Paragent/issues/166) —
  and `taint.ts` is a leaf (it imports only `allowlist.ts` and `types.ts`). If the direction
  is judged wrong, the shared vocabulary belongs in `src/shared/` on the
  [#74](https://github.com/DevToolie/Paragent/issues/74) pattern rather than copied back
  into the compiler. Not decided here.
- `PoolIneligibleReason` (compiler) and `TaintReason` (cache) remain separate unions, so the
  pre-check maps between them lossily. The **boolean** is what `writeCacheRow` compares, so a
  reason mismatch is cosmetic — but the two vocabularies are still a place drift can hide.
