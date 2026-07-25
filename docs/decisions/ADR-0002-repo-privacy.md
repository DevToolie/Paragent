---
title: "ADR-0002 — Repository privacy (ALL-PRIVATE)"
doc_type: adr
status: accepted
owner: B0
created: 2026-07-24
updated: 2026-07-24
confidence: HIGH
supersedes: null
sources_verified: true
---

# ADR-0002 — Repository privacy (ALL-PRIVATE)

## Status

accepted

## Context

`DevToolie/Paragent` was **public**. Wave-2 packs instruct agents to write
vertical research, kill criteria, and pitch material. Publishing that in the
open discloses wedge, surfaces under evaluation, and falsification standards
before any of it is built.

Founder choice required before Wave 2:

- Option 1: make the repo private; single doc tree.
- Option 2: keep code public; put Track 2/3 in a separate private
  `Paragent-strategy` repo (two trees).

Non-negotiable either way: no credentials, session material, `.env`, customer
names, or third-party portal content.

## Options considered

### Option 1 — ALL-PRIVATE (chosen)

Honest case for: one clone for every agent; no dual-index drift; nothing here
benefits from being public at pre-seed.

Honest case against: loses casual star/SEO discovery; org must remember to keep
it private.

### Option 2 — PUBLIC-CODE-ONLY + private strategy repo

Honest case for: open-source positioning for the mechanism later; code review
optics.

Honest case against: B0 maintains two trees; risk of strategy docs leaking into
the public tree via mistaken PR; contracts/docs cross-links break.

## Decision

**PRIVACY MODE: ALL-PRIVATE (Option 1).**

Repository visibility set to **private** on 2026-07-24 via `gh repo edit`.
Track 1, 2, and 3 documents all live in this repo under `docs/`.

## Consequences

Easy: Wave-1 agents share one `docs/README.md` map; census archive and vertical
search sit beside gate results.

Hard: collaborators need explicit access; public README marketing is deferred.

Forecloses: accidental disclosure of vertical kill lists via public clone
(until someone re-publicizes — reversal signal below).

## Reversal cost

**Cheap to re-publicize code; expensive if strategy docs were mixed.** Signal to
reverse: deliberate open-source launch of Track-1 mechanism with strategy docs
split out (revisit Option 2 then). If reverting to public while strategy docs
remain, **strip or move** `docs/research/vertical-search/`, `docs/pitch/`, and
decision memos first.

## Open questions / what I could not verify

- Whether GitHub secret scanning / push protection org settings are enabled at
  the org level (repo CI secret-scan is in place regardless).
- Exact collaborator access list for Wave-1 agents (founder-owned).
