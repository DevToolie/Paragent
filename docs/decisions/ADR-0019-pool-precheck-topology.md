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

**Option 1.** `decidePoolEligibility` filters to pool-safe locators before deciding
(exclude `tenant_scoped`, `text`, `placeholder`, and the `topology_only` sentinel). If any
survive, continue with assertion / role checks on that subset. If none survive but the
compiler flagged `topologyOnly` (or the chain carries a `topology_only` sentinel), return
`pool_eligible: true`. Empty chains (navigate/wait) still fall through to assertion checks
as before.

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
  matching `--to-cache`.
- `docs/gate/compiler.md` and related pool docs stop recording the divergence as open.
- The direction invariant and `live-bundle-pool.test.ts` stay merge-blocking (expectation
  updated to the new observation).
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
- Whether `decidePoolEligibility` should eventually call the same `checkLocatorTaint` the
  authority uses, rather than trusting the compiler's `tenant_scoped` bit — today the live
  bundle agrees at 7/12 with the filtered-chain approach, but a future taint rule could re-open
  a gap if the compiler's tagging and the cache's checker diverge again.
