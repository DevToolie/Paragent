---
title: "C5 — Vertical adjudicator decision (Track 2)"
doc_type: research
status: accepted
owner: C5
created: 2026-07-25
updated: 2026-07-25
confidence: HIGH
supersedes: null
sources_verified: true
access_date: 2026-07-25
related:
  - docs/research/vertical-search/adversary-report.md
  - docs/research/vertical-search/vendor-security-questionnaires-trust-portals.md
  - docs/research/vertical-search/procurement-supplier-onboarding.md
  - docs/research/vertical-search/healthcare-payer-portals.md
  - docs/research/vertical-search/insurance-broker-carrier-portals.md
  - docs/research/vertical-search/freight-carrier-customs-portals.md
  - docs/research/vertical-search/regulatory-government-filing-portals.md
  - docs/research/census-week0/A8-DECISION.md
  - docs/prd/pivot-brief-v0.3.md
  - docs/decisions/ADR-0004-vertical-track2-fail.md
---

FAIL

# C5 — Vertical Adjudicator Decision Memo

**Role:** Sole scorer / gate for Track 2 (joins C1–C3 × C4; invents no new facts)  
**Scored:** 2026-07-25  
**Join completeness:** 75/75 task_ids have C4 verdict. Scout sources: six surface docs (access 2026-07-24) + `adversary-report.md` (access 2026-07-25). Where C1–C3 guessed Y/? and C4 said FULLY_API / PARTIAL / NO_PATH_FOUND, **C4 wins**. Where C1–C3 durability PASS and C4 says ALREADY_SOLVED or ERODING, **C4 wins**.

**Survivor count:** **2** (`HP-10`, `FC-04`)  
**Survivors on one surface ≥6:** **NOT MET** (healthcare 1, freight 1, all others 0)  
**Surfaces that clear durability + multiplicity for lock:** **0** (C4: 5× ALREADY_SOLVED, 1× ERODING; none DURABLE)  
**Gate threshold:** ≤2 survivors → **FAIL**. Do not lock a Wave-2 counterparty surface.  
**Nominated first task (testable post-condition):** **N/A** (FAIL).

---

## Evidence-quality assessment (read this before the tables)

This search is **strongest** where it kills the counterparty escape hatch: C4’s surface durability kills are densely cited to CMS-0057-F, HIPAA/CAQH CORE + Availity, FedEx Track / EDI / AES methods, AgentSync ProducerSync + SureLC, IRS MeF A2A/IFA, Vanta/SafeBase QAuto extensions, and Coupa cXML (`adversary-report.md`, access 2026-07-25). That half is trustworthy enough to bet the runway against “counterparty shape ⇒ durable browser-only gold.”

This search is **weakest** where it would need to *save* a wedge:

1. **Frequency is mostly inferred, not measured.** Scouts themselves flag no primary org-telemetry for portals-per-worker (security Q, procurement, freight, government — access 2026-07-24). Marketing claims (“50–200 questionnaires/year”) are secondary. Do **not** treat any FREQUENCY=2–3 as usage analytics. **CONFIDENCE: LOW** that FREQUENCY scores generalize outside vocal vendor blogs / surveys.
2. **NO_PATH_FOUND ≠ proven impossible** (C4 hard rule). BROWSER_ONLY=3 means “credible public search failed,” not “API cannot ship next quarter.” Especially thin for regional LTL booking (`FC-04`, C4 confidence LOW) and FOIA/state forms.
3. **PARTIAL residue is mostly long-tail / judgment / once-ish** — plan-unique clinical Qs, appeal narratives, LMS quizzes, SIM/KYC onboarding, identity/MFA. C4 already warns residue ≠ durable high-frequency wedge (`adversary-report.md` Structural finding). Scoring BO=2 without FREQUENCY≥2 and REPLAY≥2 correctly yields near-misses.
4. **Pain ≠ browser-only necessity.** Highest cited pain (AMA prior-auth burden in `healthcare-payer-portals.md`; questionnaire volume marketing in security scout) sits on tasks C4 killed as FULLY_API or absorbed by intermediaries. That is the Week-0 trap recycled: build UI replay for work rails or funded products already own.
5. **Scout durability PASSes were credulous relative to C4.** C1 scored security questionnaires DURABILITY PASS; C4 ALREADY_SOLVED via QAuto category. C1 scored procurement DURABILITY PASS; C4 ERODING. C2/C3 already FAILED durability on healthcare/insurance/freight/government before C4 — those scout self-kills are high-quality. **Sanity check:** not every surface “passed.” Zero surfaces remain DURABLE after C4. A credulous census would have left 6/6 green; this one did not.

**What I would not bet the runway on:** (a) locking any of the six Wave-2 surfaces as commercial anchor; (b) seller portal-fill as empty niche (intermediaries already productized); (c) any FREQUENCY=2 claim without design-partner interviews; (d) PHI / tax-bank / producer-PII pilots before counsel.

**Two consecutive FAILs:** Week-0 observability FAIL (2/70; `A8-DECISION.md`) + Track-2 counterparty FAIL (2/75; this memo) is evidence about the **selection thesis**, not merely bad anchor picks. Counterparty + multiplicity was the escape hatch after the census law (“vendors API what customers do repeatedly”). C4 shows high-frequency counterparty labor also attracts **rails or intermediaries**. Track-1’s replay-validity number may decide whether there is a company at all; another six-surface census of the same shape will not.

---

## Surface scorecard (lock gate)

Axes are pivot brief tests 1–3 (`pivot-brief-v0.3.md` §3). Durability and multiplicity use C4 when they disagree with scouts. **Surface fails outright** on durability **ALREADY_SOLVED** or multiplicity **1** — no task-level compensation.

| surface_slug | counterparty | durability (C4 wins) | multiplicity | surface_pass | scout disagreed? | test-bed (scout) | economic_signal × measurement | rank |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| vendor-security-questionnaires-trust-portals | PASS (C1) | **ALREADY_SOLVED** (C4) | PASS (C1; thin N) | **FAIL** | C1 DURABILITY PASS → C4 kill | Partial visitor / partner for fill | High demand × poor honest portal-fill bed | 1 (residual only) |
| procurement-supplier-onboarding | PASS (C1) | **ERODING** (C4) | PASS (C1; thin N) | **FAIL** | C1 DURABILITY PASS → C4 ERODING | Hostile (tax/bank) | Med labor × hostile bed | 2 |
| healthcare-payer-portals | PASS (C2) | **ALREADY_SOLVED** (C4; C2 already FAIL) | PASS (C2) | **FAIL** | Aligned FAIL | FAIL (HIPAA/partner) | High pain × unmeasurable | 3 |
| insurance-broker-carrier-portals | PASS (C2) | **ALREADY_SOLVED** (C4; C2 already FAIL) | PASS (C2) | **FAIL** | Aligned FAIL | FAIL (partner/PII) | Med × unmeasurable | 4 |
| freight-carrier-customs-portals | PASS (C3) | **ALREADY_SOLVED** (C4; C3 FAIL for majors) | PASS (C3) | **FAIL** | Aligned on majors | Hostile / partial AES | Med × hostile | 5 |
| regulatory-government-filing-portals | PASS (C3) | **ALREADY_SOLVED** (C4; C3 FAIL for MeF volume) | PASS (C3) | **FAIL** | Aligned on tax volume | Partial / counsel | Low residue × counsel-gated | 6 |

**Surfaces with DURABLE verdict: 0.** **Surfaces eligible to lock: 0.**

Ranking is **economic strength × measurement accessibility** among *failed* surfaces for residual honesty only — not a nomination. Security questionnaires rank first because spend/packaging citations exist (Conveyor “starting at $4,800”, Vanta QAuto packaging — C1, access 2026-07-24) and a thin self-serve visitor path exists (SQ-06) — which pivot brief §4 already rejected as the wrong side of the transaction. Procurement ranks second on NO_PATH density and then dies on privacy + once-per-buyer frequency. Healthcare pain is highest (AMA survey cited in C2) and measurement is worst (HIPAA).

---

## Scoring method (task axes)

Copied from Week-0 A8 conventions; C4 maps to BROWSER_ONLY:

| Axis | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| **BROWSER_ONLY** | C4 FULLY_API | C4 PARTIAL thin / optional / non-browser residue | C4 PARTIAL substantive browser sub-steps | C4 NO_PATH_FOUND |
| **FREQUENCY** | — | once / annual / identity / once-per-relationship | recurring across instances (job-level) | continuous high-volume core job |
| **PAIN** | — | thin / routine | moderate documented friction | strong survey / category / forum pain |
| **REPLAY_SUITABILITY** | mid-flow human judgment | SME narrative / quiz / correctness ≠ UI success | assertable submit/status, variable UI | crisp short confirm |

**SURVIVOR** = all four ≥ 2 (no compensating averages). FREQUENCY for once-per-buyer onboarding stays **1** even under multiplicity PASS — C1 and C4 both frame SIM/KYC as relationship-once, not daily ops. Questionnaire fill may score F≥2 at job level; REPLAY still dies on scout-stated SME judgment.

---

## Scored table

Sorted by **total** descending. 75 tasks. Where scout `initial_browser_only_guess` was Y/? and C4 said FULLY_API, BO=0.

| task_id | surface | task_name (short) | BROWSER_ONLY | FREQUENCY | PAIN | REPLAY_SUITABILITY | total | survivor | brief_rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HP-10 | healthcare | Secure message reply + attachment | 3 | 2 | 2 | 2 | 9 | Y | C4 NO_PATH; recurring correspondence; assertable reply — surface still ALREADY_SOLVED |
| HP-07 | healthcare | Payer-specific PA clinical questionnaire | 2 | 2 | 3 | 1 | 8 | N | C4 PARTIAL; AMA/MGMA pain; SME clinical answers kill R; ERODING under DTR |
| SQ-01 | security-q | OneTrust invited vendor submit | 2 | 3 | 3 | 1 | 9 | N | C4 PARTIAL; volume F; QAuto category + judgment kill lock |
| SQ-02 | security-q | ServiceNow vendor questionnaire | 2 | 2 | 2 | 1 | 7 | N | C4 PARTIAL; judgment |
| SQ-03 | security-q | Vanta QAuto scan/approve/fill | 2 | 2 | 2 | 1 | 7 | N | C4 PARTIAL; laborer is Vanta customer; approve=judgment |
| SQ-04 | security-q | SafeBase portal autofill | 2 | 2 | 2 | 1 | 7 | N | C4 PARTIAL; intermediary product |
| SQ-05 | security-q | Drata hosted questionnaire submit | 2 | 2 | 2 | 1 | 7 | N | C4 PARTIAL; SME answers |
| SQ-07 | security-q | Conveyor portal job + external fill | 2 | 2 | 2 | 1 | 7 | N | C4 PARTIAL; portal answers judgment |
| SQ-12 | security-q | ProcessUnity GRX respondent | 2 | 2 | 2 | 1 | 7 | N | C4 PARTIAL; judgment |
| FC-04 | freight | Regional carrier spot book | 2 | 2 | 2 | 2 | 8 | Y | C4 PARTIAL LOW conf; only freight survivor — surface ALREADY_SOLVED |
| HP-08 | healthcare | Claim appeal submit/track | 2 | 2 | 2 | 1 | 7 | N | C4 PARTIAL; narrative judgment |
| IB-05 | insurance | Complete carrier LMS modules | 3 | 2 | 2 | 1 | 8 | N | C4 NO_PATH; quiz judgment; intermediary surface |
| IB-01 | insurance | Initial contracting application | 2 | 1 | 2 | 2 | 7 | N | C4 PARTIAL; once-per-carrier F |
| IB-10 | insurance | Upload E&O / W-9 docs | 2 | 1 | 2 | 2 | 7 | N | C4 PARTIAL; setup-once |
| PO-03 | procurement | Coupa SIM / Information Request | 3 | 1 | 3 | 2 | 9 | N | C4 NO_PATH; once-per-buyer F; tax/KYC privacy |
| PO-06 | procurement | Ariba registration questionnaire | 3 | 1 | 3 | 2 | 9 | N | C4 NO_PATH; once-per-buyer |
| PO-02 | procurement | Coupa CSP first-time onboarding | 3 | 1 | 3 | 2 | 9 | N | C4 NO_PATH; bank/tax |
| PO-01 | procurement | Accept Coupa CSP invite / account | 3 | 1 | 2 | 2 | 8 | N | C4 NO_PATH; once |
| PO-05 | procurement | SAP BN account from invite | 3 | 1 | 2 | 2 | 8 | N | C4 NO_PATH; once |
| PO-09 | procurement | Jaggaer university registration | 3 | 1 | 2 | 2 | 8 | N | C4 NO_PATH; once |
| PO-07 | procurement | Ariba remittance / bank settings | 3 | 1 | 2 | 2 | 8 | N | C4 NO_PATH; privacy hard-stop |
| PO-08 | procurement | Ariba tax info | 3 | 1 | 2 | 2 | 8 | N | C4 NO_PATH; tax |
| FC-10 | freight | Freight invoice dispute | 3 | 1 | 2 | 2 | 8 | N | C4 NO_PATH; exception F |
| GF-03 | government | SAM entity registration write | 3 | 1 | 2 | 2 | 8 | N | C4 NO_PATH; rare |
| GF-04 | government | SAM banking / POC update | 3 | 1 | 2 | 2 | 8 | N | C4 NO_PATH; rare |
| GF-07 | government | Patent Center filing UI | 3 | 1 | 2 | 1 | 7 | N | C4 NO_PATH; complex judgment |
| GF-09 | government | State SOS annual report | 3 | 1 | 2 | 2 | 8 | N | C4 NO_PATH; annual F |
| GF-10 | government | State license renewal | 3 | 1 | 2 | 2 | 8 | N | C4 NO_PATH; annual/rare |
| GF-02 | government | IRS e-Services / MeF enrollment | 3 | 1 | 2 | 2 | 8 | N | C4 NO_PATH; once-ish |
| IB-04 | insurance | Manual PDF contracting outside SureLC | 3 | 1 | 2 | 1 | 7 | N | C4 NO_PATH; paper; rare |
| IB-07 | insurance | NIPR/state license apply/renew | 2 | 1 | 2 | 2 | 7 | N | C4 PARTIAL; rare |
| SQ-06 | security-q | Trust-center visitor NDA/download | 3 | 1 | 1 | 2 | 7 | N | C4 NO_PATH; thin visitor (pivot §4 reject) |
| SQ-08 | security-q | Start Vanta security review | 3 | 1 | 1 | 2 | 7 | N | C4 NO_PATH; seller=customer |
| SQ-09 | security-q | Attach link evidence in Vanta | 3 | 1 | 1 | 2 | 7 | N | C4 NO_PATH; seller=customer |
| HP-12 | healthcare | Portal user + MFA enroll | 3 | 1 | 1 | 2 | 7 | N | C4 NO_PATH; trust-boundary once |
| FC-11 | freight | Carrier portal user invite | 3 | 1 | 1 | 2 | 7 | N | C4 NO_PATH; once |
| GF-11 | government | FOIA submit | 3 | 1 | 1 | 2 | 7 | N | C4 NO_PATH; low value |
| GF-12 | government | Login.gov identity proofing | 3 | 1 | 1 | 1 | 6 | N | C4 NO_PATH; once |
| PO-04 | procurement | Coupa self-register | 3 | 1 | 1 | 2 | 7 | N | C4 NO_PATH; once |
| PO-12 | procurement | Coupa CSP MFA enroll | 3 | 1 | 1 | 2 | 7 | N | C4 NO_PATH; once |
| PO-13 | procurement | Update Coupa Business Profile | 2 | 1 | 2 | 2 | 7 | N | C4 PARTIAL; rare updates |
| IB-03 | insurance | SureLC producer profile CRUD | 2 | 2 | 1 | 2 | 7 | N | C4 PARTIAL; intermediary SaaS CRUD; weak pain |
| IB-12 | insurance | State DOI public appointment search | 3 | 1 | 1 | 2 | 7 | N | C4 NO_PATH; low value |
| SQ-11 | security-q | Whistic Basic Profile publish/share | 2 | 1 | 1 | 2 | 6 | N | C4 PARTIAL; seller-owned |
| GF-05 | government | SAM Reps & Certs PDF view | 1 | 1 | 1 | 2 | 5 | N | C4 PARTIAL thin |
| HP-01 | healthcare | Eligibility & benefits | 0 | 3 | 3 | 3 | 9 | N | C4 FULLY_API 270/271 |
| HP-02 | healthcare | Submit prior auth / referral | 0 | 3 | 3 | 3 | 9 | N | C4 FULLY_API 278 / Service Reviews |
| HP-06 | healthcare | Claim status | 0 | 3 | 2 | 3 | 8 | N | C4 FULLY_API 276/277 |
| HP-03 | healthcare | Is-auth-required check | 0 | 2 | 2 | 3 | 7 | N | C4 FULLY_API |
| HP-04 | healthcare | Attach clinical docs to auth | 0 | 2 | 2 | 2 | 6 | N | C4 FULLY_API Auth Attachments |
| HP-05 | healthcare | Auth status inquiry | 0 | 2 | 2 | 3 | 7 | N | C4 FULLY_API |
| HP-09 | healthcare | View remittance / ERA | 0 | 2 | 1 | 3 | 6 | N | C4 FULLY_API 835 |
| HP-11 | healthcare | EHR Prior Authorization API (future) | 0 | 2 | 2 | 3 | 7 | N | C4 FULLY_API CMS-0057-F |
| HP-13 | healthcare | Re-key eligibility second portal | 0 | 2 | 2 | 1 | 5 | N | C4 FULLY_API query; dual-login residue not durable |
| FC-01 | freight | Create parcel label in UI | 0 | 3 | 2 | 3 | 8 | N | C4 FULLY_API ship APIs |
| FC-02 | freight | Track shipment in portal | 0 | 3 | 1 | 3 | 7 | N | C4 FULLY_API Track API |
| FC-03 | freight | Accept/reject LTL tender | 0 | 2 | 2 | 3 | 7 | N | C4 FULLY_API EDI 204/990 |
| FC-05 | freight | Upload BOL / packing list | 0 | 2 | 2 | 2 | 6 | N | C4 FULLY_API docs API/EDI |
| FC-06 | freight | Schedule dock appointment | 0 | 2 | 2 | 3 | 7 | N | C4 FULLY_API Opendock |
| FC-07 | freight | AESDirect EEI file (manual path) | 0 | 2 | 2 | 2 | 6 | N | C4 FULLY_API EDI/WebLink/software exist |
| FC-08 | freight | AES EDI Bulk Upload | 0 | 2 | 1 | 3 | 6 | N | C4 FULLY_API |
| FC-09 | freight | AES status / ITN check | 0 | 2 | 1 | 3 | 6 | N | C4 FULLY_API |
| FC-12 | freight | Connect TMS to visibility network | 0 | 1 | 2 | 2 | 5 | N | C4 FULLY_API network APIs |
| IB-02 | insurance | SureLC multi-carrier request | 0 | 2 | 2 | 3 | 7 | N | C4 FULLY_API intermediary product |
| IB-06 | insurance | FireLight×SureLC can-sell check | 0 | 2 | 2 | 3 | 7 | N | C4 FULLY_API |
| IB-08 | insurance | Company appointment (carrier/NIPR) | 0 | 1 | 1 | 3 | 5 | N | C4 FULLY_API carrier-filed |
| IB-09 | insurance | ProducerSync licenses/appointments | 0 | 2 | 1 | 3 | 6 | N | C4 FULLY_API |
| IB-11 | insurance | Appointment status | 0 | 2 | 1 | 3 | 6 | N | C4 FULLY_API ProducerSync |
| IB-13 | insurance | JIT appointment on NB | 0 | 1 | 2 | 2 | 5 | N | C4 FULLY_API AgentSync JIT |
| GF-01 | government | MeF A2A/IFA transmit return | 0 | 3 | 1 | 3 | 7 | N | C4 FULLY_API |
| GF-06 | government | SAM entity search API | 0 | 2 | 1 | 3 | 6 | N | C4 FULLY_API |
| GF-08 | government | USPTO ODP pull | 0 | 2 | 1 | 3 | 6 | N | C4 FULLY_API |
| SQ-10 | security-q | Approve SafeBase access request | 0 | 1 | 1 | 3 | 5 | N | C4 FULLY_API |
| PO-10 | procurement | Coupa buyer CSP invite API | 0 | 1 | 1 | 3 | 5 | N | C4 FULLY_API buyer path |
| PO-11 | procurement | SAP Supplier Invite API | 0 | 1 | 1 | 3 | 5 | N | C4 FULLY_API buyer path |

### Survivor detail (only two that clear all four gates)

| task_id | Scores | Why it cleared | Why it still does not save Track 2 |
| --- | --- | --- | --- |
| **HP-10** | BO3 F2 P2 R2 | C4 NO_PATH for correspondence submit; practice ops recurrence plausible; reply/attachment end-state assertable | Surface **ALREADY_SOLVED** (X12 + clearinghouse + CMS-0057-F). Residue is long-tail under DTR erosion. HIPAA hard-stop for test-bed (`healthcare-payer-portals.md` §5, §7). F=2 is MED/inferred. |
| **FC-04** | BO2 F2 P2 R2 | C4 PARTIAL regional spot book without universal API | C4 confidence **LOW**. Surface **ALREADY_SOLVED** at majors via Track/Ship/EDI/TMS. One thin regional task ≠ freight vertical. Test-bed hostile. |

**No surface has ≥6 survivors.** Max per surface = 1.

---

## Tasks killed by C4 — what we would have wrongly built on

Highest pain / frequency kills (scout signals that are dead as browser anchors):

| Would-have-built | Why it looked good pre-C4 | Kill citation (C4) |
| --- | --- | --- |
| HP-02 prior auth submit | AMA 45 PA/physician/week; portal hell (C2) | HIPAA X12 278 + Availity Service Reviews; CMS-0057-F PA API |
| HP-01 eligibility | Daily RCM; multi-portal (MGMA) | CAQH CORE 270/271 + Availity |
| HP-06 claim status | Same | CAQH CORE 276/277 |
| FC-01/02 ship & track | Core freight ops | FedEx/UPS APIs |
| FC-07 AESDirect click-path | “Government = no API” intuition | AES EDI Bulk Upload / WebLink / certified software |
| IB-02 multi-carrier appoint | Agency paperwork pain | SureLC Fastlane product path |
| IB-09/11 license & appointment status | Compliance anxiety | AgentSync ProducerSync |
| GF-01 tax e-file | Filing volume | IRS MeF IFA/A2A |
| SQ-01–05 portal fill | A7 backup wedge; seller counterparty PASS | QAuto intermediaries (Vanta extension et al.) — category already productized |
| PO-10/11 buyer invites | Contrast rows | Buyer invite APIs (supplier UI remains; frequency death) |

**Wrong thesis the kill list falsifies:** “If the laborer is not the portal owner’s customer, high-frequency browser-only work is durable and empty.” Competent counterparties buy clearinghouses, TMS/visibility networks, producer-compliance SaaS, tax transmitters, or QAuto extensions — then the laborer becomes *that* product’s customer and Week-0’s API/IaC kill mode returns.

---

## Gate application

| Criterion | Result |
| --- | --- |
| ≥6 survivors on **one** surface that also passes durability + multiplicity → **PASS**, lock it | **No** (0 eligible surfaces; max survivors/surface = 1) |
| 3–5 survivors **or** survivors spread without a lockable surface → **MARGINAL** | **No** |
| ≤2 survivors → **FAIL** | **Yes** (2 survivors, neither on a DURABLE surface) |

**Explicit statement:** Survivor count = **2**. Single-surface concentration of 6+ = **not met**. Durable surfaces = **0**.

**Sanity check:** Scouts were partially credulous on durability (C1 PASS on security Q and procurement; C4 killed both). They were **not** uniformly credulous — C2/C3 already FAILED durability on four surfaces. C4 finishing 6/6 kills matches the expected FAIL/MARGINAL ceiling.

---

## Test-bed feasibility (weighing; not a numeric axis)

| Surface | Measurement accessibility | Implication |
| --- | --- | --- |
| security-q | Visitor self-serve thin; inbound fill needs partner or synthetic buyer (bias) | Best residual bed is the wrong wedge (pivot §4) |
| procurement | Production tax/bank; no safe playground | Hostile |
| healthcare | HIPAA + clinic partner | Hard-stop for early gate |
| insurance | Licensed identity + carrier acceptance | Hostile |
| freight | Carrier ToS; AES slow | Hostile |
| government | Counsel + enrollment | Hostile for volume wedge |

Even if survivors had clustered, **measurement accessibility is poor across the board**. Economic strength without a reachable assertion loop is not a Wave-2 lock.

---

## Nominated first task

**N/A** — gate FAIL. No testable post-condition assertion is nominated for commercial vertical lock.

(Track-1 continues on Grafana OSS per ADR-0003; that is a churn proxy, not a vertical nomination.)

---

## Specific next action (owner + time-box)

| Field | Value |
| --- | --- |
| **Decision** | Do **not** lock any Wave-2 counterparty surface. Record second consecutive vertical FAIL. |
| **Next action** | **Ship Track-1 gate number** (replay-validity / repair vs fresh-reasoning on Grafana OSS version matrix). Do **not** recruit a design partner for portal pilots this week. Do **not** re-run another six-surface counterparty census of the same shape. |
| **Owner** | Eng (Track-1 B1–B4 harness) + Founder (kill/continue after number) |
| **Time-box** | Track-1 gate window already in motion (pivot brief §4 / ADR-0003) — treat vertical lock as **closed** until Track-1 returns. If Track-1 fails (§9 / kill condition), **stop the company thesis**. If Track-1 passes, founder time-box **3 business days** to choose: (a) reframe product as infrastructure sold to existing QAuto/RCM/TMS intermediaries (not end-laborer wedge), or (b) shut vertical search and keep research-only. |
| **Explicit non-goals** | Locking seller questionnaires “because A7 said so”; pilot on PHI/tax/bank/producer portals; treating HP-10 or FC-04 as anchors; claiming DURABLE browser-only from NO_PATH_FOUND residue. |

---

## Decision narrative

**FAIL.** The counterparty hypothesis correctly predicted API asymmetry for invited respondents — and incorrectly predicted an empty, durable, high-frequency browser-only market. C4 showed rails (healthcare, freight, MeF) or funded intermediaries (SureLC/AgentSync, QAuto, cXML/BPO) already absorb the jobs that would have paid for a trajectory cache. Task survivors are two thin residues on killed surfaces. Week-0 FAIL + Track-2 FAIL is a thesis signal: **frequency still causes absorption**, whether the absorber is the portal owner’s API or a third-party product the laborer buys. The company now depends on Track-1 proving the mechanism works at all; vertical romance will not substitute for that number.

---

## Open questions / what I could not verify

- Primary measured portals-per-FTE for any surface (scouts + C4 flag absence; access 2026-07-24/25).
- Whether HP-10 correspondence volume is truly F≥2 outside anecdotal ops (CONFIDENCE: MED on survivor row).
- Whether any QAuto vendor would buy a replay substrate rather than keep shipping extensions (out of scope; not scored).
- Live counsel position on authorized-user automation of third-party portals (pivot §5; still pending).
- Exact % AESDirect click-path vs EDI (C4 open question; not claimed).

---

## Method notes (integrity)

- Joined C1–C3 task tables × C4 verdicts on `task_id`; surface durability from C4; FREQUENCY/PAIN/REPLAY from scout evidence only — no new APIs or $ TAM.
- C4 wins all scout×adversary conflicts (including C1 DURABILITY PASS on security-q and procurement).
- No path found ≠ no path exists.

*Adjudicator: C5. Decision date: 2026-07-25.*
