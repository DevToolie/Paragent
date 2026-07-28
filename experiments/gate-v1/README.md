---
title: Gate-v1 experiment harness (throwaway)
doc_type: runbook
status: draft
owner: B4
created: 2026-07-24
updated: 2026-07-27
confidence: MED
supersedes: null
sources_verified: true
---

# experiments/gate-v1/

**Throwaway.** Week-gate harness only — do not promote into a product API.

## Contents

| Path | Role |
| --- | --- |
| `fixtures/compiled-program.json` | 2-step local demo program |
| `fixtures/local-demo.html` | Static page for future live runs |
| `trajectories/` | B2 recorded trajectories (fixture gate task) |
| `run-matrix.ts` | Matrix CLI (`--dry-run` required for now) |
| `report/generate-amortized.ts` | SVG/CSV/HTML/JSON from NDJSON (`writeReport`) |
| `out/` | Generated metrics + reports (gitignored) |

## The version list

[`scripts/testbed/matrix.json`](../../scripts/testbed/matrix.json) — the ADR-0003 pins — is the
**only** version list, read through `src/testbed/matrix.ts`. This directory used to carry its
own `versions.json` holding a single `pending-b1@placeholder` entry, so every report generated
here was a report about nothing. It was deleted in
[#26](https://github.com/DevToolie/Paragent/issues/26) rather than kept in sync: two lists for
one thing drift, and its only non-duplicated fields (`site_key` / `task_key` overrides) were
actively misleading — they relabelled the local-demo program per version as if a Grafana run had
happened.

Consequently **only `testbed_version` varies per run.** `site_key` and `task_key` stay whatever
the compiled program actually is.

A version marked `"status": "unavailable"` in `matrix.json` is **skipped and recorded**, never
silently dropped — see `out/matrix-run.json`.

## Commands

```bash
npm run gate:matrix -- --dry-run                          # every available pin
npm run gate:matrix -- --dry-run --versions 11.0.0,12.0.0 # a subset
npm run gate:matrix -- --dry-run --versions all           # explicit default
npm run gate:report
npm run recorder -- --fixture
```

Unknown ids are rejected with the valid list, never defaulted:

```text
gate:matrix: unknown version id(s): 99.0.0
valid ids (scripts/testbed/matrix.json): 9.5.21, 10.0.13, 10.4.19, 11.0.0, 11.5.2, 12.0.0, 12.2.1, 13.0.3
```

Dry-run emits zero-token step/run rows under `experiments/gate-v1/out/metrics.ndjson`, one run
row per version walked, each labelled `dry-run — tokens remain 0; not a gate measurement`.
Live runs exit **2** until Playwright live wiring lands ([#62](https://github.com/DevToolie/Paragent/issues/62)).

Exit codes: **2** for a usage error or a live-run attempt; **1** if the selection walked zero
versions — an empty NDJSON is a missing denominator, not a successful run.

### `out/matrix-run.json` — the skip ledger

Written every run beside the NDJSON. Records the selection, `versions_in_matrix`,
`versions_walked`, and `versions_skipped[] {id, reason}`. Without it a later reader cannot tell
"8 pins, 3 unavailable" from "5 pins", and the denominator shrinks silently.

Report paths (after `gate:report`):

- `experiments/gate-v1/out/report/report.json`
- `experiments/gate-v1/out/report/report.csv`
- `experiments/gate-v1/out/report/report.html`
- `experiments/gate-v1/out/report/amortized.svg`

Empty NDJSON → scaffold with `status: no_data` and null values (never invented rates).

## Sources

| Claim | Source | Access date |
| --- | --- | --- |
| §9 measurable fields | `contracts/metrics.schema.json` | 2026-07-24 |
| Runner emits step/run rows | `docs/gate/runner.md` | 2026-07-24 |
| Fixture trajectory | `docs/gate/recorder.md` | 2026-07-25 |

## Open questions / what I could not verify

- ~~Wire `versions.json` to ADR-0003 / `scripts/testbed/matrix.json` pins.~~ **Done (#26)** —
  `versions.json` is deleted and the harness reads the pins directly. What this does **not**
  change: the run is still a dry run over a hand-written 2-step local-demo program, so walking
  eight versions instead of one makes the row count honest, not the numbers meaningful.
- The program under test is still `fixtures/compiled-program.json`, whose own
  `testbed_version` reads `pending-b1@placeholder` because it was compiled against no testbed at
  all. That is accurate and left alone; the runner overrides it per version.
- Fresh-reasoning baseline cost measurement path — not wired; `cost_fresh` stays zeros until measured.
- Live matrix against Grafana OSS — needs Docker + `--base-url` recording ([#62](https://github.com/DevToolie/Paragent/issues/62)).
