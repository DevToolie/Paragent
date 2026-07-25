---
title: "ADR-0005 — Repository is PUBLIC (supersedes ADR-0002)"
doc_type: adr
status: accepted
owner: B0
created: 2026-07-25
updated: 2026-07-25
confidence: HIGH
supersedes: docs/decisions/ADR-0002-repo-privacy.md
sources_verified: true
---

# ADR-0005 — Repository is PUBLIC

## Status

accepted — supersedes [ADR-0002](./ADR-0002-repo-privacy.md) in full.

## Context

**Triggered by:** issue #42. [ADR-0002](./ADR-0002-repo-privacy.md) was `status: accepted`
and declared **PRIVACY MODE: ALL-PRIVATE**, while `DevToolie/Paragent` was in fact public.
An accepted decision record contradicted reality — exactly the drift
[INTEGRITY-AUDIT.md](../INTEGRITY-AUDIT.md) exists to catch.

ADR-0002 also set an explicit precondition on any reversal:

> If reverting to public while strategy docs remain, **strip or move**
> `docs/research/vertical-search/`, `docs/pitch/`, and decision memos first.

That precondition was **not met**. Those paths were public throughout.

Verified state at decision time (2026-07-25):

| Fact | Value |
| --- | --- |
| Visibility | `public` |
| Forks | 0 |
| Secret scanning | enabled |
| Secret scanning push protection | enabled |
| Dependabot security updates | enabled |
| Credentials / tokens / `.env` in git history | none found |
| License | MIT |

The `GF_SECURITY_ADMIN_PASSWORD: paragent` value in `scripts/testbed/docker-compose.yml` is a
local Grafana fixture for a throwaway container, not a secret.

## Options considered

### Option A — PUBLIC, single tree (chosen)

Honest case for: the disclosure has already happened and cannot be retracted for anything
already cloned or indexed, so the confidentiality this would protect is largely spent. One
tree means no dual-index drift and no risk of a strategy doc leaking into a public tree via a
mistaken PR — the failure mode ADR-0002 named against Option 2. Public repos on the org's
current plan get branch protection, CODEOWNERS review requests, auto-merge, secret scanning
with push protection, CodeQL, and dependency review at no cost; private repos lose all of
those without GitHub Team. `.github/workflows/codeql.yml` and `dependency-review.yml` already
branch on `.private` and skip cleanly, which is evidence the repo was being operated as public
regardless of what ADR-0002 said.

Honest case against: this publishes the wedge, the six surfaces evaluated, the kill criteria,
and the falsification standards — precisely what ADR-0002 was written to prevent. Both FAIL
memos ([A8-DECISION.md](../research/census-week0/A8-DECISION.md),
[vertical-search/DECISION.md](../research/vertical-search/DECISION.md)) are readable by
anyone, including the observation that two consecutive vertical FAILs are a thesis signal. A
competitor gets the negative results for free, and a hostile reader gets a quotable "the
founder's own docs say the thesis may be dead."

### Option B — PUBLIC-CODE-ONLY + private strategy repo (two trees)

Honest case for: keeps `docs/pitch/` and `docs/research/vertical-search/` out of the open
while retaining open-source positioning for the mechanism.

Honest case against: does not un-publish anything already public — it only stops future
additions. Costs a second tree to maintain, breaks `docs/README.md` cross-links, and
reintroduces the mistaken-PR leak risk. Buying partial future confidentiality at that price,
after the material is already out, is not a good trade.

### Option C — Re-privatize

Honest case for: stops further indexing; restores ADR-0002's original intent.

Honest case against: does not retract existing clones, forks, or caches. Forfeits branch
protection, secret scanning with push protection, CodeQL, dependency review, and auto-merge
unless the org moves to GitHub Team. Removing the content properly would need a history
rewrite plus force-push, and `main` now blocks force-pushes, so protection would have to be
lifted to do it — trading a real, working safety control for confidentiality that is already
compromised.

## Decision

**PUBLIC. Single tree. Nothing stripped, nothing moved.**

Founder decision, 2026-07-25. ADR-0002's strip-or-move precondition is **explicitly waived**,
not satisfied — recorded here so no future reader mistakes the waiver for compliance.

`docs/research/`, `docs/pitch/`, `docs/prd/`, `docs/decisions/`, and
[INTEGRITY-AUDIT.md](../INTEGRITY-AUDIT.md) all remain in this repository and are intended to
be publicly readable.

## Consequences

**Easy.** One clone for every agent. The free tier of GitHub's security and review tooling
stays available. The repo's falsification discipline — two documented FAILs, a standing
integrity audit, a rule against inventing metrics — is visible, which is a defensible thing
to be judged on.

**Hard.** Every future strategy document is written in the open. Anything added to `docs/`
should be written on the assumption that a competitor, a candidate, and an investor will all
read it. That is a constraint on tone, not on honesty: the rule against softening findings
([CONTRIBUTING.md](../../CONTRIBUTING.md) rule 4) is unchanged and outranks any impulse to
look better in public.

**The non-negotiables now carry the entire weight.** With no confidentiality boundary left,
secret hygiene is the only line of defence:

- no credentials, cookies, session/storage dumps, `.env` files, or API tokens
- no customer or design-partner names
- no third-party portal screenshots or content

`npm run secret-scan` is merge-blocking in CI, GitHub secret scanning with push protection is
enabled at the repo level, and `npm run test:canary` blocks tenant strings reaching
pool-eligible cache rows. None of those may be weakened.

**What is not available, verified 2026-07-25.** Secret scanning **non-provider patterns** and
**validity checks** cannot be enabled on this org. Both require GitHub Secret Protection /
Advanced Security; `DevToolie` is on the **free** plan with
`maximum_advanced_security_committers: 0` and `purchased_advanced_security_committers: null`.

This failure mode is worth recording because it is silent: `PATCH /repos/{owner}/{repo}` with
`security_and_analysis.secret_scanning_non_provider_patterns.status = "enabled"` returns
**HTTP 200 with the field still `disabled`** — no error. Attaching an org code-security
configuration that sets them also reports `status: "attached"` while the effective repo
setting stays `disabled`. Anyone verifying by reading the configuration rather than the
repo's effective `security_and_analysis` would wrongly conclude the control is on.

Basic secret scanning and push protection **are** free for public repositories and are on. The
gap is only the advanced detectors.

**Forecloses:** any expectation of confidentiality for material already in this repository.

## Reversal cost

**High, and asymmetric.** Re-privatizing is one CLI call, but it un-publishes nothing — clones,
forks, and third-party caches persist. It also costs the security and review tooling listed
under Option C. Treat every commit as permanent publication.

Signal to reverse: a specific, named piece of material that must not be public — in which case
the answer is Option B for *future* documents, plus counsel advice on the existing ones. Not a
general change of heart about openness.

## Open questions / what I could not verify

- Whether to purchase GitHub Secret Protection to get non-provider patterns and validity
  checks (see Consequences — attempted and blocked by entitlement, not by configuration).
  Founder call; a cost question, not a technical one. Until then the merge-blocking
  `npm run secret-scan` and the free provider-pattern scanning are the whole control set.
- Whether `docs/pitch/` material being public creates any securities-communication concern is
  a founder/counsel question, outside this ADR. Related sizing work is issue #36.
- Whether third-party research citations in `docs/research/` raise any issue when public —
  [INTEGRITY-AUDIT.md](../INTEGRITY-AUDIT.md) records these as public URL citations only, with
  no portal content dumps, but that was audited under a different assumed posture.
- Collaborator access list and org-level security defaults remain founder-owned; unverified
  here.
