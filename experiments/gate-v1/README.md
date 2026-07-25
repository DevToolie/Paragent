---
title: Gate-v1 experiment harness (throwaway)
doc_type: runbook
status: draft
owner: B4
created: 2026-07-24
updated: 2026-07-25
confidence: MED
supersedes: null
sources_verified: true
---

# experiments/gate-v1/

**Throwaway.** Week-gate harness only — do not promote into a product API.

## Contents

| Path | Role |
| --- | --- |
| `versions.json` | Pluggable version matrix (prefer B1 `scripts/testbed/matrix.json` when wired) |
| `fixtures/compiled-program.json` | 2-step local demo program |
| `fixtures/local-demo.html` | Static page for future live runs |
| `trajectories/` | B2 recorded trajectories (fixture gate task) |
| `run-matrix.ts` | Matrix CLI (`--dry-run` required for now) |
| `report/generate-amortized.ts` | SVG/CSV/HTML/JSON from NDJSON (`writeReport`) |
| `out/` | Generated metrics + reports (gitignored) |

## Commands

```bash
npm run gate:matrix -- --dry-run
npm run gate:report
npm run recorder -- --fixture
```

Dry-run emits zero-token step/run rows under `experiments/gate-v1/out/metrics.ndjson`.
Live runs exit **2** until B1 pins and Playwright live wiring land.

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

- Wire `versions.json` to ADR-0003 / `scripts/testbed/matrix.json` pins.
- Fresh-reasoning baseline cost measurement path — not wired; `cost_fresh` stays zeros until measured.
- Live matrix against Grafana OSS — needs Docker + `--base-url` recording.
