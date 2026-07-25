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
# Index updated 2026-07-25: C4 adversary-report linked
---

# docs/ ? map

Live index. Update this file when you add or supersede a document.

## Decisions (ADRs)

| Doc | Status | Owner | Last true |
| --- | --- | --- | --- |
| [ADR-0001 TypeScript + Node + Playwright](decisions/ADR-0001-typescript-node-playwright.md) | accepted | B0 | 2026-07-24 |
| [ADR-0002 Repo privacy ALL-PRIVATE](decisions/ADR-0002-repo-privacy.md) | accepted | B0 | 2026-07-24 |
| [ADR-0003 Grafana OSS test-bed](decisions/ADR-0003-testbed-grafana-oss.md) | accepted | B1 | 2026-07-25 |

## PRD / briefs

| Doc | Status | Notes |
| --- | --- | --- |
| [PRD v0.2](prd/PRD-trajectory-cache-v0.2.md) | accepted | §8 superseded by pivot brief |
| [Pivot brief v0.3](prd/pivot-brief-v0.3.md) | accepted | Counterparty selection rule; two-track plan |

## Research ? Week-0 census (FAILED ? preserve)

| Doc | Status | Owner |
| --- | --- | --- |
| [census-week0/](research/census-week0/) | killed (observability anchor) | A1?A8 |

## Research ? vertical search (Track 2)

| Doc | Status | Owner | Last true |
| --- | --- | --- | --- |
| [vendor-security-questionnaires-trust-portals.md](research/vertical-search/vendor-security-questionnaires-trust-portals.md) | draft (C1) | C1 | 2026-07-24 |
| [procurement-supplier-onboarding.md](research/vertical-search/procurement-supplier-onboarding.md) | draft (C1) | C1 | 2026-07-24 |
| [healthcare-payer-portals.md](research/vertical-search/healthcare-payer-portals.md) | draft (C2) | C2 | 2026-07-24 |
| [insurance-broker-carrier-portals.md](research/vertical-search/insurance-broker-carrier-portals.md) | draft (C2) | C2 | 2026-07-24 |
| [freight-carrier-customs-portals.md](research/vertical-search/freight-carrier-customs-portals.md) | draft (C3) | C3 | 2026-07-24 |
| [regulatory-government-filing-portals.md](research/vertical-search/regulatory-government-filing-portals.md) | draft (C3) | C3 | 2026-07-24 |
| [adversary-report.md](research/vertical-search/adversary-report.md) | draft (C4) | C4 | 2026-07-25 |
| DECISION.md | pending Wave 3 C5 | C5 | ? |

## Gate (Track 1)

| Doc | Status | Owner |
| --- | --- | --- |
| [testbed.md](gate/testbed.md) | draft | B1 |
| [recorder.md](gate/recorder.md) | draft | B2 |
| [compiler.md](gate/compiler.md) | draft | B3 |
| [runner.md](gate/runner.md) | draft | B4 |

## Privacy

| Doc | Status | Owner | Last true |
| --- | --- | --- | --- |
| [boundary-spec.md](privacy/boundary-spec.md) | review | B5 | 2026-07-24 |

## Pitch (Track 3)

| Doc | Status | Owner |
| --- | --- | --- |
| [pitch/](pitch/) | draft (Wave-1) | D1 |

## Contracts

See [`../contracts/`](../contracts/) ? trajectory, assertion, cache-row, metrics.

## Open questions / what I could not verify

- Gate number and vertical lock do not exist yet — do not invent them in this index.
- C4 adversary-report is attack-only — C5 DECISION.md still pending.

