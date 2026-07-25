---
title: Documentation index
doc_type: brief
status: draft
owner: B0
created: 2026-07-24
updated: 2026-07-25
confidence: HIGH
supersedes: null
sources_verified: true
---

# docs/ — map

Live index. Update this file when you add or supersede a document.

## Decisions (ADRs)

| Doc | Status | Owner | Last true |
| --- | --- | --- | --- |
| [ADR-0001 TypeScript + Node + Playwright](decisions/ADR-0001-typescript-node-playwright.md) | accepted | B0 | 2026-07-24 |
| [ADR-0002 Repo privacy ALL-PRIVATE](decisions/ADR-0002-repo-privacy.md) | accepted | B0 | 2026-07-24 |
| ADR-0003 Test-bed target | pending B1 | B1 | — |

## PRD / briefs

| Doc | Status | Notes |
| --- | --- | --- |
| `prd/` | placeholder | Founder supplies PRD v0.2 + pivot brief v0.3 |

## Research — Week-0 census (FAILED — preserve)

| Doc | Status | Owner |
| --- | --- | --- |
| [census-week0/](research/census-week0/) | killed (observability anchor) | A1–A8 |

## Research — vertical search (Track 2)

| Doc | Status | Owner |
| --- | --- | --- |
| `research/vertical-search/` | empty — Wave 1 C1–C3 | C1–C5 |

## Gate (Track 1)

| Doc | Status | Owner |
| --- | --- | --- |
| `gate/testbed.md` | pending B1 | B1 |
| `gate/recorder.md` | pending B2 | B2 |
| [gate/compiler.md](gate/compiler.md) | draft | B3 |
| `gate/runner.md` | pending B4 | B4 |

## Privacy

| Doc | Status | Owner | Last true |
| --- | --- | --- | --- |
| [boundary-spec.md](privacy/boundary-spec.md) | review | B5 | 2026-07-24 |

## Pitch (Track 3)

| Doc | Status | Owner |
| --- | --- | --- |
| `pitch/` | pending D1 | D1 |

## Contracts

See [`../contracts/`](../contracts/) — trajectory, assertion, cache-row, metrics.

## Open questions / what I could not verify

- PRD v0.2 and pivot brief v0.3 not yet copied into `docs/prd/` (founder supply).
- Gate number and vertical lock do not exist yet — do not invent them in this index.
- Privacy boundary vocabulary may need reconciliation when PRD `�6` lands on disk
  (see `privacy/boundary-spec.md` open questions).
