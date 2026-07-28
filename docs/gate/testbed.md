---
title: Track-1 Grafana OSS test-bed
doc_type: spec
status: draft
owner: B1
created: 2026-07-25
updated: 2026-07-28
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

## Verified results — all 8 tags booted and seeded

`verified_on: 2026-07-27` · issue [#23](https://github.com/DevToolie/Paragent/issues/23) ·
Docker 29.1.3 (Docker Desktop, linux/amd64), 20 CPU / 8 GB, Windows 11 host.

**8 / 8 pulled, reached healthy, seeded, and tore down with no orphans.** One defect was found
and fixed (10.0.13 — see below); the table is the state **after** that fix. Digests are the
`RepoDigests[0]` actually pulled, so this run is reproducible by digest rather than by tag.

| Version | Pulled | Healthy | Seeded | Datasource **queryable** | Dashboard renders | Boot | Image | Digest (`sha256:`) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 9.5.21 | yes | yes | yes | yes (`testdata`) | yes | 27 s | 92 MB | `ec106c7d446c88377f9d6c4cd363361b5846c361a28f5669d1b5e92926d94891` |
| 10.0.13 | yes | yes | yes | yes (`testdata`) — **was 404 before the fix** | yes | 22 s | 95 MB | `c5606a0570624ddf6a131ee0a065681bef95088485fc77d74aa849a3253c465f` |
| 10.4.19 | yes | yes | yes | yes (`grafana-testdata-datasource`) | yes | 23 s | 126 MB | `a9043254ba16fb10945cc27333963dfd08eccbb43b51f1222d831cc564e3a1f4` |
| 11.0.0 | yes | yes | yes | yes (`grafana-testdata-datasource`) | yes | 22 s | 121 MB | `0dc5a246ab16bb2c38a349fb588174e832b4c6c2db0981d0c3e6cd774ba66a54` |
| 11.5.2 | yes | yes | yes | yes (`grafana-testdata-datasource`) | yes | 38 s | 151 MB | `8b37a2f028f164ce7b9889e1765b9d6ee23fec80f871d156fbf436d6198d32b7` |
| 12.0.0 | yes | yes | yes | yes (`grafana-testdata-datasource`) | yes | 33 s | 187 MB | `263cbefd5d9b179893c47c415daab4da5c1f3d6770154741eca4f45c81119884` |
| 12.2.1 | yes | yes | yes | yes (`grafana-testdata-datasource`) | yes | 32 s | 204 MB | `35c41e0fd0295f5d0ee5db7e780cf33506abfaf47686196f825364889dee878b` |
| 13.0.3 | yes | yes | yes | yes (`grafana-testdata-datasource`) | yes — **behind a first-run modal** | 48 s | 352 MB | `1a345428a36270f5fb9add69fea71450a5843c15266c99359d6d380470ab19c9` |

No version is `unavailable`; `matrix.json` needs no `status` / `reason` row.

### The defect: presence is not the same as queryable

`testdataTypeFor()` used `major < 10` to pick the TestData plugin id. **The rename actually
landed in 10.2.0**, so 10.0.13 was provisioned with `grafana-testdata-datasource`, which that
image does not ship. Grafana accepted the datasource and **listed it happily** — then failed
every query with `{"messageId":"plugin.notRegistered","statusCode":404}`, and both seed panels
rendered "No data" behind an error badge.

Nothing in the tree could see this. `scripts/testbed/ci-smoke-assert.mjs` asserts the datasource
**exists**; `tests/unit/testbed.test.ts` asserted `10.0.13 → grafana-testdata-datasource`, i.e.
the test encoded the bug. Only issuing a query against the datasource exposes it.

Boundary measured by reading the plugin id straight out of each image:

```bash
docker run --rm --entrypoint sh grafana/grafana:<tag> \
  -c 'ls /usr/share/grafana/public/app/plugins/datasource/ | grep testdata'
```

| 9.5.21 | 10.0.13 | 10.1.0 | 10.2.0 | 10.3.0 | 10.4.19 | 11.x–13.x |
| --- | --- | --- | --- | --- | --- | --- |
| `testdata` | `testdata` | `testdata` | `grafana-testdata-datasource` | `grafana-testdata-datasource` | `grafana-testdata-datasource` | `grafana-testdata-datasource` |

10.1.0 / 10.2.0 / 10.3.0 are not matrix pins — they were pulled only to bracket the flip, and
removed afterwards.

The boundary was independently reproduced during review of
[#80](https://github.com/DevToolie/Paragent/pull/80) on macOS / arm64 — a host sharing no
architecture, daemon or OS with the run above — including the pre-fix 404 on 10.0.13.

### The failure is asymmetric: guessing new-side is fatal, guessing old-side is currently free

The rename is **not** a clean cut-over, and this matters more than the boundary itself.
`grafana-testdata-datasource/plugin.json` declares `"aliasIDs": ["testdata"]` on 10.2.0, 11.0.0,
12.0.0 and 13.0.3 — every post-rename pin including the tip. Provisioning the seed datasource as
`type: testdata` on 11.0.0 therefore works: Grafana resolves the alias, normalizes the type to
`grafana-testdata-datasource` on read, and `/api/ds/query` returns 200 with data. There is no
alias in the other direction — 9.5.21 ships no `grafana-testdata-datasource` directory at all,
which is exactly the 10.0.13 failure above.

So:

| Provisioned id | On pre-10.2 Grafana | On 10.2+ Grafana |
| --- | --- | --- |
| `testdata` | works | works — resolved via `aliasIDs` |
| `grafana-testdata-datasource` | **listed, then 404s every query** | works |

Two consequences. First, `10` treated as `10.0` in `testdataTypeFor()` is the safe default for a
concrete reason, not a hunch: an under-guess costs nothing today, an over-guess is silent
breakage. Second, the version-boundary branch is a **choice, not a requirement** — `testdata`
alone would satisfy all eight pins as they stand. It is kept because `aliasIDs` is undocumented
surface a future major can drop, and because provisioning the id the image actually ships is the
more honest description of the test-bed. If that alias ever disappears the branch is what saves
the new majors; until then it saves nothing, and that is worth knowing before someone "simplifies"
it away in either direction.

The alias evidence comes from the #80 review host (macOS / arm64), not from the 2026-07-27 run;
it has not been re-read on this machine.

### Per-version observations for B2

Recorded because they are surface churn the recorder will meet, not defects:

- **13.0.3 opens a first-run "Grafana Assistant is now available to OSS users" modal** over the
  dashboard on a fresh container. Panels render behind it. Nothing persists user preferences
  (no volume), so it appears on **every** boot. Any recorded 13.0.3 trajectory has to dismiss
  it, and a Playwright visibility check will not notice the occlusion — `isVisible()` is not
  occlusion-aware.
- **12.0.0** decorates the Drilldown nav item with a `New!` badge; **12.x/13.x** replace the
  burger-menu nav with a docked sidebar. Expect locator churn across the 11 → 12 boundary.
- **9.5.21** raises a `DashboardQueryRunner failed / Failed to fetch` toast on the dashboard.
  It is the annotation / alert-state runner, not the panel queries — panels render data
  normally. The container has no outbound network, which also makes the Grafana update check
  time out after 10 s on every boot.
- **Every version** logs `ensureDatasource update: 403 {"message":"Cannot update read-only data
  source"}` during seeding. The provisioned datasource is `editable: false`, so the seed's
  redundant `PUT` in [`src/testbed/seed.ts`](../../src/testbed/seed.ts) is refused; provisioning
  already created it correctly and the seed proceeds. Cosmetic noise, out of scope for #23 and
  still present — the deferral originally pointed at #77 as the in-flight owner of the seed
  path, and #77 has since merged without touching it. Reproduced again on the #80 review host,
  so it is a property of the seed, not of one machine.

### How this was verified

Per version: `npm run testbed -- --version <X>` → six checks → `--down`. The checks were
`/login` renders; fixture admin authenticates; datasource `paragent-testdata` present with the
expected plugin type; `/api/plugins?type=datasource` registers that type; **`POST /api/ds/query`
returns data points**; dashboard `paragent-seed` present with its panels; and the dashboard page
opened in Chromium with both panels rendering, checked against a screenshot per version.

Teardown was exercised twice back to back on 11.0.0; `docker ps -a`, `docker volume ls` and
`docker network ls` showed zero `paragent-*` leftovers and zero dangling volumes.

One caveat on method: an early run recorded 9.5.21 as failing with SQLite `database is locked`
during dashboard provisioning. That reproduced only while eight image pulls were saturating
disk I/O; on a quiet machine 9.5.21 boots in 27 s. It is recorded here as an environment
sensitivity, **not** a property of the tag — a slow or contended disk can make provisioning lose
the SQLite lock and the container exit 1. Retry before concluding a tag is broken.

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
npm run testbed -- --version 11.0.0 --ready-timeout 180
npm run testbed -- --version 11.0.0 --down
```

`--dry-run` prepares the provisioning overlay and prints the compose plan and the
readiness plan, without requiring a Docker daemon and without making any network
call.

## Readiness gate (`--ready-timeout`)

Between `docker compose up --wait` and the HTTP seed, the harness polls the API
from the host until it is actually serving.

**Readiness signal:** `GET /api/health` returning HTTP 200 with a JSON body whose
`database` field is `"ok"`. Stable across the whole matrix range.
Source: <https://grafana.com/docs/grafana/latest/developers/http_api/other/#returns-health-information-about-grafana>
— access_date: 2026-07-26.

| Setting | Value |
| --- | --- |
| Poll interval | 1s fixed |
| Default budget | 120s, override with `--ready-timeout <seconds>` |
| On success | prints elapsed time and probe count, then seeds |
| On timeout | exit 1 with version, URL, elapsed, last status/error, and the last 20 lines of `docker compose logs` (credential-shaped strings redacted) |

The predicate parses the body rather than grepping it. A 200 with
`database: "failing"` is a *running* Grafana that cannot serve, and a substring
test for `ok` on the raw body can pass on an unrelated field. `seed.ts`'s own
defensive `waitForHealth` shares this predicate — two definitions of "ready" in
one package is how they drift apart.

**Why 120s.** Measured worst case so far is ~18s for a cold `11.0.0` pull plus
boot locally and 14s for pull+boot+seed on a GitHub `ubuntu-latest` runner (the
`testbed-smoke` CI job). 120s is roughly 8× that headroom — enough for a slow
runner or a larger image, short enough not to mask a genuinely dead instance, and
well inside the CI job's 10-minute ceiling.

### What this gate does and does not fix

Verified 2026-07-26: on this fixture, `--ready-timeout 1` on a **fresh** boot
still succeeds. `docker compose up --wait` blocks until the container's own
healthcheck passes, and that healthcheck already curls `/api/health` *inside* the
container (see `scripts/testbed/docker-compose.yml`), so by the time compose
returns the API is normally serving. The cold-pull race the gate was written for
could not be reproduced locally.

It is still worth having, for reasons that are not the original one:

- It polls **through the host port mapping**, which is what the seed, recorder
  and runner actually use. A container can be healthy on its internal port while
  the published port does not serve; `--wait` cannot see that, and the seed would
  fail as a bare `fetch failed`.
- The container healthcheck greps for `ok` loosely; this gate parses the body.
- It fails with a diagnostic instead of an opaque fetch error.
- It does not depend on the compose healthcheck continuing to exist or stay
  strict — a fixture edit that weakens it would silently remove the only
  readiness check the harness had.

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
| Datasource | `uid`, `name`, `queryable` (a real `/api/ds/query` round-trip — **and a hard gate**) |
| Dashboard `paragent-seed` | `uid`, `title`, `panel_count`, sorted `panels[]` of title + type |
| Users | `operator_present`, `operator_role` |

### `queryable` is a gate, not a field to read

A datasource that lists but answers nothing is the whole 10.0.13 defect above, and printing
`queryable=false` next to exit 0 would rebuild the blindness one level up: a `--verify` that
passes over a broken instance is a presence check wearing a query's clothes. So a non-200 from
`POST /api/ds/query` raises `VerifyError` — `--verify` exits 1, and no fingerprint is written,
which also stops a broken instance becoming a baseline that `--compare` cheerfully matches
against an equally broken one. The error names the datasource type it found and points at the
10.2.0 boundary, because that is the cause nine times out of ten.

Consequence: `datasource.queryable` is `true` in every fingerprint written from this build. It
stays in the schema because fingerprints are files that outlive the code that wrote them, and
`--compare` still has to read a `false` recorded before the gate existed.

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
seeding artifact the gate must not mistake for churn. `--verify` already issued a
real `/api/ds/query` round-trip when this result was recorded, but it *reported*
the answer and exited 0 — against a pre-fix `10.0.13` it would have printed
`queryable=false` and called that a pass, so only `--compare` against a healthy
tag could have caught it. #80 closes that: a datasource that does not answer is
now a `VerifyError`, and bare `--verify` fails on it.

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

The assertion script is an interim stand-in for `--verify` (issue #57), and it is
a **presence** check — the kind that could not see the 10.0.13 defect above.
`--verify` has landed (#76) and now fails on a datasource that does not answer,
so the CI step should call it instead; until it does, `testbed-smoke` proves the
seed objects exist and not that they work.

## Docker daemon limitation

This harness **ships** `docker-compose.yml` + seed HTTP client. If the local
(or CI) environment has no Docker daemon, `npm run testbed -- --version <X>`
exits non-zero after explaining the limitation; use `--dry-run` to prove the
plan path. Do not claim a seeded instance is up unless compose up + health +
seed succeeded.

## Open questions / what I could not verify

- Live pull + health for every matrix tag. **Boot + seed + render is closed for all eight tags
  by #23 (2026-07-27)** — see the results table above; `9.5.21`, `11.0.0` and `12.0.0` are
  additionally verified to the *fingerprint* level (boot → seed → health → seed objects →
  fingerprint) and produce identical seed state, and `11.0.0` is CI-smoked on every PR. Still
  open: the same tags pulling and booting on a **GitHub-hosted runner** (the #23 run was one
  Windows / Docker Desktop host), and whether the tags still resolve at some later date — the
  digests are recorded so drift is at least detectable.
- Whether the seed stays identical on `10.0.13`, `10.4.19`, `11.5.2`, `12.2.1`
  and `13.0.3`. `--verify --compare` now makes that a command rather than a
  judgement call, but the runs have not been done. #23 establishes that these
  tags boot and seed, not that their fingerprints match.
- Whether the cold-pull readiness race the gate guards against is real on a slow
  CI runner. It could not be reproduced locally, because compose `--wait` already
  gates on a healthcheck that polls `/api/health` inside the container. The gate
  is cheap and its diagnostic is the actual payoff, but its original motivation
  remains unobserved rather than confirmed.
- Whether `queryable` is the right depth for the datasource check. It proves the
  plugin answers a `random_walk` query; it does not prove the returned frames are
  shaped identically across versions. Deeper comparison would need a stable
  response digest, and TestData's frame schema is not obviously stable enough for
  one — not attempted, and not needed until a gate task reads panel data.
- Whether the `paragent-seed` dashboard keeps rendering as majors advance past 13.0.3. It does
  today on every pinned tag, but the seed uses only `timeseries` + `stat`.
- Whether the 13.0.3 first-run Assistant modal can be suppressed by a `GF_*` env var rather
  than dismissed per recording. Not searched; the recorder can dismiss it either way.
- How long the `testdata` → `grafana-testdata-datasource` alias survives. It is what makes the
  old id work on new majors (see the asymmetry note above), and it is undocumented surface a
  future major can drop without ceremony. Nothing here watches for that; the per-image `ls`
  above is the only check, and it is manual.
- Whether B2 gate task (login + navigate) stays browser-meaningful once Grafana
  HTTP APIs cover the same clicks — Track-1 must pick tasks that still stress
  DOM locators, not only API-equivalent config.
- How far proxy results will generalize to Track-2 counterparty portals (unknown
  by design; do not invent a transfer metric).
