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
| [ADR-0003 Test-bed = Grafana OSS](decisions/ADR-0003-testbed-grafana-oss.md) | accepted | B1 | 2026-07-25 |

## PRD / briefs

| Doc | Status | Notes |
| --- | --- | --- |
| [PRD v0.2](prd/PRD-trajectory-cache-v0.2.md) | accepted (dev-ready) | §8 superseded by pivot brief |
| [Pivot brief v0.3](prd/pivot-brief-v0.3.md) | accepted | Replaces §8 selection rule; two-track plan |

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
| [gate/testbed.md](gate/testbed.md) | draft | B1 |
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

- Gate number and vertical lock do not exist yet — do not invent them in this index.
- Privacy boundary vocabulary may need reconciliation when PRD `�6` lands on disk
  (see `privacy/boundary-spec.md` open questions).
