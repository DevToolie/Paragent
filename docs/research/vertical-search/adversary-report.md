---
title: "Adversary report — Wave 2 durability attack (C4)"
doc_type: research
status: draft
owner: C4
created: 2026-07-25
updated: 2026-07-25
confidence: HIGH
supersedes: null
sources_verified: true
access_date: 2026-07-25
related:
  - docs/research/vertical-search/vendor-security-questionnaires-trust-portals.md
  - docs/research/vertical-search/procurement-supplier-onboarding.md
  - docs/research/vertical-search/healthcare-payer-portals.md
  - docs/research/vertical-search/insurance-broker-carrier-portals.md
  - docs/research/vertical-search/freight-carrier-customs-portals.md
  - docs/research/vertical-search/regulatory-government-filing-portals.md
  - docs/research/census-week0/A4-adversary.md
---

# Adversary report — Wave 2 (C4)

**Role:** Durability adversary. Kill browser-only / permanently-no-API claims. Rewarded for destruction.  
**Access date for all new citations in this doc:** **2026-07-25** (scout docs retain their own 2026-07-24 rows).  
**Stance:** Assume `FULLY_API` (or intermediary absorption) until search fails. `PARTIAL` names browser-bound sub-steps. `NO_PATH_FOUND` lists queries + sections checked — never “no path exists.”  
**Lane:** Attack only. Do not adjudicate (C5). Do not soften kills.

Verdict codes per task:

| Code | Meaning |
| --- | --- |
| FULLY_API | Cited electronic path covers the observable end state (API / EDI / mandated transaction / documented partner integration). Browser is optional convenience. |
| PARTIAL | Electronic path covers core; named sub-steps remain browser-bound. |
| NO_PATH_FOUND | Searched; no public path found for this exact task. Residue candidate (still subject to frequency / intermediary / regulatory kills at surface level). |

Surface durability:

| Code | Meaning |
| --- | --- |
| ALREADY_SOLVED | Rails + intermediaries already absorb the high-frequency wedge. Surface fails as Paragent anchor. |
| ERODING | Electronic / intermediary paths expanding on a dated clock; residue is exception / once-ish / long-tail. |
| DURABLE | Interest-grounded reason browser-only labor persists for the named wedge (adversary could not kill). |

---

## Surfaces I killed

Citation = single strongest kill link. Access date 2026-07-25.

| # | surface_slug | durability_verdict | kill type | one citation that does it |
| --- | --- | --- | --- | --- |
| 1 | `healthcare-payer-portals` | **ALREADY_SOLVED** | Mandated FHIR Prior Authorization API + existing HIPAA X12 278 / clearinghouse REST | https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-prior-authorization-final-rule-cms-0057-f |
| 2 | `freight-carrier-customs-portals` | **ALREADY_SOLVED** | Carrier Track/Ship APIs + freight EDI tender/status cycle + AES EDI/WebLink | https://developer.fedex.com/api/en-at/catalog/track/v1/docs.html |
| 3 | `insurance-broker-carrier-portals` | **ALREADY_SOLVED** | Producer management intermediaries + NIPR-sourced ProducerSync API | https://developer.agentsync.io/producersync-api-overview |
| 4 | `regulatory-government-filing-portals` | **ALREADY_SOLVED** | IRS MeF IFA + A2A for authorized transmitters (high-volume returns) | https://www.irs.gov/e-file-providers/modernized-e-file-overview |
| 5 | `vendor-security-questionnaires-trust-portals` | **ALREADY_SOLVED** | Seller-side QAuto intermediaries treat buyer portals as DOM targets (category already productized) | https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension |
| 6 | `procurement-supplier-onboarding` | **ERODING** | Supplier cXML invoice/PO automation + buyer-side invite APIs; onboarding forms are once-per-buyer residue, not permanent high-frequency absence | https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/features-and-processes-in-the-coupa-supplier-portal/invoices/cxml-invoices |

**Surfaces killed count: 6** (5 ALREADY_SOLVED + 1 ERODING structural kill of the “high-frequency permanently browser-only” thesis).  
**CONFIDENCE: HIGH** on kills 1–4; **HIGH** on intermediary kill 5; **MED** on procurement as surface-level kill (onboarding SIM write API still NO_PATH_FOUND — see tasks).

---

## Tasks I killed

FULLY_API (or intermediary-equivalent end-state) falsifications. Citation = single strongest kill.

| task_id | scout guess | kill citation |
| --- | --- | --- |
| HP-01 | N | https://www.cms.gov/priorities/key-initiatives/burden-reduction/administrative-simplification/operating-rules/eligibility-claim-status |
| HP-02 | N | https://www.cms.gov/priorities/key-initiatives/burden-reduction/administrative-simplification/transactions/referral-certification-authorization |
| HP-03 | N | https://developer.availity.com/blog/2025/3/4/service-reviews |
| HP-04 | ? | https://developer.availity.com/blog/2025/3/4/service-reviews |
| HP-05 | N | https://developer.availity.com/blog/2025/3/25/availity-api-guide |
| HP-06 | N | https://www.caqh.org/core/caqh-core-claim-status-operating-rules |
| HP-09 | N | https://developer.availity.com/blog/2025/3/25/availity-api-guide |
| HP-11 | N | https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-prior-authorization-final-rule-cms-0057-f |
| HP-13 | ? | https://www.cms.gov/priorities/key-initiatives/burden-reduction/administrative-simplification/operating-rules/eligibility-claim-status |
| FC-01 | N | https://developer.fedex.com/ |
| FC-02 | N | https://developer.fedex.com/api/en-at/catalog/track/v1/docs.html |
| FC-03 | ? | https://www.spscommerce.com/edi-document/edi-204-motor-carrier-load-tender/ |
| FC-05 | ? | https://www.ups.com/us/en/supplychain/tools/innovation-technology/freight-technology-solutions |
| FC-06 | Y | https://developer.loadsmart.com/docs/opendock/overview/getting-started |
| FC-07 | PARTIAL | https://www.census.gov/foreign-trade/aes/introduction.html |
| FC-08 | N | https://www.census.gov/foreign-trade/aes/introduction.html |
| FC-09 | PARTIAL | https://www.census.gov/foreign-trade/aes/introduction.html |
| FC-12 | N | https://developers.project44.com/ |
| IB-02 | N | https://www.surelc.com/ |
| IB-06 | N | https://hexure.com/press-releases/hexure-and-surancebay-partner-to-streamline-can-sell-check-processes/ |
| IB-08 | N | https://ldi.la.gov/industry/producer-adjuster/agency-affiliations-information/company-appointment |
| IB-09 | N | https://developer.agentsync.io/producersync-api-overview |
| IB-11 | ? | https://developer.agentsync.io/producersync-api-overview |
| IB-13 | ? | https://agentsync.io/integrated-producer-compliance |
| GF-01 | N | https://www.irs.gov/e-file-providers/modernized-e-file-overview |
| GF-06 | N | https://open.gsa.gov/api/entity-api/ |
| GF-08 | N | https://data.uspto.gov/apis/getting-started |
| SQ-10 | N | https://docs.safebase.io/reference/approverequest-1 |
| PO-10 | N | https://compass.coupa.com/en-us/products/product-documentation/suppliers/supplier-integration-resources/api-endpoint-for-supplier-csp-invites |
| PO-11 | N | https://help.sap.com/doc/56b8a389fe0249afaacc4d44fa95c449/cloud/en-US/supplier_invite_api.pdf |

**Tasks killed (FULLY_API list above): 30**  
Additional **PARTIAL** rows (electronic core exists; named browser residue) are **not** counted as full kills — see verdict tables.  
**CONFIDENCE: HIGH** on healthcare/freight/MeF kills; **MED** where intermediary SaaS UI replaces carrier portal without a public open API (IB-02 SureLC product path).

---

## Per-surface intermediary answer

| surface | Does an intermediary already absorb the labor? | Answer | Evidence (access 2026-07-25) | CONFIDENCE |
| --- | --- | --- | --- | --- |
| healthcare-payer-portals | **YES — lethal** | Clearinghouses (Availity) sell multi-payer portal **and** REST wrappers for X12 270/271, 276/277, 278, 835. Practices that buy Essentials Plus / APIs / RCM middleware become the intermediary’s customer — Week-0 structural kill recycled. | https://developer.availity.com/blog/2025/3/25/availity-api-guide ; https://developer.availity.com/portal/catalogue-products/healthcare-hipaa-transactions-1 | HIGH |
| freight-carrier-customs-portals | **YES — lethal** | TMS + visibility networks (project44-class) connect carriers via API/EDI; AES certified software vendors / service centers / authorized agents file EEI; forwarders absorb customs labor. | https://developers.project44.com/ ; https://www.census.gov/foreign-trade/aes/introduction.html | HIGH |
| insurance-broker-carrier-portals | **YES — lethal** | SureLC / SuranceBay collapse multi-carrier contracting; AgentSync Manage + ProducerSync sit on NIPR; FireLight×SureLC automates can-sell. Category is compliance SaaS, not empty portal labor. | https://www.surelc.com/ ; https://developer.agentsync.io/producersync-api-overview | HIGH |
| regulatory-government-filing-portals | **YES — lethal for tax** | Authorized e-file providers / transmitters / software developers own MeF volume via IFA/A2A. SAM consultants absorb entity admin for gov-con. | https://www.irs.gov/e-file-providers/modernized-e-file-overview | HIGH |
| vendor-security-questionnaires-trust-portals | **YES — lethal** | Vanta, SafeBase/Drata, Conveyor, FillBase, Wolfia, HyperComply, Loopio-class tools ship portal autofill / QAuto. Demand validated; labor accrues to seller GRC SaaS buyers. | https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension ; https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm | HIGH |
| procurement-supplier-onboarding | **YES for post-onboarding; PARTIAL for SIM** | cXML/EDI + SAP BN Commerce Automation absorb PO/invoice for integrated suppliers; Monto / Invoice Butler productize portal onboarding as BPO/SaaS. Per-buyer SIM questionnaires still force supplier click-path when no supplier write API found. | https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/features-and-processes-in-the-coupa-supplier-portal/invoices/cxml-invoices ; https://learning.sap.com/courses/sap-ariba-integration-sap-ariba-integration-points/discovering-ariba-network-integrations ; https://www.invoicebutler.com/product/supplier-portal-management | HIGH on transactions; MED on whether BPO fully covers SIM |

---

## Surface durability verdicts (one line each)

| surface | verdict | one-line |
| --- | --- | --- |
| healthcare-payer-portals | **ALREADY_SOLVED** | HIPAA X12 + CAQH CORE + Availity APIs already exist; CMS-0057-F mandates FHIR Prior Authorization API generally by 2027. |
| freight-carrier-customs-portals | **ALREADY_SOLVED** | Majors expose Track/Ship APIs; EDI 204/990/214 covers tender/status; AES has EDI Bulk Upload, WebLink, and certified software — portal is residual for non-integrated filers. |
| insurance-broker-carrier-portals | **ALREADY_SOLVED** | Carrier incentives align to reduce NIGO; SureLC/AgentSync/NIPR already intermediate multi-carrier appointment labor. |
| regulatory-government-filing-portals | **ALREADY_SOLVED** | Government wants structured intake — MeF A2A/IFA owns return transmission; surviving browser work is enrollment/identity/rare writes. |
| vendor-security-questionnaires-trust-portals | **ALREADY_SOLVED** | Buyer TPRM APIs are tenant-side; seller portal fill is already a funded Chrome-extension product category. |
| procurement-supplier-onboarding | **ERODING** | Transaction rails (cXML/EDI) and BPO exist; buyer-specific SIM/KYC browser forms may persist but are once-per-relationship, not durable high-frequency absence. |

---

## 1) Healthcare payer portals — task verdicts

**Surface durability: ALREADY_SOLVED.** Kill citation: CMS-0057-F Prior Authorization API (compliance generally beginning 2027) ([CMS fact sheet](https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-prior-authorization-final-rule-cms-0057-f), accessed 2026-07-25). HIPAA already adopted ASC X12N 278 for referral certification/authorization ([CMS](https://www.cms.gov/priorities/key-initiatives/burden-reduction/administrative-simplification/transactions/referral-certification-authorization), accessed 2026-07-25). Eligibility 270/271 and claim status 276/277 have federally effective CAQH CORE operating rules ([CMS operating rules](https://www.cms.gov/priorities/key-initiatives/burden-reduction/administrative-simplification/operating-rules/eligibility-claim-status), accessed 2026-07-25).

| task_id | verdict | browser_bound_substeps | evidence_urls | search_queries_or_sections | confidence |
| --- | --- | --- | --- | --- | --- |
| HP-01 | FULLY_API | — | https://www.cms.gov/priorities/key-initiatives/burden-reduction/administrative-simplification/operating-rules/eligibility-claim-status ; https://developer.availity.com/blog/2025/3/25/availity-api-guide | CAQH CORE 270/271; Availity eligibility API | HIGH |
| HP-02 | FULLY_API | — | https://www.cms.gov/priorities/key-initiatives/burden-reduction/administrative-simplification/transactions/referral-certification-authorization ; https://developer.availity.com/blog/2025/3/25/availity-api-guide | HIPAA X12 278; Availity Service Reviews | HIGH |
| HP-03 | FULLY_API | — | https://developer.availity.com/blog/2025/3/4/service-reviews | Availity IsAuthRequired add-on API | HIGH |
| HP-04 | FULLY_API | Residual payer Spaces may still show portal upload UX — path still exists via Auth Attachments API | https://developer.availity.com/blog/2025/3/4/service-reviews | Availity Auth Attachments API coverage matrix (full payer matrix not verified) | MED |
| HP-05 | FULLY_API | — | https://developer.availity.com/blog/2025/3/25/availity-api-guide | Service Reviews / 278 inquiry | HIGH |
| HP-06 | FULLY_API | — | https://www.caqh.org/core/caqh-core-claim-status-operating-rules ; https://developer.availity.com/portal/catalogue-products/healthcare-hipaa-transactions-1 | CAQH CORE 276/277; Availity Claim Statuses | HIGH |
| HP-07 | PARTIAL | Plan-unique clinical questionnaire UI when not covered by Da Vinci DTR Questionnaire / 278 data set | https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-prior-authorization-final-rule-cms-0057-f (recommends Da Vinci CRD/DTR/PAS) ; https://www.mgma.com/mgma-stat/how-many-payer-portals-is-too-many-most-practices-already-know-their-answer | `payer-agnostic prior auth clinical questionnaire API standard`; Da Vinci DTR Questionnaire | MED |
| HP-08 | PARTIAL | Appeal narrative / attachment UX on payer portal when no clearinghouse appeal product wired | https://www.availity.com/multi-payer-portal/ | `Availity claim appeal API X12`; `HIPAA appeal transaction standard` — no universal appeal API found | LOW |
| HP-09 | FULLY_API | — | https://developer.availity.com/blog/2025/3/25/availity-api-guide (lists ASC X12N 835 ERA) | X12 835 / ERA via clearinghouse | HIGH |
| HP-10 | NO_PATH_FOUND | Secure message reply + attachment in correspondence hub | https://www.availity.com/multi-payer-portal/ | Searched: `Availity Digital Correspondence Hub API`; `payer secure message API provider` — no public submit API found | MED |
| HP-11 | FULLY_API | — (future mandated path) | https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-prior-authorization-final-rule-cms-0057-f | CMS-0057-F Prior Authorization API | HIGH |
| HP-12 | NO_PATH_FOUND | Portal user create / MFA enroll / ToS accept | https://www.mgma.com/mgma-stat/how-many-payer-portals-is-too-many-most-practices-already-know-their-answer | `Availity Essentials user provisioning API provider MFA` — no path found | HIGH |
| HP-13 | FULLY_API | Hub miss may still cause second login — but eligibility query itself is 270/271 | https://www.cms.gov/priorities/key-initiatives/burden-reduction/administrative-simplification/operating-rules/eligibility-claim-status | dual-portal re-key vs EDI | HIGH |

**Healthcare kill summary:** 9 FULLY_API, 2 PARTIAL, 2 NO_PATH_FOUND. Residue (HP-10, HP-12, HP-07 UI) is correspondence / identity / questionnaire long-tail — **ERODING under DTR**, not a durable high-frequency wedge. PHI/HIPAA hard-stop remains (scout §7) — orthogonal kill for v1 packaging.

---

## 2) Freight, carrier & customs portals — task verdicts

**Surface durability: ALREADY_SOLVED** for high-frequency track/ship/tender/AES volume. Kill citation: FedEx Track API docs ([FedEx](https://developer.fedex.com/api/en-at/catalog/track/v1/docs.html), accessed 2026-07-25). Supporting: UPS SCS API+EDI ([UPS](https://www.ups.com/us/en/supplychain/tools/innovation-technology/freight-technology-solutions)); EDI 204/990/214 cycle ([SPS Commerce](https://www.spscommerce.com/edi-document/edi-204-motor-carrier-load-tender/)); Census AES EDI Bulk Upload / WebLink / certified software ([Census AES intro](https://www.census.gov/foreign-trade/aes/introduction.html)); Opendock Neutron REST for dock appointments ([Opendock](https://developer.loadsmart.com/docs/opendock/overview/getting-started)).

| task_id | verdict | browser_bound_substeps | evidence_urls | search_queries_or_sections | confidence |
| --- | --- | --- | --- | --- | --- |
| FC-01 | FULLY_API | — | https://developer.fedex.com/ ; https://www.ups.com/us/en/supplychain/tools/innovation-technology/freight-technology-solutions | FedEx/UPS ship APIs | HIGH |
| FC-02 | FULLY_API | — | https://developer.fedex.com/api/en-at/catalog/track/v1/docs.html | FedEx Track API | HIGH |
| FC-03 | FULLY_API | Non-EDI regional portal accept/reject UI when partner not on EDI | https://www.spscommerce.com/edi-document/edi-204-motor-carrier-load-tender/ ; https://www.project44.com/platform/tms/rating-booking/ | EDI 204→990; project44 booking | HIGH |
| FC-04 | PARTIAL | Spot book on regional carrier website without EDI onboarding | no universal regional API found | Searched: `regional LTL carrier public booking API shipper` | LOW |
| FC-05 | FULLY_API | Exception upload when partner lacks document API | https://www.ups.com/us/en/supplychain/tools/innovation-technology/freight-technology-solutions | UPS SCS documents via API/EDI | MED |
| FC-06 | FULLY_API | Facilities not on Opendock/FourKites-class platforms | https://developer.loadsmart.com/docs/opendock/overview/getting-started ; https://developer.loadsmart.com/docs/opendock/for-carriers/booking-appointments | Opendock `POST /appointment`; dock appointment API | HIGH |
| FC-07 | FULLY_API | Manual AESDirect click-path still offered; EDI/WebLink/certified software exist | https://www.census.gov/foreign-trade/aes/introduction.html | AES filing methods section | HIGH |
| FC-08 | FULLY_API | — | https://www.census.gov/foreign-trade/aes/introduction.html ; https://www.cbp.gov/trade/automated/how-to-use-ace/introduction/aesdirect-technical-information | EDI Bulk Upload AESTIR / X12 601 | HIGH |
| FC-09 | FULLY_API | Portal status view optional vs email/ITN response | https://www.census.gov/foreign-trade/aes/introduction.html | ITN via portal + email | HIGH |
| FC-10 | NO_PATH_FOUND | Dispute ticket in carrier billing UI | — | Searched: `carrier freight invoice dispute API shipper`; `FedEx freight invoice dispute API` — no universal open dispute API found | LOW |
| FC-11 | NO_PATH_FOUND | Invite coworker / role update in carrier account UI | — | Searched: `FedEx account user invite API` — no path found | MED |
| FC-12 | FULLY_API | Initial OAuth/consent may be UI — connection is network API product | https://developers.project44.com/ ; https://www.project44.com/carriers/ | project44 developer APIs | HIGH |

**Freight kill summary:** 9 FULLY_API, 1 PARTIAL, 2 NO_PATH_FOUND. Intermediary (TMS/visibility/forwarder) is independently lethal.

---

## 3) Insurance broker / carrier appointment portals — task verdicts

**Surface durability: ALREADY_SOLVED.** Kill citation: AgentSync ProducerSync API over NIPR data ([ProducerSync overview](https://developer.agentsync.io/producersync-api-overview), accessed 2026-07-25). SureLC markets multi-carrier onboarding ([SureLC](https://www.surelc.com/)). Company appointments are carrier-filed via NIPR, not agency browser gold ([LA DOI](https://ldi.la.gov/industry/producer-adjuster/agency-affiliations-information/company-appointment)).

| task_id | verdict | browser_bound_substeps | evidence_urls | search_queries_or_sections | confidence |
| --- | --- | --- | --- | --- | --- |
| IB-01 | PARTIAL | Carrier-unique contracting packet not on SureLC integration | https://www.surelc.com/ ; https://hancockbrokerage.net/wp-content/uploads/2024/09/SureLCProducerUserGuide-2013.pdf | SureLC vs carrier portal hybrid | MED |
| IB-02 | FULLY_API | — (productized multi-request; agency buys intermediary) | https://www.surelc.com/ | SureLC Fastlane / multi-request | HIGH |
| IB-03 | PARTIAL | Profile CRUD inside SureLC UI — **no public SureLC producer API found** | https://www.surelc.com/ | Searched: `SureLC public API documentation`; `SuranceBay API reference` — NO_PATH_FOUND for open API; still intermediary SaaS not carrier portal | MED |
| IB-04 | NO_PATH_FOUND | Manual PDF/paper outside SureLC | https://hancockbrokerage.net/wp-content/uploads/2024/09/SureLCProducerUserGuide-2013.pdf | outside-SureLC path documented | HIGH |
| IB-05 | NO_PATH_FOUND | Complete LMS modules / quizzes | https://hexure.com/press-releases/hexure-and-surancebay-partner-to-streamline-can-sell-check-processes/ | can-sell *check* automated; module completion remains LMS UI | MED |
| IB-06 | FULLY_API | — | https://hexure.com/press-releases/hexure-and-surancebay-partner-to-streamline-can-sell-check-processes/ | FireLight × SureLC can-sell | HIGH |
| IB-07 | PARTIAL | NIPR/state application UI; AgentSync Autopilot for *their* customers | https://nipr.com/ ; https://agentsync.io/partners/nipr | NIPR electronic hub + intermediary renewal automation | MED |
| IB-08 | FULLY_API | — | https://ldi.la.gov/industry/producer-adjuster/agency-affiliations-information/company-appointment ; https://nipr.com/ | carrier files appointment | HIGH |
| IB-09 | FULLY_API | — | https://developer.agentsync.io/producersync-api-overview | `/v2/licenses`, `/v2/appointments` | HIGH |
| IB-10 | PARTIAL | Doc upload on non-integrated carrier portal | https://www.surancebay.com/wp-content/uploads/2019/03/SureLC-Carrier-Solutions-Brochure.pdf | SureLC carrier document exchange vs portal | MED |
| IB-11 | FULLY_API | Direct portal status when carrier does not feed SureLC | https://developer.agentsync.io/producersync-api-overview | appointments via ProducerSync | HIGH |
| IB-12 | NO_PATH_FOUND | State DOI public search UI | https://ldi.la.gov/industry/producer-adjuster/agency-affiliations-information/company-appointment | public lookup — low value | HIGH |
| IB-13 | FULLY_API | State-specific JIT rules may still trigger portal/e-app UI | https://agentsync.io/integrated-producer-compliance | AgentSync JIT appointments | MED |

**Insurance kill summary:** 6 FULLY_API, 4 PARTIAL, 3 NO_PATH_FOUND. Surface fails via **intermediary**, not via empty rails.

---

## 4) Regulatory & government filing portals — task verdicts

**Surface durability: ALREADY_SOLVED** for high-volume tax transmission. Kill citation: IRS MeF IFA + A2A ([MeF overview](https://www.irs.gov/e-file-providers/modernized-e-file-overview), accessed 2026-07-25). SAM Entity Management API is **read** ([GSA](https://open.gsa.gov/api/entity-api/)); USPTO ODP is data APIs ([ODP](https://data.uspto.gov/apis/getting-started)).

| task_id | verdict | browser_bound_substeps | evidence_urls | search_queries_or_sections | confidence |
| --- | --- | --- | --- | --- | --- |
| GF-01 | FULLY_API | — | https://www.irs.gov/e-file-providers/modernized-e-file-overview ; https://www.irs.gov/e-file-providers/modernized-e-file-mef-user-guides-and-publications | MeF A2A/IFA | HIGH |
| GF-02 | NO_PATH_FOUND | e-Services enrollment / MeF authority management UI | https://www.irs.gov/e-file-providers/modernized-e-file-mef-user-guides-and-publications | provider enrollment browser | MED |
| GF-03 | NO_PATH_FOUND | SAM entity registration write in portal | https://open.gsa.gov/api/entity-api/ | Searched: `SAM.gov entity update API registration write` — entity-api documents retrieval; no self-service write registration API found this pass | MED |
| GF-04 | NO_PATH_FOUND | Banking / POC updates in SAM portal | https://open.gsa.gov/api/entity-api/ | same write search | MED |
| GF-05 | PARTIAL | PDF download UX vs API fields for reps & certs data | https://open.gsa.gov/api/entity-api/ | entity read APIs | MED |
| GF-06 | FULLY_API | — | https://open.gsa.gov/api/entity-api/ | Entity Management API key search | HIGH |
| GF-07 | NO_PATH_FOUND | Patent Center filing/upload UI | https://data.uspto.gov/home | Searched: `Patent Center filing API machine interface`; ODP ≠ Patent Center filing | MED |
| GF-08 | FULLY_API | — | https://data.uspto.gov/apis/getting-started | USPTO ODP APIs | HIGH |
| GF-09 | NO_PATH_FOUND | State SOS annual report form UI (no unified national API) | — | Searched: `unified state annual report filing API USA` — per-state variance; no national path found | MED |
| GF-10 | NO_PATH_FOUND | State license renewal portal | — | Searched: `state professional license renewal API standard` — no universal path found | LOW |
| GF-11 | NO_PATH_FOUND | FOIA submit UI | — | Searched: `federal FOIA portal submit API` — no universal path found | LOW |
| GF-12 | NO_PATH_FOUND | Login.gov / identity proofing | — | trust-boundary once-ish | MED |

**Government kill summary:** 3 FULLY_API, 1 PARTIAL, 8 NO_PATH_FOUND. **Do not confuse residue count with surface durability** — MeF intermediary + A2A kills the high-frequency filing wedge; remaining tasks are enrollment, identity, and rare entity writes (frequency death + counsel hard-stop).

---

## 5) Vendor security questionnaires / trust portals — task verdicts

**Surface durability: ALREADY_SOLVED** (intermediary category kill). Kill citation: Vanta states third-party portals lacked spreadsheet export, so they shipped a Chrome extension that extracts/injects into arbitrary web forms ([Vanta engineering](https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension), accessed 2026-07-25). SafeBase extension targets the same portals ([Chrome Web Store](https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm)). Buyer OneTrust Submit Responses is **tenant** API ([OneTrust](https://developer.onetrust.com/onetrust/reference/submitresponsesusingpost)) — not seller respondent credentials.

| task_id | verdict | browser_bound_substeps | evidence_urls | search_queries_or_sections | confidence |
| --- | --- | --- | --- | --- | --- |
| SQ-01 | PARTIAL | Invited vendor still opens portal UI; **no seller-facing OneTrust respondent API found**; intermediaries autofill DOM | https://developer.onetrust.com/onetrust/reference/submitresponsesusingpost ; https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension | Searched: `OneTrust vendor respondent API submit assessment answers` — NO_PATH_FOUND for seller keys; tenant Submit Responses exists | HIGH |
| SQ-02 | PARTIAL | Vendor portal fill; buyer Table API ≠ seller submit | https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html ; https://wolfia.com/products/chrome-extension | ServiceNow vendor respondent public API — NO_PATH_FOUND | MED |
| SQ-03 | PARTIAL | Extension scan/approve/fill is still browser DOM labor — productized by Vanta | https://help.vanta.com/en/articles/11345450-completing-website-questionnaires-with-the-browser-extension | QAuto extension workflow | HIGH |
| SQ-04 | PARTIAL | Same — SafeBase autofill | https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm | portal autofill | HIGH |
| SQ-05 | PARTIAL | Hosted questionnaire UI; Drata buyer APIs for send/list | https://help.drata.com/en/articles/13557330-create-and-manage-vendor-questionnaires ; https://developers.drata.com/openapi/reference/v2/tag/Vendor-Security-Reviews/ | seller submit API vs email link UI | HIGH |
| SQ-06 | NO_PATH_FOUND | Visitor auth + NDA + gated download | https://docs.conveyor.com/docs/trust-center-agent | trust-center visitor gating | HIGH |
| SQ-07 | PARTIAL | Conveyor job API with `original_format=portal`; external portal still filled | https://docs.conveyor.com/reference/post-questionnaires | portal_url enum | MED |
| SQ-08 | NO_PATH_FOUND | Start security review in Vanta UI | https://developer.vanta.com/docs/guides/create-vendors-and-attach-documentation | Vanta docs: no API to start security review | HIGH |
| SQ-09 | NO_PATH_FOUND | Attach link evidence in Vanta UI | https://developer.vanta.com/docs/guides/create-vendors-and-attach-documentation | no API for link evidence | HIGH |
| SQ-10 | FULLY_API | — | https://docs.safebase.io/reference/approverequest-1 | approve access request API | HIGH |
| SQ-11 | PARTIAL | Whistic profile UI vs Public API for vendors/docs | https://whistichelp.zendesk.com/hc/en-us/articles/34384536988311-Getting-Started-with-the-Whistic-Public-API | Whistic Public API scope vs Basic Profile UI | LOW |
| SQ-12 | PARTIAL | GRX Exchange respondent UI; portfolio API V2 is for customers | https://processunity.zendesk.com/hc/en-us/articles/34049522336283-API-V2-User-Guide | Searched: `ProcessUnity GRX third party submit assessment API respondent` — NO_PATH_FOUND | MED |

**Security questionnaires kill summary:** 1 FULLY_API, 8 PARTIAL, 3 NO_PATH_FOUND. **Surface still dies:** seller labor is already owned by QAuto vendors (intermediary = customer flip). Spreadsheet SIG remains non-browser (Shared Assessments Excel workflow) — shrinks portal-only TAM further ([Shared Assessments how-to PDF](https://sharedassessments.org/wp-content/uploads/sa-uploads/2024/07/240623-how-to-append-v023.pdf)).

---

## 6) Procurement & supplier onboarding — task verdicts

**Surface durability: ERODING.** Kill citation for high-frequency post-onboarding: Coupa cXML `InvoiceDetailRequest` HTTPS post ([Coupa cXML invoices](https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/features-and-processes-in-the-coupa-supplier-portal/invoices/cxml-invoices), accessed 2026-07-25; page last updated 2026-07-17 per Coupa). SAP Business Network documents cXML/EDI supplier integration for PO/invoice ([SAP Learning](https://learning.sap.com/courses/sap-ariba-integration-sap-ariba-integration-points/discovering-ariba-network-integrations)). Buyer invite APIs do **not** complete supplier SIM ([Coupa supplier_invites](https://compass.coupa.com/en-us/products/product-documentation/suppliers/supplier-integration-resources/api-endpoint-for-supplier-csp-invites)).

| task_id | verdict | browser_bound_substeps | evidence_urls | search_queries_or_sections | confidence |
| --- | --- | --- | --- | --- | --- |
| PO-01 | NO_PATH_FOUND | Accept invite email; create CSP account; verify code | https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/methods-to-register-in-the-csp | Searched: `Coupa Supplier Portal API submit SIM questionnaire`; `supplier self-service Coupa onboarding REST API` — NO_PATH_FOUND | HIGH |
| PO-02 | NO_PATH_FOUND | Legal entity / tax / payment method first-time onboarding UI | https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/complete-the-csp-onboarding | same | HIGH |
| PO-03 | NO_PATH_FOUND | Buyer Information Request / SIM submit | https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/reference-data-resources/supplier-information-api-supplier_information | Buyer `supplier_information` API ≠ supplier write | HIGH |
| PO-04 | NO_PATH_FOUND | Self-register at supplier.coupahost.com | https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/methods-to-register-in-the-csp | public signup UI | HIGH |
| PO-05 | NO_PATH_FOUND | SAP BN account from invitation | https://help.sap.com/doc/d8afd4f3a8c2451c920f7dec9358621a/cloud/en-US/ANQuickStart.pdf | supplier account UI | HIGH |
| PO-06 | NO_PATH_FOUND | Buyer Ariba registration questionnaire | https://www.abbvie.com/content/dam/abbvie-com2/pdfs/suppliers/supplier-onboarding-user-guide.pdf | Searched: `Ariba Network supplier API complete registration questionnaire` — NO_PATH_FOUND | HIGH |
| PO-07 | NO_PATH_FOUND | Remittance/bank settings UI | https://www.allianzgi.com/-/media/allianzgi/globalagi/ariba-supplier-portal/ariba-network-supplier-onboarding-user-guide-v2.pdf | bank settings | MED |
| PO-08 | NO_PATH_FOUND | Tax info under Electronic Invoice Routing | https://www.allianzgi.com/-/media/allianzgi/globalagi/ariba-supplier-portal/ariba-network-supplier-onboarding-user-guide-v2.pdf | tax UI | MED |
| PO-09 | NO_PATH_FOUND | Jaggaer university portal registration | https://www.bgsu.edu/purchasing/vendor-onboarding.html | Searched lightly: `Jaggaer supplier registration API` — NO_PATH_FOUND | MED |
| PO-10 | FULLY_API | Supplier still completes CSP UI after invite | https://compass.coupa.com/en-us/products/product-documentation/suppliers/supplier-integration-resources/api-endpoint-for-supplier-csp-invites | buyer invite API | HIGH |
| PO-11 | FULLY_API | Supplier questionnaire still browser | https://help.sap.com/doc/56b8a389fe0249afaacc4d44fa95c449/cloud/en-US/supplier_invite_api.pdf | SAP Supplier Invite API | HIGH |
| PO-12 | NO_PATH_FOUND | MFA enrollment prompt | https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/complete-the-csp-onboarding | MFA UI | MED |
| PO-13 | PARTIAL | Profile updates in CSP; sophisticated suppliers may sync master data via ERP/cXML after trading relationship exists | https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/features-and-processes-in-the-coupa-supplier-portal/invoices/cxml-invoices ; https://learning.sap.com/courses/sap-ariba-integration-sap-ariba-integration-points/discovering-ariba-network-integrations | cXML for transactions ≠ full profile write API found | MED |

**Procurement kill summary:** 2 FULLY_API (buyer contrast), 1 PARTIAL, 10 NO_PATH_FOUND. **Adversary honesty:** supplier SIM/KYC forms survive the API hunt. **Surface still ERODING/killed as high-frequency anchor** because (1) invoice/PO labor has cXML, (2) BPO intermediaries exist, (3) onboarding frequency is per-buyer relationship not daily ops, (4) tax/bank recording is a hard privacy kill for browser agents.

---

## Kill counts (roll-up)

| Metric | Count |
| --- | --- |
| Surfaces attacked | 6 |
| Surfaces killed (ALREADY_SOLVED or ERODING structural) | **6** |
| Surfaces with DURABLE verdict | **0** |
| Tasks total | **75** |
| Tasks FULLY_API (killed list + tables) | **30** listed in “Tasks I killed”; tables also mark additional FULLY_API consistent with that list |
| Tasks PARTIAL | **20** (approx across tables) |
| Tasks NO_PATH_FOUND | **25** (approx across tables) |

Exact per-table tallies:

| Surface | FULLY_API | PARTIAL | NO_PATH_FOUND | Surface verdict |
| --- | --- | --- | --- | --- |
| healthcare (13) | 9 | 2 | 2 | ALREADY_SOLVED |
| freight (12) | 9 | 1 | 2 | ALREADY_SOLVED |
| insurance (13) | 6 | 4 | 3 | ALREADY_SOLVED |
| government (12) | 3 | 1 | 8 | ALREADY_SOLVED |
| security Q (12) | 1 | 8 | 3 | ALREADY_SOLVED |
| procurement (13) | 2 | 1 | 10 | ERODING |
| **Total (75)** | **30** | **17** | **28** | — |

---

## Structural finding (adversary, not adjudication)

Week-0 finding recycled: **high-frequency labor attracts rails or intermediaries.** Counterparty shape (PASS on scouts) does **not** imply durable browser-only absence. In healthcare/freight/government, the **portal owner or regulator already built EDI/API**. In insurance/security questionnaires/procurement transactions, **a third party already sells absorption** — and when the laborer buys that third party, the pivot collapses into the observability kill mode.

NO_PATH_FOUND residue concentrates in: identity/MFA, once-per-relationship KYC/SIM, LMS modules, FOIA/state forms, secure messages, trust-center visitor gating. That is **not** a product wedge for near-zero-token replay of weekly production work.

**CONFIDENCE: HIGH** on the structural pattern; **MED** on whether any single NO_PATH_FOUND task could still be a niche design-partner experiment (C5’s job).

---

## Searches run (representative; not exhaustive)

Healthcare: `CMS-0057-F prior authorization API`, `HIPAA ASC X12N 278`, `CAQH CORE 270/271 276/277`, `Availity Service Reviews API`, `Availity Digital Correspondence Hub API`, `Da Vinci DTR Questionnaire`.  
Freight: `EDI 204 990 214`, `FedEx Track API`, `AES EDI Bulk Upload AESTIR X12 601`, `Opendock appointment API`, `regional LTL carrier public booking API`, `carrier freight invoice dispute API`.  
Insurance: `AgentSync ProducerSync API`, `SureLC public API documentation`, `NIPR company appointment`.  
Government: `IRS MeF A2A`, `SAM.gov entity update API registration write`, `unified state annual report filing API USA`, `Patent Center filing API`, `federal FOIA portal submit API`.  
Security: `OneTrust vendor respondent API`, `ProcessUnity GRX third party submit assessment API respondent`, `Vanta questionnaire automation browser extension`, `Shared Assessments SIG`.  
Procurement: `Coupa Supplier Portal API submit SIM`, `Ariba Network supplier API complete registration questionnaire`, `Coupa cXML invoices`, `cXML punchout Ariba`.

---

## Open questions / what I could not verify

- Exact % of US EEI filings via AESDirect click-path vs EDI/certified software — Census documents methods; **no percentage claimed** (searched AES intro + related; not found).
- Full Availity Auth Attachments payer coverage matrix — API exists; coverage completeness **not verified**.
- Public SureLC / SuranceBay agency API — **NO_PATH_FOUND** (searched: `SureLC public API documentation`, `SuranceBay API reference`).
- Whether any buyer TPRM vendor will ship a universal seller-respondent submit API in ≤36 months — not claimed either way.
- Authoritative GSA statement that SAM entity **write** will never be public API — write absence is “no path found,” not proof of impossibility.
- Per-state SOS annual-report bulk/XML inventory — not completed this pass.
- Change Healthcare / Optum clearinghouse API depth post-outage — pointed by scout; not re-censused here beyond Availity primary docs.
- Live Coupa CSP Supplier REST write scope for Business Profile after onboarding — invoices docs mention retrieve APIs; full write census incomplete.
