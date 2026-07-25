# A7 — Backup vertical: vendor security-review / TPRM portals

**Role:** Backup-vertical scout  
**Access date for all citations:** 2026-07-24  
**Selection rule applied:** Prefer tasks that are high-frequency, browser-only even with full API/Terraform access, and measurable in a 14-day protocol.

---

## 1. Platform landscape (strongest 6)

| Platform | Category | Public API found? | What the API covers (cited) | Browser-bound pressure (cited) |
|---|---|---|---|---|
| **Vanta** | Compliance + vendor inventory + questionnaire automation | Yes — Manage Vanta API | Create vendors, attach documents, list security reviews per vendor ([developer.vanta.com guide](https://developer.vanta.com/docs/guides/create-vendors-and-attach-documentation)) | Official docs: security review must be **started from Vendor page** — “there's no API endpoint to start it”; link evidence cannot be attached via API ([same](https://developer.vanta.com/docs/guides/create-vendors-and-attach-documentation)). Separate Chrome extension exists specifically because customer portals lack spreadsheet export ([Vanta engineering post](https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension); [help center](https://help.vanta.com/en/articles/11345450-completing-website-questionnaires-with-the-browser-extension)). |
| **Drata / SafeBase** | Compliance + vendor reviews; SafeBase trust center | Yes — Drata OpenAPI; SafeBase REST | Vendors, vendor security reviews, send/upload questionnaires ([Drata Vendor Security Reviews](https://developers.drata.com/openapi/reference/v2/tag/Vendor-Security-Reviews/); [Questionnaires](https://developers.drata.com/openapi/reference/v1/tag/Questionnaires/)). SafeBase: accounts, access requests, approve/decline, NDA settings ([docs.safebase.io](https://docs.safebase.io/reference/getrequests-1); [approverequest](https://docs.safebase.io/reference/approverequest-1)). | SafeBase Chrome extension markets portal autofill into OneTrust, Whistic, ProcessUnity, etc. ([Chrome Web Store listing](https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm)). Vendor-facing questionnaire completion is via email secure link / UI ([Drata help](https://help.drata.com/en/articles/13557330-create-and-manage-vendor-questionnaires)). |
| **Conveyor** | Trust center + questionnaire automation (seller side) | Yes — Questionnaires, Trust Center, Knowledge Base APIs | `POST /questionnaires` with `original_format` enum including `portal`, plus `portal_url` / `notes` fields ([docs.conveyor.com](https://docs.conveyor.com/reference/post-questionnaires)); Trust Center Agent requires visitor auth + NDA ([Trust Center Agent docs](https://docs.conveyor.com/docs/trust-center-agent)). | Portal format is first-class in the API as a *pointer* to an external portal URL — filling that portal is outside Conveyor’s API surface (inferred from field design; CONFIDENCE: MED). Visitor NDA + login is browser UI ([same agent docs](https://docs.conveyor.com/docs/trust-center-agent)). |
| **Whistic** | TPRM + trust center | Yes — Public REST + Reporting GraphQL | Vendor create via intake form API; document upload; reporting ([Getting Started](https://whistichelp.zendesk.com/hc/en-us/articles/34384536988311-Getting-Started-with-the-Whistic-Public-API); [Creating Vendors](https://whistichelp.zendesk.com/hc/en-us/articles/37078996825879-Creating-Vendors-through-the-Whistic-Public-API); [Reporting API](https://whistichelp.zendesk.com/hc/en-us/articles/24005662759831-Whistic-Reporting-API)). Swagger at public.whistic.com. | Free Basic Profile exists for trust-center sharing ([Whistic blog](https://www.whistic.com/resources/blog/how-to-get-the-most-out-of-your-free-whistic-basic-profile)). Full TPRM buyer workflows: no public sandbox found (searched: “Whistic free trial sandbox demo account”); paid trials gated ([Vendor Monitoring free trial](https://whistichelp.zendesk.com/hc/en-us/articles/39891522124055-Getting-Started-with-Vendor-Monitoring-Free-Trial) notes paid-plan prerequisite). |
| **OneTrust** | Enterprise TPM / assessments | Yes — Assessments APIs | Launch assessment, get assessment, list assessments ([Launch Assessment](https://developer.onetrust.com/onetrust/reference/createassessmentusingpost_1); [Get Assessment](https://developer.onetrust.com/onetrust/reference/exportassessmentusingget); [API reference hub](https://developer.onetrust.com/onetrust/reference/onetrust-api-reference)). Third-Party Management product page describes questionnaire workflows ([onetrust.com TPM](https://www.onetrust.com/products/third-party-risk-management/)). | Buyer APIs exist; **vendor respondents** still complete assessments in OneTrust’s UI/portal. Multiple questionnaire-automation vendors (Vanta, SafeBase, FillBase, Wolfia) treat OneTrust as a primary portal-fill target ([Vanta help](https://help.vanta.com/en/articles/11345450-completing-website-questionnaires-with-the-browser-extension); [SafeBase Chrome listing](https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm); [FillBase portal autofill](https://fillbase.app/features/portal-autofill)). CONFIDENCE: HIGH that seller-side fill is browser; MED that buyer cannot do equivalent via API alone for every workflow. |
| **ProcessUnity (GRX)** | Enterprise TPRM / risk exchange | Yes — Global Risk Exchange API V2 | Portfolio third parties, requests, questionnaires, risk profiles, exports ([API V2 User Guide](https://processunity.zendesk.com/hc/en-us/articles/34049522336283-API-V2-User-Guide); [api.cybergrx.com](https://api.cybergrx.com/); [demo-api.cybergrx.com](https://demo-api.cybergrx.com/)). Credentials via ProcessUnity representative. | API is customer/portfolio oriented. Vendor-facing assessment completion in Exchange/portal UIs is repeatedly listed as a portal-fill target by third-party tools ([SafeBase Chrome listing](https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm); [Wolfia chrome extension](https://wolfia.com/products/chrome-extension)). No public self-serve sandbox found (searched: “ProcessUnity free trial sandbox public demo”). |

### Also checked (not in top-6 depth)

| Platform | API note | Source |
|---|---|---|
| **Bitsight** | Public REST ratings API (`api.bitsighttech.com`) | [API Documentation Overview](https://help.bitsighttech.com/hc/en-us/articles/231872628-API-Documentation-Overview) |
| **SecurityScorecard** | Developer Hub / Swagger | [API docs overview](https://support.securityscorecard.com/hc/en-us/articles/45146364886683-API-documentation-and-developer-resources); [Postman/Swagger](https://support.securityscorecard.com/hc/en-us/articles/27244857756571-Does-SSC-have-an-API-collection-file-to-be-used-with-Postman) |
| **Hyperproof** | REST Vendors API + questionnaires object list | [developer.hyperproof.app](https://developer.hyperproof.app/); [Using Hyperproof APIs](https://developer.hyperproof.app/api-details); [Vendors API](https://developer.hyperproof.app/hyperproof-api/vendors/vendors.openapi) |
| **TrustCloud** | REST API (controls/tests/evidence) | [TrustCloud API](https://community.trustcloud.ai/docs/trustcloud-api/); [Getting started](https://community.trustcloud.ai/docs/trustcloud-api/guides/getting-started/?lang=rest) |
| **Coupa** | Suppliers API + Risk Assess REST | [Suppliers API](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/reference-data-resources/suppliers-api-suppliers); [Risk Assess REST API](https://docs.coupa.com/en/developer-documentation/risk-assess-integrations/risk-assess-rest-api) |
| **ServiceNow TPRM/VRM** | No dedicated “VRM API” found; community guidance is Table API over TPRM tables; official Table API docs exist | [Community thread](https://www.servicenow.com/community/new-vendor-risk-customers-forum/vendor-risk-management-apis/m-p/2566407); [Table API](https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html); [TPRM data model](https://github.com/ServiceNow/ServiceNowDocs/blob/australia/markdown/governance-risk-compliance/third-party-risk-management/tprm-data-model.md). Vendor questionnaire portal issues appear in community (“Vendors Unable to View Questionnaires in TPRM SVDP Portal…”) — CONFIDENCE: MED that vendor portal is UI-bound. |

**Terraform:** No official Terraform provider found for Whistic, Conveyor, SafeBase, ProcessUnity GRX, or OneTrust TPM (searched: “Whistic Terraform provider”, “Conveyor Terraform provider”, “SafeBase Terraform provider”, “OneTrust Terraform provider registry”). Bitsight/SecurityScorecard are data APIs, not config-as-code surfaces. Absence of evidence ≠ absence — mark as **no Terraform provider found (searched queries above)**. CONFIDENCE: MED.

---

## 2. Who does the work, how often, how painful?

| Actor | Typical work | Frequency signal | Pain signal |
|---|---|---|---|
| **Seller / vendor security or GRC** (responding company) | Answer inbound SIG/CAIQ/custom questionnaires in buyer portals; upload SOC2/DPA; NDA into trust centers | Per enterprise deal / renewal / annual re-assessment — high for B2B SaaS that closes many enterprise logos | Entire product category of portal autofill extensions exists because portals “lacked spreadsheet export” ([Vanta](https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension)); SafeBase/Vanta/FillBase/Wolfia all sell this ([Chrome listings](https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm); [FillBase](https://fillbase.app/features/portal-autofill)) — CONFIDENCE: HIGH |
| **Buyer / TPRM analyst** | Intake vendor, launch assessment, review responses, score, remediate | Continuous in enterprises with large vendor inventories | Buyer platforms heavily API’d (OneTrust, Whistic, Drata, ProcessUnity GRX) — much of inventory/assessment launch is automatable; weaker fit for our selection rule — CONFIDENCE: HIGH |
| **Sales / customer trust** | Approve trust-center access, share docs, chase questionnaire completion | Deal-gated spikes | Overlaps seller portal pain; trust-center visitor NDA is browser ([Conveyor](https://docs.conveyor.com/docs/trust-center-agent)) — CONFIDENCE: MED |

**Implication for the selection rule:** The durable browser-only wedge is **seller-side portal questionnaire completion and trust-center visitor gating**, not buyer-side inventory CRUD.

---

## 3. Candidate task table

| task_id | vendor | task_name | one_line_description | ui_steps_est | observable_end_state | initial_browser_only_guess (Y/N/?) | why_guessed | evidence_urls | confidence |
|---|---|---|---|---|---|---|---|---|---|
| VR-01 | OneTrust (as buyer portal; seller fills) | Fill inbound TPM assessment in portal | As invited vendor, open OneTrust assessment link, answer questions, submit | 10–15 | Assessment status shows submitted/complete for vendor | Y | Buyer has Assessments API; seller completion targeted by portal-fill extensions; no public seller-submit API found (searched: “OneTrust vendor respondent API submit assessment answers”) | https://developer.onetrust.com/onetrust/reference/createassessmentusingpost_1 ; https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm ; https://fillbase.app/features/portal-autofill | HIGH |
| VR-02 | ServiceNow TPRM | Complete SVDP vendor questionnaire | As vendor user, log into ServiceNow vendor portal, answer questionnaire, submit | 10–15 | Questionnaire marked complete / visible to buyer | Y | Community treats VRM data via Table API for *buyer* integration; vendor portal questionnaire UX is separate UI; listed as portal-fill target | https://www.servicenow.com/community/new-vendor-risk-customers-forum/vendor-risk-management-apis/m-p/2566407 ; https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html ; https://wolfia.com/products/chrome-extension | MED |
| VR-03 | Vanta | Start vendor security review | After vendor auto-created by risk level, start the security review from Vendor page | 5–8 | Security review state = started/in progress | Y | Official Vanta docs: “review must be started from the Vendor page — there's no API endpoint to start it” | https://developer.vanta.com/docs/guides/create-vendors-and-attach-documentation | HIGH |
| VR-04 | Vanta | Attach link evidence to vendor | Add a URL (not file upload) as vendor evidence | 4–7 | Link evidence visible on vendor record | Y | Official docs: “You can't attach a link as evidence via the API today — use the Vendor page” | https://developer.vanta.com/docs/guides/create-vendors-and-attach-documentation | HIGH |
| VR-05 | Vanta | Fill customer portal questionnaire via browser | Scan portal questions, approve answers, fill fields back into buyer portal, mark complete | 12–15 | Portal fields populated; questionnaire marked complete in Vanta | Y | Purpose-built Chrome extension; MFA/login left to browser; multi-select/file still manual | https://help.vanta.com/en/articles/11345450-completing-website-questionnaires-with-the-browser-extension ; https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension | HIGH |
| VR-06 | Conveyor | Trust Center visitor: auth + NDA + download gated doc | Visitor verifies identity, signs NDA if required, downloads a gated document or ZIP of sources | 6–10 | Document downloaded; interaction logged | Y | Agent/docs require authentication and NDA before content access | https://docs.conveyor.com/docs/trust-center-agent | HIGH |
| VR-07 | Conveyor | Intake portal-format questionnaire job | Create questionnaire record with `original_format=portal`, store portal_url/notes, then complete work in that external portal | 8–12 | Conveyor questionnaire record exists; portal answers submitted externally | ? | API can *register* portal jobs; completion of the portal itself is separate — hybrid | https://docs.conveyor.com/reference/post-questionnaires | MED |
| VR-08 | Drata | Complete vendor questionnaire via secure email link | Vendor opens Drata questionnaire email link and submits answers in hosted UI | 8–12 | Buyer sees completed questionnaire responses on security review | Y | Help docs describe email link UI for vendors; API covers send/list/upload from buyer side | https://help.drata.com/en/articles/13557330-create-and-manage-vendor-questionnaires ; https://developers.drata.com/openapi/reference/v2/tag/Vendor-Security-Reviews/ | HIGH |
| VR-09 | SafeBase | Approve Trust Center access request (buyer/admin) | Review pending access request and approve with account association | 5–8 | Request status = approved; requester can access | N | Public API: get requests + approve request | https://docs.safebase.io/reference/getrequests-1 ; https://docs.safebase.io/reference/approverequest-1 | HIGH |
| VR-10 | SafeBase | Fill third-party portal with Chrome extension | In OneTrust/Whistic/ProcessUnity/etc., use SafeBase extension to detect questions and autofill | 10–15 | Portal answers filled; optionally synced to SafeBase | Y | Chrome Web Store: “Autofill answers in supported portals”; lists OneTrust, Whistic, ProcessUnity, Panorays | https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm | HIGH |
| VR-11 | ProcessUnity GRX | Respond to third-party assessment share/request in UI | As third party, complete assessment / share workflow presented in Exchange UI | 10–15 | Assessment/request status complete for requesting portfolio | ? | GRX API covers portfolio requests/reporting for customers; no public third-party respondent submit API found (searched: “ProcessUnity GRX third party submit assessment API respondent”); portal-fill tools list ProcessUnity | https://processunity.zendesk.com/hc/en-us/articles/34049522336283-API-V2-User-Guide ; https://demo-api.cybergrx.com/ ; https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm | MED |
| VR-12 | Whistic | Publish/update Trust Center profile docs for customer share | Upload security docs to profile and share/grant customer access via UI | 8–12 | Docs listed on profile; share granted to customer | ? | Public API covers vendor/doc ops for admins; free Basic Profile is UI-first; exact share/NDA browser-only boundary not fully mapped from public swagger without auth | https://whistichelp.zendesk.com/hc/en-us/articles/14823895118871-Integrations-API-Introduction ; https://www.whistic.com/resources/blog/how-to-get-the-most-out-of-your-free-whistic-basic-profile ; https://public.whistic.com (Swagger referenced in help) | LOW |

**Task count:** 12 documented (VR-01…VR-12). Of these, **8** are guessed **Y** browser-only (VR-01–06, VR-08, VR-10); **1** N (VR-09); **3** uncertain (VR-07, VR-11, VR-12).

---

## 4. One-page verdict

### Is this a credible pivot target?

**Conditionally yes — but only for a narrow wedge, not “TPRM platforms” as a whole.**

- **Strong wedge:** Seller-side **portal questionnaire fill** (VR-01, VR-02, VR-05, VR-08, VR-10) and **trust-center visitor NDA/doc access** (VR-06). These are repeatedly treated as browser-bound by vendors who already sell REST APIs for their *own* products — Vanta’s own engineering post states customer portals lacked spreadsheet export, forcing a Chrome extension ([source](https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension)). That is direct evidence the work fails the “competent engineer uses the API” escape hatch.
- **Weak as broad vertical:** Buyer-side inventory, ratings pulls, assessment launch, and document upload are well covered by public APIs across Vanta, Drata, Whistic, OneTrust, ProcessUnity GRX, Bitsight, SecurityScorecard, Coupa, Hyperproof, SafeBase, Conveyor (see §1). Anchoring on “manage vendors in OneTrust/Whistic” would likely fail the same API/IaC gate that threatens observability.
- **Competition note (not a score):** Multiple funded tools already automate portal fill (Vanta QAuto extension, SafeBase extension, FillBase, Wolfia, etc.). That validates demand; it also means we would be entering a contested niche rather than an empty one. CONFIDENCE: HIGH on demand signal; out of scope to score competitively here.

**Hour-decision recommendation:** Treat as **credible backup for the seller-portal-fill / trust-center-visitor slice only**. Do **not** treat “vendor risk platforms have no APIs” as the thesis — that claim is false on the evidence above.

### Single biggest obstacle to the 14-day measurement protocol

**Authenticated, invitation-gated test beds.**

Nearly all high-value Y tasks require either:

1. **Being invited as a vendor** into a buyer’s OneTrust / ServiceNow / ProcessUnity / Drata questionnaire instance, or  
2. **A paid customer tenant** (Vanta/Drata/Conveyor/Whistic admin) plus a second party acting as visitor/respondent.

Public free surfaces are thin:

- Whistic Basic Profile (limited trust-center) ([source](https://www.whistic.com/resources/blog/how-to-get-the-most-out-of-your-free-whistic-basic-profile))
- Public Conveyor/SafeBase trust centers as *visitor* (NDA/auth) — only covers VR-06-like flows, not portal questionnaires
- ProcessUnity/OneTrust enterprise sandboxes: **no public self-serve sandbox found** (searched: “OneTrust free trial sandbox TPM”, “ProcessUnity free trial sandbox”)
- Vanta/Drata trials typically require sales or existing account — not verified as instant self-serve for full vendor-security features in this pass (searched: “Vanta free trial vendor security”; no definitive public sandbox page found)

**Compared to observability:** Datadog/Grafana/Sentry-class tools offer developer-accessible trials; here the unit of work lives inside *another company’s* authenticated portal. **A vertical we cannot measure without a design partner is a poor 14-day pivot** unless that partner is already lined up.

**Bottom line:** Credible pivot **Y for the portal-fill wedge / N as an easy no-partner vertical**. Biggest obstacle: **design-partner-dependent, invitation-gated test beds** blocking the measurement protocol.

---

## 5. Source index (accessed 2026-07-24)

| URL | Used for |
|---|---|
| https://developer.vanta.com/docs/guides/create-vendors-and-attach-documentation | Vanta API + explicit UI-only gaps |
| https://developer.vanta.com/reference/manage-vanta/overview | Manage Vanta API existence |
| https://help.vanta.com/en/articles/11345450-completing-website-questionnaires-with-the-browser-extension | Portal fill extension workflow |
| https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension | Why portals force browser |
| https://developers.drata.com/openapi/reference/v2/tag/Vendor-Security-Reviews/ | Drata security review API |
| https://developers.drata.com/openapi/reference/v1/tag/Questionnaires/ | Drata questionnaires API |
| https://help.drata.com/en/articles/13557330-create-and-manage-vendor-questionnaires | Vendor email-link UI |
| https://docs.safebase.io/reference/getrequests-1 | SafeBase access requests API |
| https://docs.safebase.io/reference/approverequest-1 | SafeBase approve API |
| https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm | Portal autofill product claim |
| https://docs.conveyor.com/reference/post-questionnaires | Portal format questionnaire API |
| https://docs.conveyor.com/docs/trust-center-agent | NDA/auth visitor flow |
| https://docs.conveyor.com/ | Conveyor docs index / API surface |
| https://whistichelp.zendesk.com/hc/en-us/articles/34384536988311-Getting-Started-with-the-Whistic-Public-API | Whistic Public API |
| https://whistichelp.zendesk.com/hc/en-us/articles/14823895118871-Integrations-API-Introduction | Whistic API capabilities |
| https://whistichelp.zendesk.com/hc/en-us/articles/37078996825879-Creating-Vendors-through-the-Whistic-Public-API | Vendor create API |
| https://whistichelp.zendesk.com/hc/en-us/articles/24005662759831-Whistic-Reporting-API | Reporting GraphQL |
| https://www.whistic.com/resources/blog/how-to-get-the-most-out-of-your-free-whistic-basic-profile | Free profile limits |
| https://developer.onetrust.com/onetrust/reference/onetrust-api-reference | OneTrust API hub |
| https://developer.onetrust.com/onetrust/reference/createassessmentusingpost_1 | Launch assessment |
| https://developer.onetrust.com/onetrust/reference/exportassessmentusingget | Get assessment |
| https://www.onetrust.com/products/third-party-risk-management/ | TPM product scope |
| https://processunity.zendesk.com/hc/en-us/articles/34049522336283-API-V2-User-Guide | ProcessUnity GRX API |
| https://api.cybergrx.com/ | GRX API docs |
| https://demo-api.cybergrx.com/ | GRX demo API docs |
| https://help.bitsighttech.com/hc/en-us/articles/231872628-API-Documentation-Overview | Bitsight API |
| https://support.securityscorecard.com/hc/en-us/articles/45146364886683-API-documentation-and-developer-resources | SSC API hub |
| https://developer.hyperproof.app/ | Hyperproof developer portal |
| https://developer.hyperproof.app/api-details | Hyperproof API auth/base |
| https://developer.hyperproof.app/hyperproof-api/vendors/vendors.openapi | Vendors API |
| https://community.trustcloud.ai/docs/trustcloud-api/ | TrustCloud API |
| https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/reference-data-resources/suppliers-api-suppliers | Coupa Suppliers API |
| https://docs.coupa.com/en/developer-documentation/risk-assess-integrations/risk-assess-rest-api | Coupa Risk Assess API |
| https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html | ServiceNow Table API |
| https://www.servicenow.com/community/new-vendor-risk-customers-forum/vendor-risk-management-apis/m-p/2566407 | VRM API community guidance |
| https://fillbase.app/features/portal-autofill | Portal-fill market signal |
| https://wolfia.com/products/chrome-extension | Portal-fill market signal |

### Searches that returned no definitive public artifact

- “OneTrust vendor respondent API submit assessment answers” → **no API found** for seller-side submit in public docs reviewed  
- “ProcessUnity GRX third party submit assessment API respondent” → **no API found** in public GRX docs for third-party respondent submit  
- “Whistic Terraform provider” / “Conveyor Terraform provider” / “SafeBase Terraform provider” / “OneTrust Terraform provider registry” → **no Terraform provider found**  
- “OneTrust free trial sandbox TPM” / “ProcessUnity free trial sandbox” → **no public self-serve sandbox found**
