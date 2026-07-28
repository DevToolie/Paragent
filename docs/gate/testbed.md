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

## Seed verification (`--verify`)

The gate measures whether a compiled trajectory survives a version bump. That is
only meaningful if the **only** difference between two runs is the Grafana
version. A seed that quietly produces three panels on one version and two on
another turns a seeding artifact into something that looks like churn.

```text
npm run testbed -- --version 11.0.0 --verify           # summary to stdout
npm run testbed -- --version 11.0.0 --verify --json    # + save the fingerprint
npm run testbed -- --version 11.0.0 --verify --dry-run # print the query plan only
npm run testbed -- --verify --compare 9.5.21 11.0.0    # exit 0 only if state matches
```

`--verify --json` writes a canonical fingerprint to
`scripts/testbed/.runtime/verify-<version>.json` (gitignored). Canonical means
sorted keys, panels sorted by title then type, no timestamps, and no
Grafana-assigned ids — so two equal states serialize to identical bytes.
`--compare` is the actual guard: a per-version fingerprint nobody diffs proves
nothing.

### What is in the fingerprint

| Object | Fields |
| --- | --- |
| Datasource | `uid`, `name`, `queryable` (a real `/api/ds/query` round-trip) |
| Dashboard `paragent-seed` | `uid`, `title`, `panel_count`, sorted `panels[]` of title + type |
| Users | `operator_present`, `operator_role` |

### What is deliberately excluded, and why

- **`datasource_type`** — flips from `testdata` to `grafana-testdata-datasource`
  across the matrix. Including it would fail every cross-major compare for a
  reason already known and accepted. Printed alongside the fingerprint so a
  human can see which side of the boundary they are on. *(ADR-0003 placed that
  flip at v10; PR #80 measured it at **10.2.0**. The fingerprint is unaffected —
  excluding the field is what makes it robust to the boundary moving — but the
  value printed beside it is the thing to read when a version misbehaves.)*
- **`grafana_version`** — the one thing that is *supposed* to differ.
- **Grafana-assigned numeric ids, `version`, `created`/`updated` timestamps** —
  not stable across a re-seed, let alone across versions.
- **Row containers** — a collapsed row nests its children, so rows are flattened
  and the row itself dropped; whether a row is collapsed must not decide the
  panel count.

If you add to the seed, add it here — a field the seed creates and `--verify`
ignores is a confound the gate cannot see.

### Result — verified 2026-07-25, no divergence found

Run on Docker 28.5.1, one version at a time on port 3000, each booted fresh:

| Check | Result |
| --- | --- |
| Same version seeded twice (11.0.0, torn down between) | **byte-identical** |
| 9.5.21 vs 11.0.0 — across the v10 plugin-id rename | **identical** |
| 11.0.0 vs 12.0.0 | **identical** |

All three fingerprints share one SHA-256 (`f6382c93…1108b7`): the TestData `type`
rewrite produces equivalent observable state on all three of these tags.

**Scope that result carefully.** It holds for `9.5.21`, `11.0.0` and `12.0.0`
only. It does *not* clear the rewrite in general: PR #80 subsequently measured
the plugin-id rename at **10.2.0**, not 10.0, which means `10.0.13` was being
provisioned with the wrong type the whole time — the datasource listed fine and
every query returned `plugin.notRegistered`. The three tags compared here happen
to sit on correct sides of the real boundary, so the compare could not see it.

That defect is the argument for `queryable` being in the fingerprint rather than
mere presence: a datasource that exists but cannot answer a query is exactly the
seeding artifact the gate must not mistake for churn. #80 asks that "`--verify`
should query, not merely list" — it already does, via a real `/api/ds/query`
round-trip. Running `--verify --compare` against `10.0.13` would have caught it.

The remaining five tags are covered by issue #23 / PR #80.

One observation worth recording rather than fixing: `operator_role` is `Viewer`,
not `Editor`. `ensureOperator` creates the user via `POST /api/admin/users`
without an org role, so Grafana applies its default. That is stable across all
three versions, which is what the fingerprint needs; whether the gate task
requires a more privileged operator is a question for the ADR-0006 task
definition, not for this harness.

## CI coverage

CI smokes **one pinned version** — Grafana `11.0.0` — on every pull request and
push to `main`, in the `testbed-smoke` job of
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). The job boots and
seeds on the runner's Docker daemon, asserts `/api/health` plus the presence of
the seed dashboard (`paragent-seed`) and datasource (`paragent-testdata`) via
`scripts/testbed/ci-smoke-assert.mjs`, then tears down in an `if: always()`
step. Job-level `timeout-minutes: 10` caps a hung image pull.

One version, not eight: pulling the whole matrix per PR costs minutes of CI and
gigabytes of transfer. **The full matrix belongs to the gate run, not per-PR
CI** — a green `testbed-smoke` proves the Docker + provisioning + seed path is
not broken, and says nothing about the other seven tags (see issue #23 for the
per-tag verification table).

Mirror the CI steps locally with:

```text
npm run testbed -- --version 11.0.0
node scripts/testbed/ci-smoke-assert.mjs --version 11.0.0
npm run testbed -- --version 11.0.0 --down
```

The assertion script is an interim stand-in for `--verify` (issue #57); once
that flag lands, the CI step should call it instead.

## Docker daemon limitation

This harness **ships** `docker-compose.yml` + seed HTTP client. If the local
(or CI) environment has no Docker daemon, `npm run testbed -- --version <X>`
exits non-zero after explaining the limitation; use `--dry-run` to prove the
plan path. Do not claim a seeded instance is up unless compose up + health +
seed succeeded.

## Open questions / what I could not verify

- Live pull + health for every matrix tag. `9.5.21`, `11.0.0` and `12.0.0` are
  verified end to end (boot → seed → health → seed objects → fingerprint) and
  produce identical seed state; `11.0.0` is additionally CI-smoked on every PR.
  The remaining five tags are unverified until issue #23 records the table.
- Whether the seed stays identical on `10.0.13`, `10.4.19`, `11.5.2`, `12.2.1`
  and `13.0.3`. `--verify --compare` now makes that a command rather than a
  judgement call, but the runs have not been done.
- Whether `queryable` is the right depth for the datasource check. It proves the
  plugin answers a `random_walk` query; it does not prove the returned frames are
  shaped identically across versions. Deeper comparison would need a stable
  response digest, and TestData's frame schema is not obviously stable enough for
  one — not attempted, and not needed until a gate task reads panel data.
- Whether B2 gate task (login + navigate) stays browser-meaningful once Grafana
  HTTP APIs cover the same clicks — Track-1 must pick tasks that still stress
  DOM locators, not only API-equivalent config.
- How far proxy results will generalize to Track-2 counterparty portals (unknown
  by design; do not invent a transfer metric).
