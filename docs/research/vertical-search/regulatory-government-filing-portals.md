---
title: "Surface scout — Regulatory & government filing portals"
doc_type: research
status: draft
owner: C3
surface_slug: regulatory-government-filing-portals
created: 2026-07-24
updated: 2026-07-24
confidence: MED
supersedes: null
sources_verified: true
access_date: 2026-07-24
---

# Surface B — Regulatory & government filing portals

**Role:** C3 surface scout (enumeration + pivot tests 1–3 only; no scoring).  
**Access date for evidence URLs below unless a row overrides:** 2026-07-24  
**Lane:** Compliance staff, authorized agents, and filers performing **mandatory or entitlement filings** in government-owned systems (federal/state). Commercial tax-prep SaaS where the filer *buys* the software is out of primary scope (customer-side).

`initial_browser_only_guess` is a **hypothesis for C4**. Expect MeF/A2A, authorized-transmitter programs, and bulk XML schemas to kill many “tax return” shaped tasks.

---

## Pivot tests 1–3 (explicit)

### 1) COUNTERPARTY TEST — **PASS**

| Role | Who | Evidence |
| --- | --- | --- |
| Owns the portal | Government agency (IRS, GSA/SAM, USPTO, state SOS, etc.) | SAM.gov is GSA System for Award Management; Entity Management APIs documented by GSA ([open.gsa.gov entity-api](https://open.gsa.gov/api/entity-api/)); MeF is IRS electronic filing system ([IRS MeF overview](https://www.irs.gov/e-file-providers/modernized-e-file-overview)) |
| Pays for the system | Taxpayer / agency budget — **not** a commercial SaaS sale to the filer as “customer of the portal product” in the pivot sense | Government portals are public infrastructure; filers comply rather than buy roadmap influence |
| Does the labor | Compliance teams, EROs, transmitters, entity admins, IP counsel staff | MeF participation roles (ERO, Transmitter, Software Developer) defined for providers ([IRS MeF overview](https://www.irs.gov/e-file-providers/modernized-e-file-overview); Pub 4163 referenced from [MeF guides](https://www.irs.gov/e-file-providers/modernized-e-file-mef-user-guides-and-publications)) |

**PASS reason:** The person clicking is not a commercial customer whose repeated labor the portal owner is incented to productize away *for their benefit* the way a SaaS vendor is for paying tenants. CONFIDENCE: **HIGH** on counterparty shape; **MED** that this alone implies durable browser-onlyness (see durability — electronic filing is often *mandated*).

### 2) DURABILITY TEST — **FAIL** for major tax e-file volumes; **PASS** for selected entity-admin / attestation UIs

**One sentence:** Agencies often **require or strongly prefer electronic filing** and publish transmitter/SDK programs (MeF A2A/IFA, AES EDI) because *government* wants structured data — so “no API in three years” fails for core return transmission; durable browser-only work is more plausible where the agency exposes **read APIs but not write**, or where identity-bound account management stays in a human portal.

Grounding:

- IRS MeF supports Internet Filing Application (IFA) and Application-to-Application (A2A) for transmitters ([IRS MeF overview](https://www.irs.gov/e-file-providers/modernized-e-file-overview); toolkit notes on [MeF user guides](https://www.irs.gov/e-file-providers/modernized-e-file-mef-user-guides-and-publications)).
- SAM.gov Entity Management API is documented for **retrieving** entity data; secondary sources state registration/update remains portal login (API read ≠ write) ([open.gsa.gov entity-api](https://open.gsa.gov/api/entity-api/); synthesis citing SamSearch glossary summary of read-only registration — treat third-party glossary as **LOW** confidence vs GSA primary: confirm write absence in GSA docs — **no SAM entity *update* endpoint claimed in open.gsa.gov entity-api landing as a public self-service write API found this pass**).
- USPTO Open Data Portal exposes **data** APIs; Patent Center remains a separate filing/UI surface ([USPTO ODP](https://data.uspto.gov/home)).

**Surface-level durability verdict for “government filing = permanently browser-only”:** **FAIL** as a blanket claim. CONFIDENCE: **HIGH**.

**Narrow PASS candidates:** SAM entity registration/banking updates in portal; certain state business filings without bulk APIs; agency-specific attestation forms; account identity proofing steps. CONFIDENCE: **MED**.

### 3) MULTIPLICITY TEST — **PASS**

One compliance org faces **many agencies and states** (federal + 50-state SOS/tax/professional licensing). No primary count of distinct government hostnames per FTE found (searched: `how many government filing portals per compliance officer per year`). CONFIDENCE: **MED** on PASS; **LOW** on N.

---

## Landscape (scout-relevant)

| System | Labor | Electronic path (cited) | Browser residual hypothesis |
| --- | --- | --- | --- |
| IRS MeF | Tax return transmission | A2A / IFA for authorized providers ([MeF overview](https://www.irs.gov/e-file-providers/modernized-e-file-overview)) | Portal steps for enrollment / some origination UIs |
| SAM.gov | Entity registration for federal awards | Entity **read** APIs ([GSA entity-api](https://open.gsa.gov/api/entity-api/)); registration management described as portal in secondary sources | Entity update / banking / reps & certs UI |
| USPTO ODP / Patent Center | IP data vs filing | ODP APIs for data products ([ODP](https://data.uspto.gov/home)); Patent Center is filing UI (support contacts listed on ODP) | Patent prosecution filing/upload flows |
| State SOS / tax portals | Business filings, annual reports | Heterogeneous; some states publish XML/bulk; many remain form UIs | High variance — C4 must kill per state |

---

## Task table (12)

| task_id | one_line_description | ui_steps_est | observable_end_state | initial_browser_only_guess | evidence_urls | access_date | confidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GF-01 | Transmit business return via authorized MeF software/A2A | 0–3 in browser (mostly software) | IRS acceptance / ack | N | https://www.irs.gov/e-file-providers/modernized-e-file-overview ; https://www.irs.gov/e-file-providers/modernized-e-file-mef-user-guides-and-publications | 2026-07-24 | HIGH |
| GF-02 | Enroll as IRS e-file provider / manage MeF authorities in e-Services | 10–20 | Provider application status updated | Y | https://www.irs.gov/e-file-providers/modernized-e-file-mef-user-guides-and-publications | 2026-07-24 | MED |
| GF-03 | Complete SAM.gov entity registration (UEI) in portal | 15–30 | Registration submitted / active | Y (write) | https://open.gsa.gov/api/entity-api/ ; https://samsearch.co/glossary/sam-gov-api | 2026-07-24 | MED |
| GF-04 | Update SAM entity banking / points of contact in portal | 8–15 | Change pending/active | Y | https://open.gsa.gov/api/entity-api/ (read APIs documented; no self-service write API found this pass — searched: `SAM.gov entity update API registration write`) | 2026-07-24 | MED |
| GF-05 | Download / view SAM Reps & Certs PDF for own entity | 3–8 | PDF available | PARTIAL | https://open.gsa.gov/api/entity-api/ | 2026-07-24 | MED |
| GF-06 | Search public SAM entity data via API key | 0–1 | JSON entity payload | N | https://open.gsa.gov/api/entity-api/ | 2026-07-24 | HIGH |
| GF-07 | File patent application documents in Patent Center UI | 15–40 | Filing receipt / confirmation | ? | https://data.uspto.gov/home (Patent Center listed separately from ODP APIs) | 2026-07-24 | MED |
| GF-08 | Pull patent bibliographic data via USPTO ODP API | 0–1 | Structured patent data | N | https://data.uspto.gov/home ; https://data.uspto.gov/apis/getting-started | 2026-07-24 | HIGH |
| GF-09 | File state annual report / statement of information on SOS portal | 8–20 | Confirmation number / stamped PDF | ? | no single national API (searched: `unified state annual report filing API USA`); per-state variance | 2026-07-24 | MED |
| GF-10 | Renew professional / contractor license on state portal | 8–15 | License status renewed | ? | no universal API found (searched: `state professional license renewal API standard`) | 2026-07-24 | LOW |
| GF-11 | Submit FOIA / records request on agency portal | 5–12 | Request ID issued | Y | agency-specific; no universal API claimed (searched: `federal FOIA portal submit API`) | 2026-07-24 | LOW |
| GF-12 | Complete identity proofing / Login.gov linking for agency access | 5–12 | Account linked / MFA enrolled | Y | trust-boundary; once-ish frequency risk | 2026-07-24 | MED |

---

## Test-bed feasibility — **BEST-OF-BAD among C3 surfaces, still constrained**

| Option | Without design partner? | Notes |
| --- | --- | --- |
| SAM.gov public search + Entity API | **Yes** | API key registration path documented ([GSA entity-api](https://open.gsa.gov/api/entity-api/)); tests **read**, not write registration |
| SAM entity *write* flows | **No / slow** | Needs real legal entity + banking; not a disposable sandbox |
| IRS MeF ATS (Assurance Testing) | Partial | Authorized providers / software developers only ([MeF guides](https://www.irs.gov/e-file-providers/modernized-e-file-mef-user-guides-and-publications)) — weeks of enrollment |
| USPTO ODP | **Yes** for data APIs | Account/MFA requirements evolving ([ODP getting started](https://data.uspto.gov/apis/getting-started)); not Patent Center filing |
| State SOS demo | Rare | Most states lack public automation sandboxes |

**Brutal read:** Easy measurement targets are **API-covered reads**. The hypothetically browser-only **writes** are exactly the flows hardest to stand up without a real entity and counsel review.

---

## Buyer and budget

| Question | Finding | Confidence | Evidence |
| --- | --- | --- | --- |
| Who signs? | Controllers, GC/compliance, tax directors, federal contracts admins | MED | Role inference from MeF provider / SAM registrant populations — not interview-backed |
| Spend today? | Tax software + ERO/transmitter fees; gov-con consultants; compliance headcount; registered agent services | MED | MeF ecosystem of software developers/transmitters ([MeF overview](https://www.irs.gov/e-file-providers/modernized-e-file-overview)); **no dollar figures invented** |
| Intermediary? | **Yes** for tax (software vendors/transmitters) and often for SAM (consultants) | HIGH | Authorized e-file provider model ([MeF](https://www.irs.gov/e-file-providers/modernized-e-file-overview)) |

---

## Regulatory overlay — **HARD-STOP CANDIDATE**

- **Authorized-transmitter / ERO rules** constrain who may automate MeF submissions ([MeF overview](https://www.irs.gov/e-file-providers/modernized-e-file-overview); Pub 4163/4164 via [guides page](https://www.irs.gov/e-file-providers/modernized-e-file-mef-user-guides-and-publications)).
- **Identity attestation** (Login.gov / agency MFA) and potential **statutory limits** on automated filing — must be counsel-sized before any pilot (pivot brief §5).
- Storing tax return or SAM banking content in any cache is a **§6 / custody** failure mode, not a product feature.

Treat this surface as **high legal cost to v1** even if a few browser-only tasks survive C4.

---

## Why this surface might fail

1. **Government wants structured electronic intake** — opposite incentive of “never build an API.” MeF/A2A and SAM read APIs prove the point.
2. **Transmitters and tax software already own the high-frequency labor** — intermediary kill.
3. Surviving browser tasks skew to **enrollment, identity, and rare account updates** (frequency death).
4. **Test-bed honesty:** public APIs are easy; the interesting writes are not.

---

## Open questions / what I could not verify

- Authoritative GSA statement that *no* public write API exists for SAM entity registration updates (searched entity-api docs; write absence is “no path found,” not proven impossible).
- Which US states publish bulk annual-report APIs vs portal-only (needs per-state pass; not done here).
- Patent Center machine interface / EFS-Web successor automation rules (not deep-dived).
- Whether Login.gov terms prohibit agent-driven interactive automation for agency linking (not retrieved).
