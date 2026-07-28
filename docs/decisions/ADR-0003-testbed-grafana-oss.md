---
title: "ADR-0003 — Track-1 test-bed = Grafana OSS"
doc_type: adr
status: accepted
owner: B1
created: 2026-07-25
updated: 2026-07-28
confidence: HIGH
supersedes: null
sources_verified: true
---

# ADR-0003 — Track-1 test-bed = Grafana OSS

## Status

accepted

## Context

**Triggered by:** [pivot-brief-v0.3.md](../prd/pivot-brief-v0.3.md) Track 1 —
measure churn survival without a design partner or third-party SaaS ToS (Week-0
A6 already HIGH for Datadog/Grafana Cloud consoles).

Track-1 needs a **self-hosted** console where we can pin Docker image tags per
released version, seed deterministic state, and treat version upgrades as
**accelerated UI churn** for trajectory survival experiments.

Criteria (must all hold):

1. Genuine DOM complexity (dynamic panels, modals, async validation, rich nav).
2. A published Docker image per released version (or close equivalent).
3. Meaningful UI change across majors (not only patch-level polish).
4. Seedable state (provisioning and/or HTTP API).

Candidates evaluated: Grafana OSS, self-hosted Sentry, Keycloak admin console,
Metabase.

## Options considered

### A — Grafana OSS (chosen)

Honest case for:

- Official image `grafana/grafana` publishes version tags on Docker Hub
  ([tags](https://hub.docker.com/r/grafana/grafana/tags) — access_date:
  2026-07-25).
- Releases span real navigation / dashboard / Scenes redesigns (see matrix
  `churn_role` notes and Grafana "What's new" docs, e.g.
  [v10](https://grafana.com/docs/grafana/latest/whatsnew/whats-new-in-v10-0/),
  [v11](https://grafana.com/docs/grafana/latest/whatsnew/whats-new-in-v11-0/),
  [v12](https://grafana.com/docs/grafana/latest/whatsnew/whats-new-in-v12-0/) —
  access_date: 2026-07-25).
- File provisioning for datasources/dashboards is documented
  ([provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
  — access_date: 2026-07-25); Docker install path is documented
  ([Docker](https://grafana.com/docs/grafana/latest/setup-grafana/installation/docker/)
  — access_date: 2026-07-25).
- Built-in TestData datasource needs no external DB
  ([TestData](https://grafana.com/docs/grafana/latest/datasources/testdata/configure/)
  — access_date: 2026-07-25).

Honest case against: Grafana is not a "counterparty portal"; it is an OSS
proxy for churn mechanics only. Week-0 already killed SaaS observability as a
commercial anchor — Track-1 still needs *some* complex UI to measure script
survival.

### B — Self-hosted Sentry (runner-up)

Honest case for: rich issue UI; Docker images exist
([getsentry/sentry](https://hub.docker.com/r/getsentry/sentry) — access_date:
2026-07-25); GitHub releases at
[getsentry/sentry](https://github.com/getsentry/sentry/releases) — access_date:
2026-07-25.

Honest case against: self-hosted stack is multi-service (web, worker, Redis,
Postgres, Kafka/Snuba depending on era). Seed cost and version-to-version
compose drift are higher than Grafana's single-container smoke path for a
five-day gate. CONFIDENCE: MED that a thin single-container path stays
representative.

### C — Keycloak admin console (runner-up)

Honest case for: complex admin UI; Quay/Docker tags for Keycloak
([quay.io/keycloak/keycloak](https://quay.io/repository/keycloak/keycloak?tab=tags)
— access_date: 2026-07-25); GitHub
[keycloak/keycloak](https://github.com/keycloak/keycloak/releases) —
access_date: 2026-07-25.

Honest case against: admin console is tightly coupled to realm/IdP concepts;
seed data is realm JSON import rather than "dashboard + panel" tasks that map
cleanly to recorder demos. UI still valuable later if Track-2 picks IAM-adjacent
surfaces.

### D — Metabase (runner-up)

Honest case for: question/dashboard UI; Docker Hub
[metabase/metabase](https://hub.docker.com/r/metabase/metabase/tags) —
access_date: 2026-07-25; GitHub
[metabase/metabase](https://github.com/metabase/metabase/releases) —
access_date: 2026-07-25.

Honest case against: meaningful seed usually wants a backed SQL database and
sample questions; more moving parts for the first matrix than Grafana +
TestData.

## Decision

**Track-1 test-bed target = Grafana OSS** (`grafana/grafana`), with a pinned
version matrix under `scripts/testbed/matrix.json` (8 tags from 9.5.21 through
13.0.3) and harness CLI `npm run testbed -- --version <X>`.

## Consequences

Easy: one-container compose; provisioning overlay; HTTP seed for operator user;
B2–B4 can assume `site_key` style identity around Grafana URLs on localhost.

Hard: TestData plugin type id changes across majors (`testdata` vs
`grafana-testdata-datasource`) — harness rewrites overlay per version. The boundary is
**10.2.0**, measured per image in #23; it was originally guessed as 10.0 and that guess broke
10.0.13 silently. The rename is not a clean cut-over: post-10.2 images alias the old id
(`aliasIDs: ["testdata"]`, present through 13.0.3) while pre-10.2 images have no reverse alias,
so the old id works everywhere today and the new id is fatal below 10.2. Rewriting per version
is therefore the honest description of the images rather than a hard requirement — see the open
questions below.

Forecloses (for now): Sentry/Keycloak/Metabase as the *primary* Track-1 matrix.
They remain documented runners-up if Grafana proves too API-friendly for the
gate tasks we invent.

## Reversal cost

**Moderate.** Signal to reverse: Grafana gate tasks turn out to be fully
HTTP-API automatable in a way that makes browser churn measurement vacuous, or
Docker Hub tags for needed majors disappear. Reversal means picking a runner-up
and rewriting seed + matrix; contracts stay unchanged.

## Open questions / what I could not verify

- ~~Whether every matrix tag still pulls cleanly~~ — **all eight pulled, booted, seeded and
  rendered on 2026-07-27** (issue [#23](https://github.com/DevToolie/Paragent/issues/23); table
  and digests in [gate/testbed.md](../gate/testbed.md)). Still open: **on all CI runners.** That
  run was one Windows / Docker Desktop host; only `11.0.0` has ever booted on a GitHub-hosted
  runner, via the `testbed-smoke` job.
- ~~Exact Grafana major where the TestData plugin id flipped~~ — **answered: 10.2.0**, not 10.0.
  Measured by reading `/usr/share/grafana/public/app/plugins/datasource/` out of each image:
  9.5.21, 10.0.13 and 10.1.0 ship `testdata`; 10.2.0 onward ship
  `grafana-testdata-datasource`. The harness's `major < 10` rule therefore broke **10.0.13** —
  Grafana listed the provisioned datasource and then 404'd every query with
  `plugin.notRegistered`. Fixed in `testdataTypeFor()`; CONFIDENCE now HIGH, measured rather
  than inferred. The consequence recorded above ("harness rewrites overlay per version") was
  right in shape and wrong in boundary. Both the boundary and the pre-fix 404 were reproduced
  independently on macOS / arm64 during review of #80.
- **New, and open:** how long `aliasIDs` keeps the old plugin id working. Post-10.2 images
  declare `"aliasIDs": ["testdata"]` through 13.0.3, so `testdata` alone would satisfy all eight
  pins today — the version branch buys nothing *right now* and everything if a future major drops
  the alias. Nothing watches for that drop; the only check is reading the plugin directory out of
  a new image by hand. Read off the #80 review host, not re-measured here.
- Whether Angular-panel removal in v12 breaks the seed dashboard for older
  panel types we might add later (current seed uses timeseries + stat). The
  current seed renders on all eight tags, so this stays open only for panel
  types not yet used.
- ~~Whether a *presence* check is ever sufficient to call a version verified.~~ **Answered: no.**
  The 10.0.13 defect was invisible to both `ci-smoke-assert.mjs` and the unit test because both
  asked "does the datasource exist" rather than "does it answer a query". `--verify` (issue #57,
  shipped in #76) already issues `POST /api/ds/query`; as of #23 a non-answering datasource is a
  `VerifyError` rather than a `queryable=false` line printed alongside exit 0. Still open:
  `scripts/testbed/ci-smoke-assert.mjs`, which the CI smoke job still calls, remains a presence
  check — the CI step should call `--verify` instead, as `gate/testbed.md` already notes.
