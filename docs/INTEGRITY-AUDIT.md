---
title: Documentation integrity audit (Wave 3 / D2)
doc_type: brief
status: draft
owner: D2
created: 2026-07-25
updated: 2026-07-25
confidence: HIGH
supersedes: null
sources_verified: true
---

# INTEGRITY-AUDIT

D2 consolidator pass (2026-07-25), **after** C4 + C5 merges. **Surfaces conflicts; does not pick a side** except where a later accepted adjudicator already ruled (noted explicitly).

**Category counts:**

| Category | Count |
| --- | --- |
| A. Unsourced / under-sourced claims | 10 |
| B. Placeholder / unmeasured metrics | 8 |
| C. LOW-confidence findings load-bearing in a decision | 6 |
| D. Document disagreements | 8 |
| E. Documentation-standard violations (fixed or flagged) | 12 |
| **Total** | **44** |

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
| D-02 **FOUNDER** | PRD §8: Grafana Cloud + Datadog anchors | ADR-0003 OSS bed; A8/C5 reject those locks | Residual PRD body | **Critical** |
| D-03 **FOUNDER** | Pitch “no gate number” / unset thresholds | PRD §9 proposed 80/90/~50/70 | Unset measured vs proposed | **High** |
| D-04 | Root README Track 3 “placeholders only” | Pitch pack + C5 on main | Stale status | Medium |
| D-05 | Early D1 proof-points: PRD absent / C5 pending | Files + C5 FAIL on main | Stale diligence | Medium — register refreshed |
| D-06 | PRD §8 “pivot if &lt;~6 survivors” | A8/C5 executed ≤2 FAIL gates | Different fail lines | Medium — historical |
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

### Flagged

| ID | Item |
| --- | --- |
| E-09 | A1–A4 evidence tables: access_date often doc-level or in URL cells, not always a column |
| E-10 | A5–A8 pre-standard shape beyond stubs |
| E-11 | Root README / CONTRIBUTING / archive meta — no wave frontmatter |
| E-12 | Residual pitch sentences not fully rewritten (objections/deck) — register + narrative updated |

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
