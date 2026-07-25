---
title: Roadmap — milestones, current state, and what is stubbed
doc_type: brief
status: accepted
owner: B0
created: 2026-07-25
updated: 2026-07-25
confidence: HIGH
supersedes: null
sources_verified: true
---

# Roadmap

**Read this before picking up any issue.** It says where the project actually is, what is real, what is a stub, and which milestone your work belongs to.

For the story of *how* the project got here — two vertical FAILs and the pivot — read
[README-narrative.md](./README-narrative.md) (~20 min). This document is the state, not the story.

**Last true:** 2026-07-25.

---

## The one sentence

Paragent records an agent's successful trajectory through a web UI, compiles it into a
deterministic script with a post-condition assertion on every step, replays it at near-zero
token cost, and repairs it with a model when an assertion fails.

Everything below exists to answer one question: **do compiled trajectories survive site churn?**
Track 2 (is there a vertical?) is **closed FAIL** — [ADR-0004](./decisions/ADR-0004-vertical-track2-fail.md).
There is no second question in flight.

---

## Where the code actually is

Six packages under `src/`, ~6,700 lines, `npm run ci` green. The shape is right; the
*measurement* has never run.

| Package | State | Honest assessment |
| --- | --- | --- |
| `src/testbed/` | Built | Compose + provisioning + HTTP seed for 8 pinned Grafana OSS tags. **Never run against a live Docker daemon.** Only `--dry-run` is verified. |
| `src/recorder/` | Built | Parameterised Playwright recording, literal-secret refusal, ranked locator candidates. **Only ever run against a static HTML fixture.** |
| `src/compiler/` | Built | Assertion synthesis, locator chains, fail-closed `pool_eligible`. **Only ever run against `contracts/examples/trajectory.example.json`.** |
| `src/cache/` | Partial | Write-time privacy boundary works and is canary-tested. **No read path, no persistence, no confidence update** — PRD §5.3's self-healing cache does not exist yet. |
| `src/runner/` | Partial | Replay loop, repair loop, frozen assertions, metric emission all real. **Repair model is `StubRepairModelClient`** — returns `corrected_action: null`, zero tokens, always. |
| `src/metrics/` | Built | PRD §9 aggregates that correctly report `no_data` on empty denominators. Four of five §9 secondary metrics computed; cache hit-rate missing. |
| `experiments/gate-v1/` | Partial | Report generator works. **`run-matrix.ts` exits 2 unless `--dry-run`**, and walks a one-element placeholder version list. |

### The four stubs that block the gate number

1. **No live testbed run.** ADR-0003's own open questions admit not every tag was pulled. → M1
2. **No real gate task.** The recorded task is 4 steps of login; PRD §8 wants 8–12 DOM-meaningful steps. → M2
3. **No real repair model.** Self-heal rate is structurally 0 and `cost_repair` is structurally zero tokens. → M3
4. **No fresh-reasoning baseline.** `cost_fresh` is always zeros, so the §9 kill line "repair cost ≥ 70% of fresh" has no denominator. → M3

---

## Milestones, in order

Work them in sequence. Each one's exit criterion is the next one's precondition.

| # | Milestone | Question it answers | Exit criterion |
| --- | --- | --- | --- |
| **M0** | Foundations: dev experience + governance | Can a fresh agent pick this up safely? | `npm run ci` proves the whole loop on fixtures; docs are machine-checked. Repo posture settled — [ADR-0005](./decisions/ADR-0005-repo-public.md), public. |
| **M1** | Live testbed on Docker | Does the version matrix actually boot and seed identically? | Every pinned tag boots+seeds green, or is documented as failing with a reason |
| **M2** | Real gate task: record + compile | Is there a task worth measuring? | A live 8–12 step trajectory, compiled, with a strength-audited assertion per step |
| **M3** | Live replay + real repair loop | Can it replay and heal, at a measured cost? | One real self-heal observed and logged with non-zero measured tokens |
| **M4** | Gate number: matrix run + §9 report | **Does the mechanism work?** | A gate-result memo with PASS / EXTEND / FAIL sourced only from measured rows |
| **M5** | Docs integrity + pitch honesty | Do the documents agree with each other? | INTEGRITY-AUDIT category D empty or each row adjudicated |
| **M6** | Founder kill/continue | Is there a company? | An ADR recording the decision |
| **M7** | Standing / counsel packet | What is the ToS exposure? | A sized brief — sized, not solved |

M5 and M7 can run in parallel with the engineering track. M0–M4 are strictly sequential.
M6 is blocked on M4 by definition.

---

## The gate, restated

From [PRD §9](./prd/PRD-trajectory-cache-v0.2.md). **These thresholds are *proposed*, not
accepted** — [INTEGRITY-AUDIT](./INTEGRITY-AUDIT.md) B-05 and D-03, and resolving that status
is issue #68.

- Step-validity ≥ 80% **and** task success (≤2 repairs) ≥ 90% → thesis holds
- Step-validity < ~50% **or** mean repair cost ≥ 70% of fresh → thesis is dead, stop before the raise
- In between → extend, add a second site, decide on data

The [pivot brief](./prd/pivot-brief-v0.3.md) §7 restates a single "~50%" kill line. Which
document controls when Track 1 reports is an open question that must be settled **before**
the memo is written.

**Version-bump churn is a proxy** for organic production churn — see
[testbed.md](./gate/testbed.md). Every number derived from the matrix inherits that asterisk.

---

## Rules that are not negotiable

From [CONTRIBUTING.md](../CONTRIBUTING.md), restated because they are the ones most likely
to be broken by someone moving fast:

1. **Never invent a metric.** Gate numbers and cost savings are `[PENDING TRACK-1]` until
   measured. Aggregates report `no_data` rather than a plausible-looking zero, and that is
   deliberate — do not "fix" it.
2. **No secrets ever.** Secret-scanning CI is merge-blocking, and so is the privacy canary.
   The repo is **public** ([ADR-0005](./decisions/ADR-0005-repo-public.md)), so this is the
   only line of defence — and everything you write in `docs/` is published.
3. **Assertions are frozen during repair.** A repair loop that can weaken its own check makes
   replay-validity self-fulfilling. `assertAssertionUnchanged` exists for this; do not route
   around it.
4. **Do not soften a finding.** Two FAILs are in this repo as assets. A third would be too.
5. **Document with the code, never after.** Update `docs/README.md` when you add a doc.

---

## Open questions / what I could not verify

- Whether all eight pinned Grafana tags pull and boot — the premise of M1, unverified as of
  this writing (ADR-0003 open questions).
- Whether the eventual gate task can be made mostly `strong`-assertable; if not, the §9
  number is softer than it looks and the memo must say so (issue #61).
- Which document controls the kill line — PRD §9's four-part gate or the pivot brief's single
  ~50% (issue #68).
- Whether to enable secret-scanning non-provider patterns and validity checks, both currently
  disabled — cheap defence in depth now that public exposure is permanent
  ([ADR-0005](./decisions/ADR-0005-repo-public.md)).
