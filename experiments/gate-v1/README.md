---
title: Gate-v1 experiment harness (throwaway)
doc_type: runbook
status: draft
owner: B4
created: 2026-07-24
updated: 2026-07-29
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
| `fixtures/local-demo.html` | Static page for the local-demo program |
| `live-run.ts` | Per-version live driver: bring-up, browser, replay, teardown (#62) |
| `trajectories/` | B2 recorded trajectories (fixture gate task) |
| `run-matrix.ts` | Matrix CLI — live by default, `--dry-run` for the no-Docker path |
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
npm run gate:matrix                                       # LIVE, every available pin
npm run gate:matrix -- --versions 9.5.21 --headed         # one version, watch it
npm run gate:matrix -- --dry-run                          # no Docker, no browser
npm run gate:matrix -- --dry-run --versions 11.0.0,12.0.0 # a subset
npm run gate:report
npm run recorder -- --fixture
```

Since [#62](https://github.com/DevToolie/Paragent/issues/62) the **default is a live run**: one
seeded container per version, a real browser, real step outcomes. `--dry-run` is kept because it
exercises the harness without Docker and the CI job depends on it.

| Flag | Effect |
| --- | --- |
| `--dry-run` | No Docker, no browser. Hard-coded `PASS`, zero tokens, rows labelled not-a-measurement |
| `--versions <list>` | Comma-separated ids, or `all` (default) |
| `--program <path>` | A `CompiledProgram` **or** a `compiled_trajectory` bundle from `artifacts/compiled/` |
| `--param k=v` | Bind one of the program's own `param_refs`. Repeatable |
| `--port <n>` | Host port for the test-bed (default 3000) |
| `--headed` | Show the browser |
| `--keep-up` | Leave each container running for inspection |
| `--no-preamble` | Skip the login preamble, for programs that log in as a measured step |

`base_url`, `host` and `port` are bound by the driver and cannot be overridden by `--param`: a
program must not be able to redirect itself away from the version being measured. Every other
hole the program declares is the caller's to supply — inventing a default would silently
substitute a value the recording never used.

Unknown ids are rejected with the valid list, never defaulted:

```text
gate:matrix: unknown version id(s): 99.0.0
valid ids (scripts/testbed/matrix.json): 9.5.21, 10.0.13, 10.4.19, 11.0.0, 11.5.2, 12.0.0, 12.2.1, 13.0.3
```

Exit codes: **2** for a usage error, an unknown id, or a live run with no Docker daemon; **1** if
the run measured zero versions — an empty NDJSON is a missing denominator, not a successful run.

### `out/matrix-run.json` — the skip ledger

Written every run beside the NDJSON. Records `mode`, the selection, `versions_in_matrix`,
`versions_walked`, `state_baseline_version`, and `versions_skipped[] {id, stage, reason}`.
Without it a later reader cannot tell "8 pins, 3 unavailable" from "5 pins", and the denominator
shrinks silently.

**A skip is not a failure.** A version whose container never started, whose image would not pull,
whose login broke, or whose seed state differs from the base version produced *no measurement*.
It is recorded with the stage it died at and never reaches the NDJSON. The stages are
`compose-up`, `readiness`, `seed`, `fingerprint`, `browser`, `login-preamble`.

The ledger also carries the pre-repair outcome per step, which the NDJSON cannot:

```json
{"step": 1, "outcome": "REPAIR_EXHAUSTED", "first_pass": "LOCATOR_NOT_FOUND"}
```

Every genuine failure ends as `REPAIR_EXHAUSTED` in the metric row, because stub repair always
proposes `null` and `contracts/metrics.schema.json` has no field for a reason. See
[gate/runner.md](../../docs/gate/runner.md) — it is a workaround, not a fix.

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
  `versions.json` is deleted and the harness reads the pins directly. Walking eight versions
  makes the row count honest; #62 then made the rows real. Neither makes the *numbers*
  meaningful — that needs a gate-task program (#25) and repeat runs (#66).
- The program under test is still `fixtures/compiled-program.json`, whose own
  `testbed_version` reads `pending-b1@placeholder` because it was compiled against no testbed at
  all. That is accurate and left alone; the runner overrides it per version.
- Fresh-reasoning baseline cost measurement path — not wired; `cost_fresh` stays zeros until measured.
- ~~Live matrix against Grafana OSS.~~ **Done (#62)** — `npm run gate:matrix` brings up each pin,
  drives Chromium, and emits real outcomes. What it does **not** yet establish: a *meaningful*
  number. The only Grafana-targeted bundle on `main` is a compile of a hand-written example, and
  its step-0 assertion (`getByRole("form")`) matches zero elements on real Grafana — an unnamed
  `<form>` has no ARIA role. The driver reported that honestly on its first live run, which is
  the harness working, not the gate measuring. The gate task bundle arrives with
  [#25](https://github.com/DevToolie/Paragent/issues/25).
- **One run per version is not a sample.** §9 asks for ≥42 runs and ≥400 step-executions; eight
  versions × one run is neither, and nothing here can yet separate churn from flakiness.
  [#66](https://github.com/DevToolie/Paragent/issues/66) is where `--runs` and per-version
  variance land — and it needed this driver first, because repeat runs of a dry run all produce
  the same hard-coded row.
- Whether a metric row should carry the pre-repair outcome. Today it cannot, so the ledger holds
  it instead; see [gate/runner.md](../../docs/gate/runner.md).
