---
title: "ADR-0017 — A pinned-version vocabulary rule, added to the pool allowlist"
doc_type: adr
status: accepted
owner: B5
created: 2026-08-12
updated: 2026-08-12
confidence: MED
supersedes: null
sources_verified: true
---

# ADR-0017 — A pinned-version vocabulary rule, added to the pool allowlist

## Status

accepted

## Context

**Triggered by:** issue #126.

The only real compiled trajectory in this repo —
[`artifacts/compiled/traj-gate-live-create-stat-dashboard-from-testdata-9.5.21.bundle.json`](../../artifacts/compiled/traj-gate-live-create-stat-dashboard-from-testdata-9.5.21.bundle.json),
12 steps, live Grafana OSS 9.5.21 — has `pool_eligible: true` stamped on **1 of 12** rows. The
issue's diagnosis: `isChromeName()` (`src/cache/allowlist.ts`) is an exact match against
`UI_CHROME_NAMES`, ~50 generic words. Locator names like `Add new panel`, `toggle-viz-picker`,
and `Plugin visualization item Stat` are not generic chrome — they are **Grafana's own UI
vocabulary at a pinned open-source version**, reproducible by anyone who runs `docker run
grafana/grafana-oss:9.5.21`, and rejected only because they are not on a 50-word hand list.

The issue asked for three things: measure yield properly (per version, per rejection reason),
decide whether product vocabulary is pool-safe, and record the decision here or conclude the
tenant cache is the product and say so in the pitch.

**The measurement changed the question.** [`docs/gate/pool-vocabulary.md`](../gate/pool-vocabulary.md)
has the full detail; the short version:

- The bundle's stamped `1/12` is the **compiler's pre-check** (`src/compiler/pool.ts`), which
  `docs/gate/compiler.md` already documents as deliberately stricter than the authority.
- Routed through the **authoritative** write path (`buildPoolRow`, `src/cache/write.ts`) instead,
  the same bundle is **7/12** pool-eligible today — before this ADR's rule changes anything.
  Structural-position locators (boundary-spec.md rule 2) already rescue six of those seven; no
  vocabulary rule was needed for them.
- The remaining five rows are blocked by `literal_in_assertion` — a `url-matches` assertion whose
  template residue is a URL path — a rule this ADR does not touch (already flagged as a separate,
  deliberate open question in `docs/gate/compiler.md`).
- **The rule this ADR adds changes the row-level count on this bundle by zero**, because the
  recorder blanket-tags every `role_name` / `label` / `text` candidate `tenant_scoped: true`
  (confirmed in the source trajectory), and `caller_marked_tenant` correctly honors that upstream
  claim ahead of any vocabulary match. Content-based vocabulary matching cannot rescue a locator
  the recorder has already claimed as tenant, by design.

So the honest premise going in — "the vocabulary gap is why this bundle pools 1 in 12" — does not
survive contact with the authoritative code path. The vocabulary gap is real, but on the one
bundle this repo can measure, it is not the binding constraint. Two other things are: an
overly-conservative compiler pre-check, and the recorder's blanket tagging policy. Both are
outside this PR's scope (`src/recorder/` was explicitly excluded; the assertion-literal rule is a
separate B5 decision `docs/gate/compiler.md` already deferred).

## Decision

**Ship the vocabulary rule as a genuine, narrow addition to the positive allowlist — and say
plainly that it measures zero yield improvement on the one bundle available, because two
different, already-known, out-of-scope mechanisms are what's binding there.** This is not "the
tenant cache is the product": the evidence indicts the compiler pre-check and the recorder's
tagging policy, not the principle that pinned-version product vocabulary is poolable. Killing the
vocabulary work over a measurement that names the wrong culprit would be a worse error than
shipping a currently-quiet, architecturally real improvement.

### What shipped

1. **`src/cache/vocabulary.ts`** — a committed, source-cited snapshot of strings independently
   verified against the public `grafana/grafana` GitHub repository at tag `v9.5.21`:
   `Add new panel`, `toggle-viz-picker`, `Plugin visualization item Stat`, `Alias` (all four the
   issue named), plus `data-testid Apply changes and go back to dashboard` (found verifying the
   others). Every entry carries the exact file, line, and access date
   (`docs/gate/pool-vocabulary.md` has the full citation table). One candidate — `"Apply"` — was
   **not** included: not independently verified in the time available, and it would not have
   changed anything anyway (that exact locator is already `tenant_scoped: true` in the source
   trajectory).

2. **Additive, not a rewrite.** `allowlist.ts` gained `isPoolSafeAccessibleName` /
   `isPoolSafeTestId` (existing `isChromeName` / `isAllowedTestId` untouched, still used
   unqualified in `assertionHasTenantLiteral` — widening that is a separate decision). `taint.ts`'s
   `aria_label_or_name_tenant`, `role_text_tenant`, and `non_vocab_testid` rules now call the
   composed functions; `caller_marked_tenant`, `free_text_strategy`, and every other rule are
   unchanged.

3. **No live fetch, ever.** The snapshot is a committed artifact. Neither `write.ts` nor CI
   depends on network reachability to decide whether a row is safe to share — the fail-closed
   guarantee cannot be flaky on that axis. Network access was used once, by hand, to build and cite
   the snapshot; nothing in the shipped code calls GitHub.

4. **Structural collision resistance, not string-equality collision resistance.** The issue asked
   how the rule tells "Grafana's own accessible name" apart from "a tenant string that happens to
   collide with one." The answer uses a signal the boundary already had: `CompiledLocator.tenant_scoped`,
   set by whatever produced the locator (recorder or repair proposal) and honored unconditionally by
   `caller_marked_tenant`, which runs independently of the vocabulary check and is never
   overridden by it. A locator whose name is byte-identical to a snapshot entry is still refused if
   it carries `tenant_scoped: true`. `tests/canary/vocabulary.test.ts` proves both directions —
   the vocabulary string pools when untagged, and is refused when tagged, including a
   mutation test (removing `caller_marked_tenant` breaks the guarantee, proving it is load-bearing).

### Where it has real effect today, and where it does not

- **Zero effect on the one live bundle's row-level yield**, for the reasons above. This is
  measured, not guessed — see `docs/gate/pool-vocabulary.md`.
- **Real, individually-verified effect on that bundle's one testid locator** (step 7's `Apply`
  button), which the recorder does not blanket-tag — moves from tainted to pool-safe, though the
  row stays blocked by `literal_in_assertion` regardless.
- **Real, demonstrated effect on repair-proposed locators** (ADR-0009 / #64), which are model
  proposals, not recorder output, and carry no blanket `tenant_scoped` tag. A repair proposing
  `toggle-viz-picker` was refused before this ADR and pools after it, purely on content — the
  scaling story for this mechanism runs through the repair path, not through re-recording the same
  bundle. That path has no live model behind it yet (#27 is unbuilt), so no yield number is claimed
  for it either — only that the mechanism is real and tested.

## Consequences

**Pool yield on the one measured task is unchanged by this PR: 7/12 authoritative, both
before and after.** `docs/pitch/` claims resting on cross-tenant pooling as a realized network
effect are not supported by this measurement and are annotated accordingly, not deleted — the
mechanism argument (product vocabulary is legitimately poolable, verifiably so for pinned
open-source software) still holds; the yield argument does not, yet.

**Two follow-up decisions are now visible and belong to other owners.** Whether the recorder
should stop blanket-tagging `role_name`/`label`/`text` candidates (letting the write-time
boundary make the real call, the way it already does for `testid` and `structural`) is
`src/recorder/` territory, out of this PR. Whether `literal_in_assertion` should stop refusing a
`url-matches` template whose residue is a path is B5's call but a separate one from vocabulary —
`docs/gate/compiler.md` already deferred it and this ADR defers it again rather than bundling two
decisions into one PR.

**The snapshot covers one version of one product.** Extending it to the rest of the
ADR-0003 matrix, or to a second self-hosted product, means repeating the same verify-and-cite
process per version — real, bounded, unglamorous work, not a research problem. It does not extend
to closed SaaS portals with no public source to verify against; the 50-word `UI_CHROME_NAMES`
floor remains the only thing that helps there, unchanged by this ADR.

## Reversal cost

**Low.** `vocabulary.ts` is a new, isolated module; removing the two-line composition in
`allowlist.ts` and reverting the three call sites in `taint.ts` to `isChromeName` /
`isAllowedTestId` restores prior behavior exactly, since the snapshot's marginal effect on every
row this repo can currently observe is already zero. No schema changed, no store format changed,
no existing row is reinterpreted.

## Open questions / what I could not verify

- **Multi-version yield is `no_data`.** Blocked by no running Docker daemon in this environment —
  see `docs/gate/pool-vocabulary.md` "Scope and honesty". If the matrix measurement later shows
  9.5.21's pattern (compiler pre-check far stricter than authority; recorder tagging dominant) does
  *not* generalize, this ADR's framing should be revisited, not just its snapshot content.
- **Version-blind matching is a real, named gap.** The snapshot tags each entry with a pinned
  version for citation purposes, but the lookup does not filter by which version compiled a given
  row — `CacheRowCandidate` carries no version field today (the trajectory's
  `provenance.testbed_version` is not threaded through the compiler). This can only ever *widen*
  the allowlist with more verified vendor strings, never admit tenant content, so it does not
  weaken the fail-closed guarantee — but it is imprecise, and fixing it needs a `CacheRow` /
  contract change out of scope here.
- **Whether the collision guarantee generalizes past name-based locators.** This ADR's collision
  proof relies on `tenant_scoped` being set (or not) correctly by whatever produces a locator. For
  the recorder, it is set blanket-conservatively (safe, but makes the vocabulary rule moot there).
  For a hypothetical future producer that sets it *incorrectly permissive* — attests
  `tenant_scoped: false` on something that is actually tenant content — this rule (and
  `caller_marked_tenant` generally) would trust that attestation. That is an existing property of
  the boundary, not introduced here, but this ADR is the first change to make a vocabulary match
  meaningfully additive, so it is worth naming: the collision guarantee is only as good as the
  upstream `tenant_scoped` attestation, and this PR does not audit that attestation's correctness
  for any producer.
- **`isChromeName` / `isAllowedTestId` were deliberately left unqualified in
  `assertionHasTenantLiteral` (write.ts) and in the `free_text_strategy` / `non_vocab_css_attr`
  attribute-value checks (taint.ts).** Extending vocabulary matching there is a plausible next
  step (the `literal_in_assertion` rows above are exactly where it would matter) but is a separate,
  larger surface — assertion templates and CSS attribute values are a different trust question
  than a locator's own accessible name — and was not evaluated in the time available.
