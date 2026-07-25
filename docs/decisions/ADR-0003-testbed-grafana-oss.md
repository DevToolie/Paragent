---
title: "ADR-0003 — Track-1 test-bed = Grafana OSS"
doc_type: adr
status: accepted
owner: B1
created: 2026-07-25
updated: 2026-07-25
confidence: HIGH
supersedes: null
sources_verified: true
---

# ADR-0003 — Track-1 test-bed = Grafana OSS

## Status

accepted

## Context

Track-1 needs a **self-hosted** console where we can pin Docker image tags per
released version, seed deterministic state, and treat version upgrades as
**accelerated UI churn** for trajectory survival experiments. No third-party
SaaS ToS, no design partner required.

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
`grafana-testdata-datasource`) — harness rewrites overlay per version.

Forecloses (for now): Sentry/Keycloak/Metabase as the *primary* Track-1 matrix.
They remain documented runners-up if Grafana proves too API-friendly for the
gate tasks we invent.

## Reversal cost

**Moderate.** Signal to reverse: Grafana gate tasks turn out to be fully
HTTP-API automatable in a way that makes browser churn measurement vacuous, or
Docker Hub tags for needed majors disappear. Reversal means picking a runner-up
and rewriting seed + matrix; contracts stay unchanged.

## Open questions / what I could not verify

- Whether every matrix tag still pulls cleanly on all CI runners (tags cited
  from Docker Hub / GitHub on 2026-07-25; not every tag was pulled in this
  environment).
- Exact Grafana major where TestData plugin id flipped for *all* install paths
  (harness uses major &lt; 10 → `testdata`, else `grafana-testdata-datasource`;
  CONFIDENCE: MED pending live pull of 9.5.21 + 10.0.13).
- Whether Angular-panel removal in v12 breaks the seed dashboard for older
  panel types we might add later (current seed uses timeseries + stat).
