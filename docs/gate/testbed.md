---
title: Track-1 Grafana OSS test-bed
doc_type: gate
status: draft
owner: B1
created: 2026-07-25
updated: 2026-07-25
confidence: HIGH
supersedes: null
sources_verified: true
---

# Gate — test-bed (Grafana OSS)

## Honesty first — proxy, not organic churn

**Version-bump churn is a PROXY for organic production churn.** Pinning
`grafana/grafana:9.5.21` then jumping to `13.0.3` compresses years of UI
redesign into a controlled upgrade. That is useful for measuring whether
compiled trajectories survive *discrete, vendor-shipped* surface changes. It is
**not** the same as:

- gradual A/B or feature-flag rollouts inside one major,
- tenant-specific plugins / custom chrome,
- CDN-delivered front-end shards that change without a semver bump,
- human workflow drift (new buttons operators learn to click).

Do not present matrix results as “we measured real production churn.” Present
them as “we measured survival across known OSS console redesigns under
accelerated upgrades.” Gate numbers derived here inherit this limitation.

## Choice

See [ADR-0003](../decisions/ADR-0003-testbed-grafana-oss.md). Target:
**Grafana OSS** image `grafana/grafana`. Runners-up: Sentry, Keycloak, Metabase.

## Version matrix

Source of truth: [`scripts/testbed/matrix.json`](../../scripts/testbed/matrix.json).
Tags and release URLs cited with `access_date: 2026-07-25`.

| Version | Released (matrix) | Churn role (why it is in the matrix) |
| --- | --- | --- |
| 9.5.21 | 2024-03 | baseline — pre-Scenes classic dashboards / nav |
| 10.0.13 | 2024-01 | Grafana 10 — Scenes preview; navigation / search changes |
| 10.4.19 | 2025-02 | late v10 — pre–Scenes-GA dashboard surface |
| 11.0.0 | 2024-05 | Grafana 11 — Scenes-powered dashboards; edit mode; alert detail redesign |
| 11.5.2 | 2025-02 | mid/late v11 — Scenes GA era consolidation |
| 12.0.0 | 2025-05 | Grafana 12 — Angular removal; dynamic dashboards / schema experiments |
| 12.2.1 | 2025-08 | mid v12 — continued Drilldown / dashboard workflow churn |
| 13.0.3 | 2026-07 | current major tip of matrix (Docker Hub tag verified 2026-07-25) |

External citations (also listed in `matrix.json` `sources`):

- Docker Hub tags: https://hub.docker.com/r/grafana/grafana/tags — access_date: 2026-07-25
- Run Grafana Docker image: https://grafana.com/docs/grafana/latest/setup-grafana/installation/docker/ — access_date: 2026-07-25
- Provisioning: https://grafana.com/docs/grafana/latest/administration/provisioning/ — access_date: 2026-07-25
- TestData: https://grafana.com/docs/grafana/latest/datasources/testdata/configure/ — access_date: 2026-07-25

## What the harness seeds

Deterministic local fixture (not a production secret):

- Admin user `admin` / fixture pass `paragent` via compose YAML colon-form env
  (`GF_SECURITY_ADMIN_*`), never dotenv-style credential assignments (CI secret-scan).
- Provisioned TestData datasource uid `paragent-testdata` (type rewritten per
  major: `&lt;10` → `testdata`, `≥10` → `grafana-testdata-datasource`).
- Seed dashboard uid `paragent-seed` (schemaVersion 30) with TestData panels.
- Operator user `paragent-operator` ensured via HTTP API after health.

Runtime overlays live under `scripts/testbed/.runtime/` (gitignored).

## CLI usage

```text
npm run testbed -- --list
npm run testbed -- --version 11.0.0 --dry-run
npm run testbed -- --version 11.0.0
npm run testbed -- --version 11.0.0 --port 3001
npm run testbed -- --version 11.0.0 --down
```

`--dry-run` prepares the provisioning overlay and prints the compose plan
without requiring a Docker daemon.

## Docker daemon limitation

This harness **ships** `docker-compose.yml` + seed HTTP client. If the local
(or CI) environment has no Docker daemon, `npm run testbed -- --version <X>`
exits non-zero after explaining the limitation; use `--dry-run` to prove the
plan path. Do not claim a seeded instance is up unless compose up + health +
seed succeeded.

## Open questions / what I could not verify

- Live pull + health for every matrix tag in this agent environment (dry-run
  path verified in CI instructions; full up depends on Docker).
- Whether B2 gate task (login + navigate) stays browser-meaningful once Grafana
  HTTP APIs cover the same clicks — Track-1 must pick tasks that still stress
  DOM locators, not only API-equivalent config.
- How far proxy results will generalize to Track-2 counterparty portals (unknown
  by design; do not invent a transfer metric).
