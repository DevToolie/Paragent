---
title: Documentation integrity audit (Wave 3 / D2)
doc_type: brief
status: draft
owner: D2
created: 2026-07-25
updated: 2026-08-14
confidence: HIGH
supersedes: null
sources_verified: true
---

# INTEGRITY-AUDIT

D2 consolidator pass (2026-07-25), **after** C4 + C5 merges. **Surfaces conflicts; does not pick a side** except where a later accepted adjudicator already ruled (noted explicitly).

**Category counts:**

| Category | Count |
| --- | --- |
| A. Unsourced / under-sourced claims | 11 |
| B. Placeholder / unmeasured metrics | 8 |
| C. LOW-confidence findings load-bearing in a decision | 6 |
| D. Document disagreements (5 resolved) | 8 |
| E. Documentation-standard violations (fixed or flagged) | 12 |
| **Total** | **45** |

---

## A. Unsourced / under-sourced claims

| ID | Location | Claim | Issue |
| --- | --- | --- | --- |
| A-01 | Pitch / proof-points B14 | “~48-hour” self-falsification | FAIL dates cited; wall-clock not evidenced |
| A-02 | Pitch objections / F6 | Differentiation vs labs / Browserbase | ASSUMED; no primary roadmaps |
| A-03 | PRD §2–3, §12 | WebCoach / Mem0 / Browserbase positioning | Not re-verified this pass (`sources_verified: false` on PRD) |
| A-04 | PRD §13 | Personas + pricing hypothesis | To-test; unsourced if quoted as fact |
| A-05 | Root README | “near-zero token cost” replay | Intent; unmeasured |
| A-06 | Pivot §1 | Snowflake/Okta/Salesforce would fail same way | Extrapolation; not a second customer-side census |
| A-07 | C1–C3 scouts | `initial_browser_only_guess` | Hypotheses — C4/C5 override |
| A-08 | Proof-points F10 | Solo self-kill as diligence asset | Interpretation ASSUMED |
| A-09 | Pitch Ask | Financing ask | Founder TBD |
| A-10 | Any spoken gate % outside measured artifact | Performance | Must cite Track-1 output; none yet |
| A-11 | (was) Root README hero | "records an agent's successful trajectory" | **Resolved** — recorder is human-driven (`agent_model: "human"`), not agent-driven; README now says "developer's" plus a #127 annotation, and the locator-choice consequence is recorded in `docs/gate/testbed.md` / `recorder.md` |

---

## B. Placeholder / unmeasured metrics

| ID | Location | Item | Notes |
| --- | --- | --- | --- |
| B-01 | README / pitch | Measured gate number | Pending Track 1 |
| B-02 | README / pitch | Near-zero replay cost | PENDING TRACK-1 |
| B-03 | Pitch | Amortized-cost curve | ASSUMED + pending |
| B-04 | Pitch | Churn survival / self-heal rates | PENDING TRACK-1 |
| B-05 | PRD §9 | 80% / 90% / ~50% / 70% | **Proposed** gates ≠ measured results |
| B-06 | Pivot §7 | ~50% kill line | Subset of B-05 |
| B-07 | gate-v1 | Empty → `no_data` | Correct; inventing rates = violation |
| B-08 | C4 summary prose | “approx” vs exact table | Prefer per-surface table (30/17/28) |

---

## C. LOW-confidence load-bearing

| ID | Finding | Conf. | Loads | Risk |
| --- | --- | --- | --- | --- |
| C-01 | A5/C5 FREQUENCY as telemetry | A8/C5: **LOW** | Survivor scoring | A8/C5 both warn — still used in tables |
| C-02 | NO_PATH_FOUND = impossible | Method forbids | BO=3 rows | Overclaim if quoted without hard rule |
| C-03 | FC-04 / HP-10 as survivors | C4 LOW on FC-04; surface killed | C5 survivor count = 2 | Residues on failed surfaces — C5 says not anchors |
| C-04 | Counterparty as company thesis | Falsified as Wave-2 lock | Raise narrative | C5: thesis signal; Track-1 decides company |
| C-05 | C4 procurement ERODING | MED | One of six kills | Softer than ALREADY_SOLVED set |
| C-06 | Security-q “residual rank 1” | Economic×bed among *failed* | Misread as nomination | C5: ranking is honesty only, not lock |

---

## D. Document disagreements

| ID | Doc A | Doc B | Conflict | Severity |
| --- | --- | --- | --- | --- |
| D-01 **FOUNDER** | Historical A7 / early Wave-1 “conditionally credible” seller-portal lead | C4 ALREADY_SOLVED + **C5 FAIL** (do not lock “because A7 said so”) | Adjudicated by C5; residual deck slides may still lag | **Critical** if old pitch used without C5 cite |
| D-02 | PRD §8: Grafana Cloud + Datadog anchors | ADR-0003 OSS bed; A8/C5 reject those locks | **Resolved** — [v0.4 addendum](prd/PRD-v0.4-addendum.md) §1 carries a redirect table, and PRD §8 now opens with a superseded banner. v0.2 body unedited | Was Critical |
| D-03 | Pitch “no gate number” / unset thresholds | PRD §9 proposed 80/90/~50/70 | **Resolved as a status label** — [v0.4 addendum](prd/PRD-v0.4-addendum.md) §2 marks the thresholds PROPOSED and UNVALIDATED and names who accepts them, at gate-memo time. No number was chosen. Whether the *values* stay binding remains **FOUNDER** | Was High |
| D-04 | (was) Root README Track 2 “search in progress” / Track 3 “placeholders only” | C5 FAIL + ADR-0004; pitch pack on main | **Resolved** — status table now records Track 2 FAIL and Track 3 Wave-1 draft, each citing the artifact | Resolved in README; deck/objections prose may still lag (D-01, E-12) |
| D-05 | Early D1 proof-points: PRD absent / C5 pending | Files + C5 FAIL on main | Stale diligence | Medium — register refreshed |
| D-06 | PRD §8 “pivot if &lt;~6 survivors” | A8/C5 executed ≤2 FAIL gates | **Resolved** — [v0.4 addendum](prd/PRD-v0.4-addendum.md) §4 records ~6 as historical. The executed line was *stricter*, so no outcome changed | Was Medium — historical |
| D-07 | (was) Objections denying two FAILs | A8 + C5 | **Updated in this PR** to present-tense two FAILs | Resolved in objections; deck may lag |
| D-08 | Pivot “5-day vertical search” optimism | C5: do not re-run same-shape census | Next-action across time | Low–medium — C5 wins |

---

## E. Documentation-standard violations

### Fixed this PR

| ID | Item |
| --- | --- |
| E-01 | PRD YAML + Open questions |
| E-02 | Pivot YAML + Open questions |
| E-03 | Census A1–A8 YAML + Open questions stubs |
| E-04 | BOM / mojibake cleanup on affected docs |
| E-05 | Rebuilt docs/README.md as real index (incl. C5/ADR-0004) |
| E-06 | README-narrative.md + this audit |
| E-07 | Pitch cross-links refreshed for PRD/pivot/C5 |
| E-08 | ADR “Triggered by” lines (0001–0004) |

### Now machine-checked

`npm run lint:docs` (`scripts/lint-docs.mjs`, issue #53) runs in `npm run ci` and fails the
build on: missing frontmatter or any required key; a `doc_type` / `status` / `confidence` /
`sources_verified` / date value outside its allowed set; a `docs/*.md` not linked from
`docs/README.md`; a doc that does not **end** with `## Open questions / what I could not
verify`; and a relative link inside `docs/` that does not resolve.

It found and this PR fixed: `docs/gate/testbed.md` carrying `doc_type: gate` (not in
CONTRIBUTING's list — relabelled `spec`, since no gate result exists to call it `gate-result`);
six docs absent from the index (the five-doc pitch pack, and `A2-grafana.md`, hidden behind an
`A1`–`A3` range link); and two research docs with an appendix section after Open questions
(`vertical-search/adversary-report.md`, `vertical-search/DECISION.md` — sections reordered, no
wording changed).

The rows below say what the linter does **not** cover, so nothing here reads as closed when it
is not.

### Flagged

| ID | Item | Machine-checked? |
| --- | --- | --- |
| E-09 | A1–A4 evidence tables: access_date often doc-level or in URL cells, not always a column | **No.** The linter checks frontmatter, index coverage, the Open-questions section, and link resolution — never table columns. Review-enforced |
| E-10 | A5–A8 pre-standard shape beyond stubs | **Partly.** Frontmatter keys/values and the trailing Open-questions section are enforced and green on A5–A8; body shape beyond that is not |
| E-11 | Root README / CONTRIBUTING / archive meta — no wave frontmatter | **No — out of scope by design.** The linter walks `docs/` only. `docs/README.md` indexes root README and CONTRIBUTING as `living`, which is not a valid frontmatter `status`; whether those files should carry frontmatter at all is unresolved |
| E-12 | Residual pitch sentences not fully rewritten (objections/deck) — register + narrative updated | **No.** Prose content, not shape |

---

## Secrets spot-check

| Check | Result |
| --- | --- |
| `npm run secret-scan` | Run with this PR |
| Credentials / cookies / `.env` / session dumps in docs | None spotted |
| Design-partner names | None |
| Portal content dumps | Public URL citations only |

---

## Open questions / what I could not verify

- Whether founder wants a full pitch rewrite pass now that C5 FAIL is accepted, vs leaving Wave-1 as historical draft.
- Root README status-table update ownership.
- Whether `.md` outside `docs/` (root README, CONTRIBUTING, `archive/`, `contracts/README.md`,
  `experiments/gate-v1/README.md`) should carry wave frontmatter and be linted (E-11). The
  index calls two of them `living`, which is not a valid `status` — so extending the linter
  there needs a CONTRIBUTING decision first, not just a wider glob.
- Whether the evidence-table standard (`evidence_urls` + `access_date` columns, E-09) is
  mechanically checkable at all, given how much the census tables vary in shape. Not attempted.
