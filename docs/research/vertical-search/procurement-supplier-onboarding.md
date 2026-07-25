---
title: "Surface scout — Procurement & supplier onboarding"
doc_type: research
status: draft
owner: C1
surface_slug: procurement-supplier-onboarding
created: 2026-07-24
updated: 2026-07-24
confidence: MED
supersedes: null
sources_verified: true
access_date: 2026-07-24
related: docs/research/census-week0/A7-backup.md
---

# Surface B — Procurement & supplier onboarding

**Role:** C1 surface scout (enumeration + pivot tests 1–3 only; no scoring).  
**Access date for all evidence URLs below unless a row overrides:** 2026-07-24  
**Lane:** **Supplier-side** labor completing buyer-mandated registration / SIM / tax / bank / questionnaire flows in procurement networks and buyer portals. Buyer-side Coupa/Ariba admin APIs are out of primary scope.

`initial_browser_only_guess` is a **hypothesis for C4 to attack**, not a verdict.

---

## Pivot tests 1–3 (explicit)

### 1) COUNTERPARTY TEST — **PASS** (with SAP BN Enterprise caveat)

| Role | Who | Evidence |
| --- | --- | --- |
| Owns buyer procurement tenant / designs onboarding questionnaire | Enterprise **buyer** (AbbVie, AllianzGI, university, etc. on Ariba/Coupa/Jaggaer) | AbbVie supplier guide: Ariba portal is how suppliers complete AbbVie's onboarding questionnaire ([AbbVie PDF](https://www.abbvie.com/content/dam/abbvie-com2/pdfs/suppliers/supplier-onboarding-user-guide.pdf)); AllianzGI Ariba onboarding guide ([AllianzGI PDF](https://www.allianzgi.com/-/media/allianzgi/globalagi/ariba-supplier-portal/ariba-network-supplier-onboarding-user-guide-v2.pdf)); Coupa CSP onboarding "different for every user depending on ΓÇª their buyer's preferences" ([Coupa docs](https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/complete-the-csp-onboarding)) |
| Pays for Coupa / Ariba Buying / Jaggaer | Primarily the **buyer** organization | Coupa Core APIs (`/api/suppliers`, `/api/supplier_invites`, `/api/supplier_information`) are documented against the buyer's Coupa instance ([Suppliers API](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/reference-data-resources/suppliers-api-suppliers); [Supplier invites](https://compass.coupa.com/en-us/products/product-documentation/suppliers/supplier-integration-resources/api-endpoint-for-supplier-csp-invites); [Supplier Information API](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/reference-data-resources/supplier-information-api-supplier_information)). SAP Supplier Invite API is for **buyer** developers creating vendor records ([SAP PDF](https://help.sap.com/doc/56b8a389fe0249afaacc4d44fa95c449/cloud/en-US/supplier_invite_api.pdf)) |
| Does onboarding labor | **Supplier** finance / AR / ops staff | Buyer-published supplier manuals require supplier click-through registration, tax, bank, questionnaires ([AbbVie](https://www.abbvie.com/content/dam/abbvie-com2/pdfs/suppliers/supplier-onboarding-user-guide.pdf); [Zymeworks Coupa manual](https://supplier.coupa.com/app/uploads/2025/05/Suppliers-Onboarding-Manual-4-23-25.pdf); [BGSU Jaggaer portal](https://www.bgsu.edu/purchasing/vendor-onboarding.html)) |

**PASS reason:** Laborer Γëá buyer of the procurement SaaS that defines the questionnaire. CONFIDENCE: **HIGH** for Coupa CSP and typical Ariba Standard suppliers.

**Caveat (do not soft-pedal):** SAP Business Network **Enterprise** supplier accounts can incur **subscription + transaction fees** paid by the supplier ([SAP supplier pricing](https://www.sap.com/products/business-network/suppliers/pricing.html); [Ariba KBA when fees apply](https://support.ariba.com/item/view/168238)). When a supplier pays SAP, they *are* a paying customer of the network for transaction features — roadmap sympathy may improve for **integration / catalogs**, but **per-buyer registration questionnaires** remain buyer-configured. Treat counterparty purity as **MED** for high-volume Ariba Enterprise suppliers; still **PASS** for the onboarding-questionnaire labor vs buyer-license distinction.

### 2) DURABILITY TEST — **PASS**

**One sentence:** Buyers (and their risk/tax/treasury controls) need **buyer-controlled** intake of supplier legal entity, tax ID, and bank data; Coupa/SAP invest APIs for the **paying buyer tenant** to invite and sync suppliers to ERP — not a supplier-universal write API into every customer's SIM form — so each new enterprise customer still forces supplier-side browser (or human-services) completion of that buyer's flow.

Grounding: Coupa documents browser CSP onboarding with legal entity, tax registration, and payment methods ([Coupa CSP onboarding](https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/complete-the-csp-onboarding)). Buyer APIs cover invites and supplier master data from the **buyer** side ([supplier_invites](https://compass.coupa.com/en-us/products/product-documentation/suppliers/supplier-integration-resources/api-endpoint-for-supplier-csp-invites); [supplier_information](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/reference-data-resources/supplier-information-api-supplier_information)). No public **supplier-authenticated** API path to complete an arbitrary buyer's SIM / registration questionnaire found (searched: `Coupa Supplier Portal API submit SIM questionnaire`, `Ariba Network supplier API complete registration questionnaire`, `supplier self-service Coupa onboarding REST API`). CONFIDENCE: **HIGH** on current asymmetry; **MED** on 3-year persistence (cXML/EDI and ERP integration already automate *transactions* for sophisticated suppliers — onboarding forms may partially collapse for those suppliers).

**"Haven't built it yet" is not the claim** — the incentive structure favors buyer control of KYC/tax/bank intake.

### 3) MULTIPLICITY TEST — **PASS** (thin primary data)

**Question:** How many distinct portal **instances** does one supplier-side worker face per year?

| Signal | What it supports | Confidence | Evidence |
| --- | --- | --- | --- |
| Each buying org can mandate its own network + questionnaire | New customer ΓåÆ new invite / registration questionnaire even on "same" network brand | HIGH qualitative | AbbVie: complete AbbVie Supplier Registration Questionnaire in Ariba ([AbbVie PDF](https://www.abbvie.com/content/dam/abbvie-com2/pdfs/suppliers/supplier-onboarding-user-guide.pdf)); AllianzGI: separate invitation + initial questionnaire ([AllianzGI PDF](https://www.allianzgi.com/-/media/allianzgi/globalagi/ariba-supplier-portal/ariba-network-supplier-onboarding-user-guide-v2.pdf)); Coupa: buyer-specific Information Request / onboarding cards ([Zymeworks manual](https://supplier.coupa.com/app/uploads/2025/05/Suppliers-Onboarding-Manual-4-23-25.pdf); [Coupa onboarding](https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/complete-the-csp-onboarding)) |
| Platform heterogeneity | Coupa vs Ariba vs Jaggaer vs Tipalti vs custom | HIGH that brands differ | Invoice Butler lists Coupa, Ariba, Tipalti, Basware, Tungsten, custom ([Invoice Butler](https://www.invoicebutler.com/product/supplier-portal-management)); BGSU Jaggaer portal ([BGSU](https://www.bgsu.edu/purchasing/vendor-onboarding.html)) |
| Vendor marketing multiplicity claim | "30–40 different digital identities" with ~50 enterprise customers | **LOW** (vendor blog, not audited) | [Monto guide](https://montopay.com/the-complete-guide-to-supplier-onboarding-to-ap-portals/) |

**PASS reason:** Multiplicity tracks **customer-count ├ù platform mix**, not a single admin console. **No primary measured N found** (searched: `how many supplier portals does AR team manage`, `average Coupa Ariba portals per supplier`). CONFIDENCE: **MED** on PASS; **LOW** on numeric N.

---

## Landscape (supplier-relevant)

| Platform | Buyer API? | Supplier-facing onboarding surface | Notes |
| --- | --- | --- | --- |
| Coupa (CSP) | Yes — suppliers, invites, supplier_information on buyer tenant | Browser registration + legal entity + tax + payment methods + buyer forms | [CSP register methods](https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/methods-to-register-in-the-csp); [CSP onboarding](https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/complete-the-csp-onboarding) |
| SAP Business Network / Ariba | Yes — Supplier Invite API for buyers | Browser account + per-customer registration questionnaires; remittances / tax settings | [SAP Invite API](https://help.sap.com/doc/56b8a389fe0249afaacc4d44fa95c449/cloud/en-US/supplier_invite_api.pdf); [AbbVie guide](https://www.abbvie.com/content/dam/abbvie-com2/pdfs/suppliers/supplier-onboarding-user-guide.pdf); [SAP supplier pricing](https://www.sap.com/products/business-network/suppliers/pricing.html) |
| Jaggaer | Buyer e-procurement (not deep-dived for API here) | University/supplier registration portals | [BGSU](https://www.bgsu.edu/purchasing/vendor-onboarding.html). No Jaggaer supplier onboarding API path researched in depth (searched lightly: `Jaggaer supplier registration API`) — **NO_PATH_FOUND in this scout** |
| Tipalti / Basware / Tungsten | Mixed (not fully mapped) | Listed as supplier portal targets by AR automation vendors | [Invoice Butler](https://www.invoicebutler.com/product/supplier-portal-management) — treat as landscape pointer, not API census |

---

## Task table (13)

| task_id | one_line_description | ui_steps_est | observable_end_state | initial_browser_only_guess | evidence_urls | access_date | confidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PO-01 | Accept Coupa CSP invitation email; create account; verify email code | 6–10 | CSP account exists; linked to inviting buyer | Y | https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/methods-to-register-in-the-csp ; https://supplier.coupa.com/app/uploads/2025/05/Suppliers-Onboarding-Manual-4-23-25.pdf | 2026-07-24 | HIGH |
| PO-02 | Complete Coupa CSP first-time onboarding: address, tax registration, payment methods | 8–14 | Legal entity + payment method saved; redirected to Business Profile | Y | https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/complete-the-csp-onboarding | 2026-07-24 | HIGH |
| PO-03 | Complete buyer-specific Coupa Information Request / SIM form and submit for approval | 8–15 | Form submitted; buyer sees pending/approved supplier info | Y | https://supplier.coupa.com/app/uploads/2025/05/Suppliers-Onboarding-Manual-4-23-25.pdf ; https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/reference-data-resources/supplier-information-api-supplier_information | 2026-07-24 | HIGH |
| PO-04 | Self-register at supplier.coupahost.com without prior invite | 5–9 | CSP company account created | Y | https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/methods-to-register-in-the-csp | 2026-07-24 | HIGH |
| PO-05 | Create / log into SAP Business Network supplier account from buyer invitation | 5–10 | Network account active; buyer relationship pending questionnaire | Y | https://www.abbvie.com/content/dam/abbvie-com2/pdfs/suppliers/supplier-onboarding-user-guide.pdf ; https://help.sap.com/doc/d8afd4f3a8c2451c920f7dec9358621a/cloud/en-US/ANQuickStart.pdf | 2026-07-24 | HIGH |
| PO-06 | Complete buyer Ariba Supplier Registration Questionnaire (tax, bank, CoC, etc.) and submit | 10–18 | Questionnaire submitted; buyer reviews / enables PO/invoice | Y | https://www.abbvie.com/content/dam/abbvie-com2/pdfs/suppliers/supplier-onboarding-user-guide.pdf ; https://www.allianzgi.com/-/media/allianzgi/globalagi/ariba-supplier-portal/ariba-network-supplier-onboarding-user-guide-v2.pdf | 2026-07-24 | HIGH |
| PO-07 | Set Ariba remittance / bank account info under account Settings | 5–9 | Bank info saved; optional "include in invoices" enabled | Y | https://www.allianzgi.com/-/media/allianzgi/globalagi/ariba-supplier-portal/ariba-network-supplier-onboarding-user-guide-v2.pdf | 2026-07-24 | MED |
| PO-08 | Maintain Ariba tax information under Electronic Invoice Routing | 4–8 | Tax fields saved for invoicing | Y | https://www.allianzgi.com/-/media/allianzgi/globalagi/ariba-supplier-portal/ariba-network-supplier-onboarding-user-guide-v2.pdf | 2026-07-24 | MED |
| PO-09 | Register in university Jaggaer supplier portal (tax/SSN/bank) | 8–14 | Supplier profile submitted; paper forms rejected per buyer policy | Y | https://www.bgsu.edu/purchasing/vendor-onboarding.html | 2026-07-24 | MED |
| PO-10 | Buyer uses Coupa API to send CSP invite (contrast — buyer path) | 0 browser for supplier | Invite email sent; supplier still must complete CSP UI | N | https://compass.coupa.com/en-us/products/product-documentation/suppliers/supplier-integration-resources/api-endpoint-for-supplier-csp-invites | 2026-07-24 | HIGH |
| PO-11 | Buyer creates vendor via SAP Supplier Invite API (contrast — buyer path) | 0 browser for supplier | Vendor record created; optional trading relationship email | N | https://help.sap.com/doc/56b8a389fe0249afaacc4d44fa95c449/cloud/en-US/supplier_invite_api.pdf | 2026-07-24 | HIGH |
| PO-12 | Configure Coupa CSP multifactor authentication when prompted | 3–6 | MFA method enrolled for CSP login | Y | https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/complete-the-csp-onboarding | 2026-07-24 | MED |
| PO-13 | Update Coupa Business Profile payment methods / legal entities after onboarding | 5–10 | Profile reflects new remittance / entity data | ? | https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/complete-the-csp-onboarding | 2026-07-24 | MED |

**Guess tally:** Y=10, N=2 (buyer contrast), ?=1.

---

## Test-bed feasibility — brutal honesty

| Path | Feasible? | Notes | Evidence |
| --- | --- | --- | --- |
| Coupa CSP self-register | Partial | Public signup at supplier.coupahost.com exists; creates a **real** supplier identity — do not automate against production with fake tax/bank data; ToS apply | https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/methods-to-register-in-the-csp |
| Buyer-specific Coupa/Ariba questionnaire | Hard without partner | Needs live invite from a buyer tenant. No public "demo buyer who invites anyone" found (searched: `Coupa supplier portal sandbox demo invite`, `Ariba supplier registration questionnaire demo public`) | — |
| SAP BN Standard account | Partial | Free Standard tier documented ([SAP pricing](https://www.sap.com/products/business-network/suppliers/pricing.html)); still need a buyer relationship for registration questionnaires | https://support.ariba.com/item/view/KB0395736?HelpCenter=1 |
| Synthetic buyer tenant | Possible but expensive | Would require Coupa/Ariba buyer licenses — then laborer is no longer counterparty to "our" software's customer in the test harness | — |
| Human BPO competitors as existence proof | Yes (demand) | Monto / Invoice Butler sell portal onboarding + invoice submit as services/products | https://montopay.com/the-complete-guide-to-supplier-onboarding-to-ap-portals/ ; https://www.invoicebutler.com/product/supplier-portal-management |

**Verdict:** **Poor** for a clean 14-day self-serve gate without a design partner. Public CSP signup is not a safe playground for tax/bank automation. CONFIDENCE: **HIGH**.

---

## Buyer and budget

| Potential Paragent buyer | What they spend today | Cited signal | Confidence |
| --- | --- | --- | --- |
| Supplier AR / finance ops (sells to many enterprises) | Labor + optional portal-management SaaS / BPO | Invoice Butler / Monto product pages describe paid portal management — **no public rate card found** in this scout (searched: `Invoice Butler pricing`, `Monto supplier portal pricing`) | LOW on $ |
| Same suppliers on SAP BN Enterprise | Network subscription + transaction fees | Official schedules: Standard **Free**; Enterprise tiered subscription + transaction fees; published examples include Bronze **$50**/yr, Silver **$750**, Gold **$2,250**, Platinum **$5,500** annual subscription bands in Ariba KBA ([KB0399773](https://support.ariba.com/Item/view/KB0399773)); transaction fee percentages described in SAP Learning ([SAP Learning](https://learning.sap.com/courses/overview-of-sap-business-network/discussing-the-sap-business-network-supplier-fees_e4deac90-bef8-4e86-a86b-08d526286a4b)) | HIGH that fees exist; MED that bands still current — re-check fee schedule PDF at decision time |
| Buyers (Coupa/Ariba licensees) | Procurement SaaS (out of wedge) | Buyer APIs and invites — they are **not** the laborer | HIGH |

**Who signs (supplier-side wedge):** Controller / Head of AR / VP Finance at suppliers with many enterprise customers. CONFIDENCE: **MED**.

---

## REGULATORY OVERLAY — FLAG LOUDLY

1. **Tax identity & bank credentials:** CSP/Ariba onboarding collects tax registration and bank transfer details ([Coupa onboarding](https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/coupa-supplier-portal-registration-and-login/complete-the-csp-onboarding); [AllianzGI Ariba guide](https://www.allianzgi.com/-/media/allianzgi/globalagi/ariba-supplier-portal/ariba-network-supplier-onboarding-user-guide-v2.pdf)). Browser-agent capture of this class of data is a **privacy / fraud / wire-fraud** hazard. Hard rule 6 applies strictly.
2. **US W-9 / TIN handling:** Buyer portals solicit US tax forms (AllianzGI notes US suppliers attach tax form; Monto discusses W-9 freshness variance — marketing) ([AllianzGI](https://www.allianzgi.com/-/media/allianzgi/globalagi/ariba-supplier-portal/ariba-network-supplier-onboarding-user-guide-v2.pdf)). Treat IRS/tax document automation as counsel-gated.
3. **Sanctions / KYC / vendor code of conduct:** Buyer questionnaires include CoC acceptance (AllianzGI) — not pure CRUD.
4. **Banking TPRM guidance (buyer side):** Interagency third-party risk guidance increases buyer diligence demand ([OCC PDF](https://www.occ.treas.gov/news-issuances/news-releases/2023/nr-ia-2023-53a.pdf)) — drives more supplier questionnaires, does not authorize supplier RPA.

---

## Why this surface might fail

1. **Test-bed nearly hostile:** Tax/bank fields + production networks make honest sandbox measurement hard without a consented design partner.
2. **Sophisticated suppliers already integrate:** SAP BN Enterprise marketing includes system-to-system integration ([SAP pricing](https://www.sap.com/products/business-network/suppliers/pricing.html)); cXML/EDI may shrink browser labor for the largest suppliers (the ones with budget).
3. **Competitors are human+RPA BPO:** Monto/Invoice Butler already productize portal onboarding — crowded, trust-sensitive category.
4. **Frequency may be bursty:** Onboarding is often **once per buyer relationship**, then rare profile updates — weaker than recurring security questionnaires unless invoice-submit is in scope (invoice submit is adjacent, not fully enumerated here).
5. **Ariba fee-paying suppliers blur counterparty purity** (see Test 1 caveat).
6. **Regulatory / ToS kill zone:** Recording bank and tax flows is a default **no** without extreme privacy boundary design.

---

## Open questions / what I could not verify

- Measured distribution of portals per supplier AR FTE (Coupa vs Ariba vs Jaggaer vs other) — no primary dataset found.
- Whether Coupa exposes any **supplier OAuth** API to write SIM answers (buyer `supplier_information` API is not that) — **NO_PATH_FOUND** (searched queries in Durability section).
- Depth of Jaggaer / Tipalti / Basware supplier APIs (out of depth for this scout).
- Current SAP BN fee schedule PDF dollar bands vs KBA examples (re-download at lock time).
- Whether invoice submission / PO flip (post-onboarding) is the real high-frequency browser labor vs onboarding itself — adjacent surface, not fully scoped here.
- Design-partner willingness to run agents on portals containing bank/tax data under written DPA.
