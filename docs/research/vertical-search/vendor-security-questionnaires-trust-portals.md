---
title: "Surface scout ΓÇö Vendor security questionnaires / trust portals"
doc_type: research
status: draft
owner: C1
surface_slug: vendor-security-questionnaires-trust-portals
created: 2026-07-24
updated: 2026-07-24
confidence: MED
supersedes: null
sources_verified: true
access_date: 2026-07-24
related: docs/research/census-week0/A7-backup.md
---

# Surface A ΓÇö Vendor security questionnaires / trust portals

**Role:** C1 surface scout (enumeration + pivot tests 1ΓÇô3 only; no scoring).  
**Access date for all evidence URLs below unless a row overrides:** 2026-07-24  
**Lane:** Seller-side labor on buyer-owned / buyer-licensed portals and on seller-hosted trust centers (visitor flows). Buyer-side TPRM inventory CRUD is out of primary scope (already API-heavy per Week-0 A7).

`initial_browser_only_guess` is a **hypothesis for C4 to attack**, not a verdict.

---

## Pivot tests 1ΓÇô3 (explicit)

### 1) COUNTERPARTY TEST ΓÇö **PASS**

| Role | Who | Evidence |
| --- | --- | --- |
| Owns / licenses the assessment portal | Enterprise **buyer** (or their TPRM SaaS: OneTrust, Whistic Assess, ProcessUnity GRX, ServiceNow TPRM, custom HTML) | Buyer launches assessments / TPM workflows; OneTrust Assessments APIs are tenant APIs for the licensee ([Launch Assessment](https://developer.onetrust.com/onetrust/reference/createassessmentusingpost_1)) |
| Pays for the portal SaaS | Same buyer / TPRM licensee | OneTrust developer docs address the customer tenant; Vanta Manage API guides are ΓÇ£for Vanta admins managing data inside their own Vanta accountΓÇ¥ ([Vanta create vendors guide](https://developer.vanta.com/docs/guides/create-vendors-and-attach-documentation)) |
| Does the repetitive fill labor | **Seller** GRC / security / sales-eng answering inbound questionnaires | Vanta: customers receive questionnaires via third-party vendor portals and must work in those UIs ([Vanta engineering post](https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension)); SafeBase Chrome extension marketed to teams responding in vendor portals ([Chrome Web Store](https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm)) |

**PASS reason:** Laborer (seller respondent) is not the buyer of the buyerΓÇÖs TPRM / assessment SaaS. Roadmap and API investment follow the **paying licensee** (buyer), not the invited vendor. CONFIDENCE: **HIGH** for portal-fill wedge; **MED** for seller-owned trust-center *admin* tasks (there the seller *is* the SaaS customer ΓÇö see failure modes).

### 2) DURABILITY TEST ΓÇö **PASS** (portal-fill wedge)

**One sentence:** Buyer-side TPRM vendors keep optimizing APIs and UX for the **paying assessor**; they have no durable commercial reason to ship a universal, authenticated ΓÇ£any invited vendor may POST answers into any buyer tenantΓÇ¥ API that would bypass buyer-controlled workflows, so sellers remain stuck in per-portal UIs (or in browser extensions that treat those UIs as the integration surface).

Grounding: VantaΓÇÖs own engineering write-up states third-party portals **lacked spreadsheet export**, forcing a Chrome extension that extracts and injects into arbitrary web forms ([source](https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension)). OneTrust publishes tenant Assessment APIs including **Submit Responses** ([source](https://developer.onetrust.com/onetrust/reference/submitresponsesusingpost)) ΓÇö that is capability for the **tenant**, not evidence that invited external sellers receive API credentials. No public ΓÇ£seller respondent API for arbitrary buyer OneTrust tenantsΓÇ¥ path found (searched: `OneTrust vendor respondent API submit assessment answers`, `OneTrust external vendor API key assessment responses`). CONFIDENCE: **HIGH** that buyer APIs Γëá seller access; **MED** that this asymmetry persists three years (competitive pressure could add exchange formats; absence of evidence Γëá proof it never will).

**FAIL if scoped as ΓÇ£TPRM platforms have no APIsΓÇ¥** ΓÇö false; buyer platforms are heavily APIΓÇÖd (see A7 / task table caveats).

### 3) MULTIPLICITY TEST ΓÇö **PASS** (with thin primary data)

**Question:** How many distinct portal **instances** does one seller-side worker face per year?

| Signal | What it supports | Confidence | Evidence |
| --- | --- | --- | --- |
| Volume scales with enterprise deal / renewal count | More buyers ΓåÆ more distinct intake formats (portal vs spreadsheet vs custom form) | MED (vendor blogs, not measured telemetry) | Mid-market SaaS ΓÇ£50 to 200 questionnaires per yearΓÇ¥ claimed ([ComplyAlways](https://complyalways.com/blog/what-is-a-vendor-security-questionnaire)); growth-stage ΓÇ£10 to 20 questionnaires per monthΓÇ¥ claimed ([Agency Insights](https://blog.getagency.com/articles/security-compliance-questionnaires)); one anecdote ΓÇ£43 questionnairesΓÇ¥ in 2025 ([Moonpool](https://moonpool.ai/resources/blog/internal-support/security-team-vendor-questionnaire-40-times)) |
| Format heterogeneity | Distinct *systems*, not just copies of one form | HIGH that portals are a first-class distinct class | Vanta QAuto: portals lacked export; extension for ΓÇ£embedded portals, custom HTML forms, and arbitrary web interfacesΓÇ¥ ([Vanta](https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension)); Vanta pricing lists ΓÇ£Browser extension for portals and documentsΓÇ¥ ([Vanta pricing](https://www.vanta.com/pricing)) |
| Competing autofill products list multiple portal brands | Worker hops across OneTrust / Whistic / ProcessUnity / etc. | MED | SafeBase extension: autofill in supported portals ([Chrome Web Store](https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm)); FillBase markets portal autofill ([FillBase](https://fillbase.app/features/portal-autofill)) |

**PASS reason:** Multiplicity is driven by **many buying orgs ├ù heterogeneous intake systems**, not by one vendor console. **No primary org-telemetry count of distinct portal hostnames per worker found** (searched: `how many security questionnaire portals per year vendor`, `distinct TPRM portals per seller`). Treat numeric volume claims as **secondary / marketing** ΓÇö do not promote them to Paragent metrics. CONFIDENCE: **MED** on PASS; **LOW** on any specific N.

---

## Landscape (seller-relevant)

| Platform | Side | Public API note (cited) | Browser-bound pressure (cited) |
| --- | --- | --- | --- |
| OneTrust TPM / Assessments | Buyer tenant | Launch / list / submit-responses APIs for tenant ([Launch](https://developer.onetrust.com/onetrust/reference/createassessmentusingpost_1); [Submit Responses](https://developer.onetrust.com/onetrust/reference/submitresponsesusingpost)) | Seller completion targeted by portal-fill extensions ([SafeBase](https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm); [Vanta help](https://help.vanta.com/en/articles/11345450-completing-website-questionnaires-with-the-browser-extension)) |
| Vanta | Seller QAuto + buyer TPRM | Manage Vanta API for vendors/docs; **no API to start security review**; **no API for link evidence** ([guide](https://developer.vanta.com/docs/guides/create-vendors-and-attach-documentation)) | Purpose-built portal Chrome extension ([engineering](https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension); [help](https://help.vanta.com/en/articles/11345450-completing-website-questionnaires-with-the-browser-extension)) |
| SafeBase / Drata | Seller trust + Q | SafeBase REST for access requests ([docs.safebase.io](https://docs.safebase.io/reference/getrequests-1)); Drata questionnaire APIs for buyer send/list ([Drata OpenAPI](https://developers.drata.com/openapi/reference/v1/tag/Questionnaires/)) | Chrome extension for portal autofill ([Chrome Web Store](https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm)); vendor questionnaire via email secure link UI ([Drata help](https://help.drata.com/en/articles/13557330-create-and-manage-vendor-questionnaires)) |
| Conveyor | Seller trust + Q | Questionnaires API includes `original_format` enum with `portal` + `portal_url` ([Conveyor API](https://docs.conveyor.com/reference/post-questionnaires)) | Trust Center Agent requires visitor auth + NDA ([docs](https://docs.conveyor.com/docs/trust-center-agent)) |
| Whistic | Dual-sided | Public API for vendors/docs/reporting ([Getting Started](https://whistichelp.zendesk.com/hc/en-us/articles/34384536988311-Getting-Started-with-the-Whistic-Public-API)) | Free Basic Profile for trust-center sharing ([Whistic blog](https://www.whistic.com/resources/blog/how-to-get-the-most-out-of-your-free-whistic-basic-profile)) |
| ProcessUnity GRX | Buyer / exchange | GRX API V2 for portfolio customers ([API V2 guide](https://processunity.zendesk.com/hc/en-us/articles/34049522336283-API-V2-User-Guide)) | Listed as portal-fill target by third-party tools ([SafeBase listing](https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm)). No third-party respondent submit API found (searched: `ProcessUnity GRX third party submit assessment API respondent`) |

---

## Task table (12)

| task_id | one_line_description | ui_steps_est | observable_end_state | initial_browser_only_guess | evidence_urls | access_date | confidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SQ-01 | As invited vendor, open buyer OneTrust assessment link, answer questions, submit | 10ΓÇô15 | Assessment shows submitted/complete to buyer | Y | https://developer.onetrust.com/onetrust/reference/createassessmentusingpost_1 ; https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm ; https://fillbase.app/features/portal-autofill | 2026-07-24 | HIGH |
| SQ-02 | Complete ServiceNow TPRM / SVDP vendor questionnaire in vendor portal | 10ΓÇô15 | Questionnaire complete / visible to buyer | Y | https://www.servicenow.com/community/new-vendor-risk-customers-forum/vendor-risk-management-apis/m-p/2566407 ; https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html ; https://wolfia.com/products/chrome-extension | 2026-07-24 | MED |
| SQ-03 | Scan buyer portal with Vanta QAuto extension; approve answers; fill back into portal | 12ΓÇô15 | Portal fields populated; questionnaire tracked in Vanta | Y | https://help.vanta.com/en/articles/11345450-completing-website-questionnaires-with-the-browser-extension ; https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension | 2026-07-24 | HIGH |
| SQ-04 | Autofill supported portal (OneTrust/Whistic/ProcessUnity/etc.) via SafeBase extension | 10ΓÇô15 | Answers filled in portal; optional sync to SafeBase | Y | https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm | 2026-07-24 | HIGH |
| SQ-05 | Vendor opens Drata questionnaire email link and submits in hosted UI | 8ΓÇô12 | Buyer sees completed responses on security review | Y | https://help.drata.com/en/articles/13557330-create-and-manage-vendor-questionnaires ; https://developers.drata.com/openapi/reference/v2/tag/Vendor-Security-Reviews/ | 2026-07-24 | HIGH |
| SQ-06 | Trust-center visitor: authenticate, sign NDA if required, download gated doc / ZIP | 6ΓÇô10 | Doc downloaded; interaction subject to gating rules | Y | https://docs.conveyor.com/docs/trust-center-agent | 2026-07-24 | HIGH |
| SQ-07 | Create Conveyor questionnaire job with `original_format=portal` then complete external portal | 8ΓÇô12 | Conveyor record exists; portal answers submitted externally | ? | https://docs.conveyor.com/reference/post-questionnaires | 2026-07-24 | MED |
| SQ-08 | Start Vanta vendor security review from Vendor page (after auto-create) | 5ΓÇô8 | Security review state = started / in progress | Y | https://developer.vanta.com/docs/guides/create-vendors-and-attach-documentation | 2026-07-24 | HIGH |
| SQ-09 | Attach link (URL) evidence to a Vanta vendor record | 4ΓÇô7 | Link evidence visible on vendor record | Y | https://developer.vanta.com/docs/guides/create-vendors-and-attach-documentation | 2026-07-24 | HIGH |
| SQ-10 | Approve SafeBase Trust Center access request | 5ΓÇô8 | Request approved; requester can access | N | https://docs.safebase.io/reference/getrequests-1 ; https://docs.safebase.io/reference/approverequest-1 | 2026-07-24 | HIGH |
| SQ-11 | Publish / update Whistic Basic Profile docs and share with a customer | 8ΓÇô12 | Docs on profile; share granted / detail view used | ? | https://www.whistic.com/resources/blog/how-to-get-the-most-out-of-your-free-whistic-basic-profile ; https://whistichelp.zendesk.com/hc/en-us/articles/34384536988311-Getting-Started-with-the-Whistic-Public-API | 2026-07-24 | LOW |
| SQ-12 | Respond to ProcessUnity GRX third-party assessment share in Exchange UI | 10ΓÇô15 | Assessment/request status complete for requesting portfolio | ? | https://processunity.zendesk.com/hc/en-us/articles/34049522336283-API-V2-User-Guide ; https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm | 2026-07-24 | MED |

**Guess tally:** Y=8, N=1, ?=3.

---

## Test-bed feasibility ΓÇö brutal honesty

| Path | Feasible? | Notes | Evidence |
| --- | --- | --- | --- |
| Self-serve seller trust center | Partial | Whistic Basic Profile (free, 3 detail shares/month per Whistic marketing); SafeBase/Drata Foundation / free-tier trust center claims in third-party roundups ΓÇö confirm live entitlements on signup | https://www.whistic.com/resources/blog/how-to-get-the-most-out-of-your-free-whistic-basic-profile ; https://safebase.io/pricing |
| Self-serve **buyer** portal where we are the invited vendor | Hard | Requires a real buyer tenant invite (OneTrust / Whistic Assess / ProcessUnity / ServiceNow). No public ΓÇ£play as vendor respondent in sandbox OneTrustΓÇ¥ path found (searched: `OneTrust vendor portal sandbox demo respondent`, `Whistic Assess free trial vendor respondent`) | ΓÇö |
| Extension-only dry run | Misleading | Vanta/SafeBase/Conveyor extensions need paid seller accounts + a live third-party portal page | https://help.vanta.com/en/articles/11345450-completing-website-questionnaires-with-the-browser-extension ; https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm |
| Spreadsheet SIG/CAIQ only | Easy but wrong wedge | Standards are often Excel; that fails the browser-portal thesis | Shared Assessments / CSA materials referenced in secondary blogs ([Agency](https://blog.getagency.com/articles/security-compliance-questionnaires)) ΓÇö verify primary if locking |

**Verdict:** Trust-center **visitor gating** (SQ-06) is the most plausible self-serve slice if we host our own Conveyor/Whistic/SafeBase free profile. **Inbound portal fill** (SQ-01ΓÇô05) needs a design partner with real buyer invites or a synthetic buyer tenant we control (then we stop being the counterparty ΓÇö measurement bias). CONFIDENCE: **HIGH**.

---

## Buyer and budget

| Buyer of automation / trust tooling | What they buy today | Cited spend signal | Confidence |
| --- | --- | --- | --- |
| Seller GRC / customer-trust / sales-eng leadership | Questionnaire automation + trust center (Vanta, Conveyor, SafeBase/Drata, Whistic, HyperComply, Loopio-class tools) | Vanta publishes **no dollar prices**; Plus includes AI QAuto **25/year**, Professional **144/year**; browser extension listed under QAuto features ([Vanta pricing](https://www.vanta.com/pricing)) | HIGH on packaging; **no official $** |
| Same | Conveyor Professional | Conveyor comparison post: Professional ΓÇ£starting at $4,800ΓÇ¥ with questionnaire credits (10 credits ├ù 100 questions in base version described) ([Conveyor blog](https://www.conveyor.com/blog/conveyor-vs-vanta-vs-drata-for-security-questionnaire-automation)) | MED (vendor-authored comparison) |
| Same | SafeBase / Drata Trust Center | SafeBase pricing page shows Foundation / Standard tiers; Foundation includes branded Trust Center ([safebase.io/pricing](https://safebase.io/pricing)); dollar amounts often ΓÇ£contact salesΓÇ¥ | MED |
| Third-party estimate blogs | Vanta annual platform | Third-party estimates exist (e.g. checkthat.ai citing other blogs) ΓÇö **do not treat as fact** without invoice evidence | LOW |

**Who signs:** Typically seller-side Head of Security / GRC / RevOps-adjacent trust; budget sits in compliance / GRC SaaS line items adjacent to SOC 2 tooling. CONFIDENCE: **MED** (inferred from product packaging, not procurement interviews).

---

## REGULATORY OVERLAY ΓÇö FLAG

- **US banking third-party risk:** Federal banking agenciesΓÇÖ *Interagency Guidance on Third-Party Relationships: Risk Management* (OCC/FDIC/FRB, 2023) expects due diligence and ongoing monitoring of third parties ([OCC PDF](https://www.occ.treas.gov/news-issuances/news-releases/2023/nr-ia-2023-53a.pdf); [FDIC FIL-29-2023](https://www.fdic.gov/news/financial-institution-letters/2023/fil23029.html); [Fed SR 23-4 attachment](https://www.federalreserve.gov/supervisionreg/srletters/SR2304a1.pdf)). This **drives buyer demand for questionnaires**; it does not authorize seller automation.
- **Data in flight:** Portal fills and trust-center downloads routinely include SOC 2 reports, architecture, subprocessors, and sometimes customer-specific commitments ΓÇö high sensitivity for browser-agent recording / replay.
- **Do not** store credentials, cookies, session state, or portal screenshots with customer content in-repo (Wave hard rule 6).

---

## Why this surface might fail

1. **Contested niche:** Multiple funded products already ship portal autofill extensions (Vanta, SafeBase, Conveyor, FillBase, Wolfia, HyperComply, Loopio SmartFill ΓÇö Chrome Web Store adjacency). Demand is validated; differentiation for a generic replay layer is unclear without interviews.
2. **Buyer APIs erode the wrong thesis:** OneTrust Submit Responses and peer tenant APIs will be used by C4 to attack ΓÇ£browser-onlyΓÇ¥ guesses if the design partner *is* the OneTrust customer rather than the invited vendor.
3. **Format split:** Large share of work remains spreadsheet (SIG/CAIQ/custom XLSX). Browser replay only covers the portal/long-tail HTML slice ΓÇö size of that slice is **unmeasured** here.
4. **Trust-center admin is not counterparty:** Automating the sellerΓÇÖs own SafeBase/Vanta admin console fails Test 1 the same way observability failed.
5. **Test-bed / ToS:** Operating agents inside third-party buyer portals without written consent risks ToS and confidentiality breaches; free trust centers only cover visitor flows.
6. **Judgment-heavy answers:** Many questions need SME review; pure replay of prior trajectories may fail correctness even when UI steps succeed.

---

## Open questions / what I could not verify

- Exact annual count of **distinct portal hostnames** per seller GRC FTE (no primary telemetry found).
- Whether any buyer TPRM vendor plans a **seller-facing** open submission API / exchange standard in the next 36 months (not claimed either way).
- Live entitlements on SafeBase Foundation vs paid QAuto after Drata packaging changes (pricing pages change; re-verify at signup).
- ServiceNow SVDP vendor questionnaire: community points to Table API for *buyer* integration; seller portal submit path still **NO_PATH_FOUND** for public vendor API (searched queries above).
- Fraction of inbound questionnaires that are portal vs spreadsheet vs email PDF in a real mid-market SaaS book of business.
