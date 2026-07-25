---
title: Gate-v1 experiment harness (throwaway)
doc_type: runbook
status: draft
owner: B0
created: 2026-07-24
updated: 2026-07-25
confidence: HIGH
supersedes: null
sources_verified: true
---

# experiments/gate-v1/

**Throwaway.** This directory holds the Week gate harness only. Do not promote
it into a product API. B4 owns the matrix driver and amortized-cost report.

## Trajectories (B2)

| Path | Notes |
| --- | --- |
| `trajectories/grafana-fixture-login-dashboards.json` | Fixture-recorded gate task; schema-valid; zero literal input values |

Record: `npm run recorder -- --fixture` (see `docs/gate/recorder.md`).

## Open questions / what I could not verify

- Version matrix — pending B1 / ADR-0003.
- Live Grafana base-version recording — re-run with `--base-url` once test-bed is up.
