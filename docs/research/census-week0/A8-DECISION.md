---
title: "A8 — Adjudicator decision memo (FAIL)"
doc_type: research
status: killed
owner: A8
created: 2026-07-24
updated: 2026-07-24
confidence: HIGH
supersedes: null
sources_verified: true
---

FAIL

# A8 — Adjudicator Decision Memo

**Role:** Sole scorer / gate (joins A1–A7; invents no new facts)  
**Scored:** 2026-07-24  
**Join completeness:** 70/70 task_ids have A4 verdict + A5 evidence row. **INCOMPLETE: none.**

**Survivor count:** **2** (`SN-17`, `DD-06`)  
**Single-vendor concentration of 4+ survivors:** **NOT MET** (Datadog 1, Sentry 1, Grafana Cloud 0)  
**Gate threshold:** ≤2 survivors → **FAIL**. Pivot; do not lock observability as the anchor vertical.  
**Nominated gate task:** **N/A** (FAIL; no free-tier Grafana Cloud survivor exists anyway — see below).

---

## Evidence-quality assessment (read this before the table)

This census is **strongest** where it kills value: A4’s FULLY_API list (51/70) is densely cited to official REST docs and Terraform Registry pages (access 2026-07-24 per `census/A4-adversary.md`). That half of the work is trustworthy enough to bet the runway against “observability config as browser-agent gold.”

This census is **weakest** where it would need to *save* the vertical:

1. **Frequency is mostly inferred proxies** (Stack Overflow / forums / “per service onboarding”), not measured org telemetry. A5 itself flags ~18 tasks as LOW/thin for pain and notes empty Reddit SERPs in-runner (`census/A5-evidence.md`). Do **not** bet a multi-month build on A5 frequency numbers as if they were usage analytics. **CONFIDENCE: LOW** that any FREQUENCY score of 2–3 generalizes outside vocal online cohorts.
2. **NO_PATH_FOUND ≠ proven impossible** (A4 hard rule; especially `GC-16` invites:* scopes without documented path, `SN-18`/`SN-22` UI-documented token mint). BROWSER_ONLY=3 on those rows means “credible search failed,” not “API cannot exist next quarter.”
3. **PARTIAL residue is mostly trust-boundary one-shots** (OAuth, IdP, marketplace). A4 already warns these are not vertical proof (`census/A4-adversary.md` Adversary notes §3). Scoring them BO=2 without FREQUENCY≥2 correctly yields near-misses, not anchors.
4. **Pain ≠ browser-only necessity.** Highest A5 pain (DD-09 CFN “nightmare”, DD-12 indexes, GC-06 routing, SN-08 Jira, DD-01 monitors) sits on tasks A4 killed as FULLY_API. That is exactly the trap of building a UI replay cache for work competent teams already IaC.

**Sanity check:** Scores are not uniformly high. Survivors are 2, not 20. A census that confirmed the prior draft would have failed this check; this one did not.

**What I would not bet the runway on:** (a) SaaS observability console RPA as the wedge; (b) any FREQUENCY=2 claim without customer interviews; (c) shipping console automation against Datadog/Grafana without counsel + written consent (A6).

---

## Scored table

Sorted by **total** descending. Axes 0–3. **SURVIVOR** = all four ≥2 (no compensating). Where A1–A3 guessed Y/? and A4 said FULLY_API, **A4 wins** (`census/A4-adversary.md`).

| task_id | vendor | task_name | BROWSER_ONLY | FREQUENCY | PAIN | REPLAY_SUITABILITY | total | survivor | brief_rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SN-17 | Sentry | Adjust subscription reserved / PAYG quotas | 3 | 2 | 3 | 3 | 11 | Y | A4 NO_PATH; quota-burn recurrence; crisp confirm |
| DD-01 | Datadog | Create metric monitor | 0 | 3 | 3 | 3 | 9 | N | A4 FULLY_API; high F/P but dead as browser anchor |
| DD-06 | Datadog | Add Slack channel for notifications | 2 | 2 | 3 | 2 | 9 | Y | A4 PARTIAL invite substantive; F scales w/ channels; short steps |
| GC-04 | Grafana Cloud | Create Grafana-managed alert rule | 0 | 3 | 3 | 3 | 9 | N | A4 FULLY_API |
| SN-18 | Sentry | Create Organization Auth Token | 3 | 2 | 1 | 3 | 9 | N | A4 NO_PATH; weak pain kills survivor |
| DD-05 | Datadog | Install Slack workspace (OAuth) | 2 | 1 | 2 | 3 | 8 | N | A4 PARTIAL OAuth substantive; once/workspace F=1 |
| DD-11 | Datadog | Create log processing pipeline | 0 | 2 | 3 | 3 | 8 | N | A4 FULLY_API |
| DD-12 | Datadog | Create log index | 0 | 2 | 3 | 3 | 8 | N | A4 FULLY_API |
| DD-23 | Datadog | Set usage attribution tags | 3 | 1 | 2 | 2 | 8 | N | A4 NO_PATH; rare tag-key edits |
| GC-01 | Grafana Cloud | Install OS integration via Connections | 1 | 2 | 3 | 2 | 8 | N | A4 PARTIAL Alloy CLI not browser |
| GC-06 | Grafana Cloud | Add notification child policy | 0 | 2 | 3 | 3 | 8 | N | A4 FULLY_API |
| GC-14 | Grafana Cloud | Create Cloud Access Policy + token | 0 | 2 | 3 | 3 | 8 | N | A4 FULLY_API |
| SN-06 | Sentry | Install Slack notification workspace | 2 | 1 | 2 | 3 | 8 | N | A4 PARTIAL OAuth; once/workspace |
| SN-07 | Sentry | Install GitHub integration and select repos | 2 | 1 | 3 | 2 | 8 | N | A4 PARTIAL App install; F=1 install-once |
| SN-08 | Sentry | Install Jira Cloud via Atlassian Marketplace | 2 | 1 | 3 | 2 | 8 | N | A4 PARTIAL marketplace; once/instance |
| SN-09 | Sentry | Create Alert | 0 | 2 | 3 | 3 | 8 | N | A4 FULLY_API |
| SN-10 | Sentry | Configure project ownership rules | 0 | 2 | 3 | 3 | 8 | N | A4 FULLY_API |
| SN-21 | Sentry | Enable Seer features | 3 | 1 | 2 | 2 | 8 | N | A4 NO_PATH MED; adoption once; SCM prereq |
| SN-22 | Sentry | Create Internal Integration | 3 | 1 | 1 | 3 | 8 | N | A4 NO_PATH; weak pain/rare |
| SN-24 | Sentry | Set up CODEOWNERS + mappings | 2 | 1 | 3 | 2 | 8 | N | A4 PARTIAL mappings UI; setup-once |
| DD-02 | Datadog | Create dashboard with widget | 0 | 2 | 2 | 3 | 7 | N | A4 FULLY_API |
| DD-04 | Datadog | Schedule monitor downtime | 0 | 2 | 2 | 3 | 7 | N | A4 FULLY_API |
| DD-09 | Datadog | Connect AWS account (CloudFormation path) | 0 | 2 | 3 | 2 | 7 | N | A4 FULLY_API via TF+AWS; pain was CFN not browser-necessity |
| DD-14 | Datadog | Create Synthetic browser test | 0 | 2 | 3 | 2 | 7 | N | A4 FULLY_API steps-as-JSON; flakiness pain not browser-only |
| DD-17 | Datadog | Configure SAML SSO IdP | 2 | 1 | 2 | 2 | 7 | N | A4 PARTIAL IdP console; once/IdP |
| DD-24 | Datadog | Upgrade/downgrade plan (billing) | 3 | 1 | 1 | 2 | 7 | N | A4 NO_PATH; infrequent; anxiety != task pain |
| GC-05 | Grafana Cloud | Create contact point | 0 | 2 | 2 | 3 | 7 | N | A4 FULLY_API |
| GC-09 | Grafana Cloud | Create Synthetic Monitoring HTTP/API check | 0 | 2 | 2 | 3 | 7 | N | A4 FULLY_API |
| GC-12 | Grafana Cloud | Connect AWS account for CloudWatch scrape | 0 | 2 | 3 | 2 | 7 | N | A4 FULLY_API |
| GC-13 | Grafana Cloud | Apply Adaptive Metrics recommendation | 0 | 2 | 2 | 3 | 7 | N | A4 FULLY_API |
| GC-15 | Grafana Cloud | Create service account + token | 0 | 2 | 2 | 3 | 7 | N | A4 FULLY_API |
| GC-16 | Grafana Cloud | Invite org member in Cloud Portal | 3 | 2 | 1 | 1 | 7 | N | A4 NO_PATH MED; weak pain; accept async |
| GC-18 | Grafana Cloud | Configure stack SAML / SSO settings | 2 | 1 | 2 | 2 | 7 | N | A4 PARTIAL IdP; once |
| SN-04 | Sentry | Configure org SSO / SAML | 2 | 1 | 2 | 2 | 7 | N | A4 PARTIAL; once/IdP |
| SN-12 | Sentry | Create Cron Monitor | 0 | 2 | 2 | 3 | 7 | N | A4 FULLY_API |
| SN-16 | Sentry | Configure inbound data filters | 0 | 2 | 2 | 3 | 7 | N | A4 FULLY_API |
| SN-20 | Sentry | Build and save a Discover query | 0 | 2 | 2 | 3 | 7 | N | A4 FULLY_API |
| SN-23 | Sentry | Manually link or create Jira issue | 1 | 3 | 2 | 1 | 7 | N | A4 PARTIAL; alerts alternate; judgment |
| DD-03 | Datadog | Create metric-based SLO | 0 | 2 | 1 | 3 | 6 | N | A4 FULLY_API; thin pain |
| DD-07 | Datadog | Configure PagerDuty service handle | 0 | 2 | 1 | 3 | 6 | N | A4 FULLY_API |
| DD-10 | Datadog | Connect Azure via app registration | 0 | 2 | 2 | 2 | 6 | N | A4 FULLY_API |
| DD-18 | Datadog | Create organization API key | 0 | 2 | 1 | 3 | 6 | N | A4 FULLY_API |
| GC-02 | Grafana Cloud | Add external data source | 0 | 2 | 1 | 3 | 6 | N | A4 FULLY_API |
| GC-03 | Grafana Cloud | Create dashboard folder | 0 | 2 | 1 | 3 | 6 | N | A4 FULLY_API |
| GC-07 | Grafana Cloud | Create SLO | 0 | 2 | 1 | 3 | 6 | N | A4 FULLY_API |
| GC-10 | Grafana Cloud | Enable per-check Synthetic alerts | 0 | 1 | 2 | 3 | 6 | N | A4 FULLY_API |
| GC-19 | Grafana Cloud | Install catalog plugin | 0 | 1 | 2 | 3 | 6 | N | A4 FULLY_API |
| GC-21 | Grafana Cloud | Create IRM escalation chain | 0 | 1 | 2 | 3 | 6 | N | A4 FULLY_API |
| SN-01 | Sentry | Create project and copy DSN | 0 | 2 | 1 | 3 | 6 | N | A4 FULLY_API |
| SN-02 | Sentry | Create team and add members | 0 | 2 | 1 | 3 | 6 | N | A4 FULLY_API |
| SN-03 | Sentry | Invite members and set org roles | 0 | 2 | 1 | 3 | 6 | N | A4 FULLY_API |
| SN-14 | Sentry | Enable Spike Protection | 0 | 1 | 2 | 3 | 6 | N | A4 FULLY_API |
| SN-15 | Sentry | Set per-DSN error rate limits | 0 | 1 | 2 | 3 | 6 | N | A4 FULLY_API |
| DD-08 | Datadog | Create webhook notification endpoint | 0 | 1 | 1 | 3 | 5 | N | A4 FULLY_API |
| DD-13 | Datadog | Create APM custom retention filter | 0 | 1 | 1 | 3 | 5 | N | A4 FULLY_API |
| DD-19 | Datadog | Create service account + app key | 0 | 1 | 1 | 3 | 5 | N | A4 FULLY_API |
| DD-20 | Datadog | Create custom RBAC role | 0 | 1 | 1 | 3 | 5 | N | A4 FULLY_API |
| DD-21 | Datadog | Create Team with handle | 0 | 1 | 1 | 3 | 5 | N | A4 FULLY_API |
| DD-22 | Datadog | Customize Incident Management settings | 0 | 1 | 1 | 3 | 5 | N | A4 FULLY_API |
| GC-08 | Grafana Cloud | Initialize Synthetic Monitoring plugin | 0 | 1 | 1 | 3 | 5 | N | A4 FULLY_API |
| GC-17 | Grafana Cloud | Enforce org-wide MFA | 0 | 1 | 1 | 3 | 5 | N | A4 FULLY_API |
| GC-20 | Grafana Cloud | Create billing/usage cost alert | 0 | 1 | 1 | 3 | 5 | N | A4 FULLY_API |
| SN-05 | Sentry | Enforce organization-wide 2FA | 0 | 1 | 2 | 2 | 5 | N | A4 FULLY_API; side-effect caution |
| SN-11 | Sentry | Triage issue: Archive or Resolve | 0 | 3 | 2 | 0 | 5 | N | A4 FULLY_API; human judgment mid-flow |
| SN-13 | Sentry | Create Uptime Monitor for a URL | 0 | 1 | 1 | 3 | 5 | N | A4 FULLY_API |
| SN-19 | Sentry | Create custom Dashboard with widgets | 0 | 2 | 1 | 2 | 5 | N | A4 FULLY_API; long widget build |
| DD-15 | Datadog | Create Synthetic private location | 1 | 1 | 1 | 1 | 4 | N | A4 PARTIAL host worker not UI; BO residual non-browser |
| DD-16 | Datadog | Create RUM browser application | 0 | 1 | 1 | 2 | 4 | N | A4 FULLY_API; traffic end-state fuzzy |
| GC-11 | Grafana Cloud | Create Frontend Observability application | 0 | 1 | 1 | 2 | 4 | N | A4 FULLY_API |
| GC-22 | Grafana Cloud | Set custom stack domain (CNAME) | 0 | 1 | 1 | 2 | 4 | N | A4 FULLY_API Cloud+DNS APIs |

### Survivor detail (the only two that clear all four gates)

| task_id | Scores | Why it cleared | Why it still does not save the vertical |
| --- | --- | --- | --- |
| **SN-17** | BO3 F2 P3 R3 | A4: no subscription quota write API found (`census/A4-adversary.md`); A5: quota-burn forum + manage-subscription docs (`census/A5-evidence.md`) | Billing/checkout, not observability config; F=2 is MED-confidence recurrence; ToS product-model risk for multi-tenant ops (A6 F3) |
| **DD-06** | BO2 F2 P3 R2 | A4 PARTIAL: Slack-side invite remains after Datadog channel API (`census/A4-adversary.md`); A5 HIGH friction on private-channel invite (`census/A5-evidence.md`) | Cross-product Slack action, 3–5 steps, not a Datadog-console depth wedge; A6 Datadog AUP scrape ban for console agents |

**Grafana Cloud free-tier gate task:** **None.** Zero Grafana survivors. Loud for the 14-day test-bed plan: even if we ignored the FAIL gate, we cannot nominate “highest-scoring Grafana Cloud free-tier survivor” — the set is empty. Free-tier availability documented in `census/A2-grafana.md` does not help without survivors.

---

## Tasks killed by A4 — what we would have wrongly built on

A4 **FULLY_API = 51** (`census/A4-adversary.md`). Highest-pain / highest-frequency kills (A5 top signals that are nonetheless dead as browser anchors):

| Would-have-built | Why it looked good pre-A4 | Kill citation (A4) |
| --- | --- | --- |
| DD-01 monitors | Years of TF “invalid query” / UI-then-copy-JSON (A5) | `POST /api/v1/monitor` |
| DD-09 AWS connect | CFN “nightmare” GitHub issues (A5) | `datadog_integration_aws_account` |
| DD-12 log indexes | Vendor + cost-blog bill shock (A5) | Logs indexes API |
| DD-14 Synthetics | Vendor-owned flakiness pain (A5) | Browser synthetics API + TF |
| GC-04 / GC-06 alerting | Community routing confusion (A5) | Alerting provisioning API / `grafana_notification_policy` |
| GC-01 Alloy onboarding | Token/config forum pain (A5) | Residual is **host CLI**, not browser (PARTIAL BO=1) |
| SN-09 / SN-10 alerts & ownership | Noise / ownership blogs (A5) | Issue alert TF + ownership API |
| GC-11 / DD-16 RUM/FO apps | Console-looking create flows (A1/A2) | RUM / `grafana_frontend_o11y_app` APIs |
| Almost all dashboards, SLOs, keys, roles, teams, pipelines, SM checks, spike protection, Discover | Classic “config in the UI” enumerator bait | Documented REST and/or Terraform |

**Wrong thesis the kill list falsifies:** “Platform engineers live in Datadog/Grafana/Sentry consoles for recurring config, so a trajectory cache beats API/IaC.” Competent teams already have API/Terraform for the recurring core. Residue is OAuth/IdP/billing/token-mint — thin, rare, or ToS-hostile.

---

## Gate application

| Criterion | Result |
| --- | --- |
| Survivors ≥ 6 and ≥4 on one vendor → PASS | **No** (2 survivors; max per vendor = 1) |
| Survivors 3–5 → MARGINAL | **No** |
| Survivors ≤ 2 → FAIL | **Yes** |

**Explicit statement:** Survivor count = **2**. Single-vendor concentration of 4+ = **not met**.

---

## A6 — ToS risk (narrative only; not in numeric scores)

From `census/A6-tos.md` (accessed 2026-07-24):

| Vendor | Customer-consented console-agent risk | Outright v1 blockers flagged |
| --- | --- | --- |
| **Datadog** | **HIGH** | AUP §4 No Framing/Scraping — robots/automatic devices gathering Service content or circumventing navigational structure **without prior written consent** (F1) |
| **Grafana Cloud** | **HIGH** | ToS §9 bans spidering/harvesting and software that collects/accesses data **or otherwise interacts** with the Service; July 2026 update emphasizes scraping (F2). MSA precedence ambiguous (MED) |
| **Sentry** | **MED** | No explicit scrape/robot ban found in ToS/AUP; structural ban on using Service **on behalf of / as a product to third parties** (F3) bites multi-tenant “we drive your console” SaaS; prefers API/MCP |

**Implication for FAIL:** Even the two survivors are poor pilot vehicles. **DD-06** sits under Datadog HIGH ToS risk if the agent drives Datadog UI (and Slack has its own consent surface). **SN-17** is billing mutation under Sentry MED risk plus F3 product-model risk if Paragent operates the account as a service. A6’s counsel packet (written consent / MSA carve-out for Datadog & Grafana; identity architecture; no shared human passwords) is a **prerequisite**, not a polish item — and it does not resurrect a failed economic vertical.

---

## A7 — Pivot handoff (FAIL path)

From `census/A7-backup.md` (accessed 2026-07-24):

**Credible backup wedge (narrow):** Seller-side **portal questionnaire fill** and **trust-center visitor NDA/doc access** (VR-01, VR-02, VR-05, VR-06, VR-08, VR-10), where vendors with APIs for *their own* products still ship Chrome extensions because buyer portals lack export/API (`census/A7-backup.md` §4; Vanta engineering post cited therein).

**Not the wedge:** Buyer-side TPRM inventory / assessment launch (heavily API’d across Vanta, Drata, OneTrust, Whistic, ProcessUnity GRX, etc.).

**Biggest 14-day obstacle:** Invitation-gated / design-partner test beds — unlike Datadog/Grafana/Sentry free trials, high-value VR tasks live inside *another company’s* portal.

### Specific next action (owner + time-box)

| Field | Value |
| --- | --- |
| **Decision** | Do **not** lock Datadog/Grafana/Sentry observability config as the Week-0 anchor. |
| **Next action** | Run a **mini-adversary + measurement-feasibility pass** on A7’s seller-portal wedge only: (1) pick **one** portal target with a reachable test bed (prefer design partner invite into OneTrust **or** self-serve Conveyor trust-center visitor VR-06); (2) confirm still browser-bound for *respondent* submit; (3) write one testable post-condition; (4) spike ToS for that portal host. |
| **Owner** | Founder / product (design-partner outreach) + eng (one-day VR-06 or partner OneTrust dry-run) |
| **Time-box** | **5 business days** — partner commit or VR-06 self-serve spike green/red; if red (no partner + VR-06 too thin), open a third vertical search (do not return to observability CRUD). |
| **Explicit non-goals this week** | Building monitor/dashboard/alert replay against DD/GC/SN; treating A7 “TPRM platforms” as a broad vertical. |

---

## Decision narrative (build / pivot)

**Pivot.** Observability SaaS config is the wrong anchor for a stateful browser-agent execution layer whose value requires browser-only, high-frequency, painful, replayable work. A4 destroyed the core config surface; A5’s strongest pain lives on those dead tasks; A6 makes console pilots contractually expensive on the two vendors that would have been the free/easy test beds (Datadog, Grafana); survivors are two edge cases (Slack channel invite; Sentry billing quotas) that neither concentrate on one vendor nor support a Grafana free-tier gate task.

Hand off to A7’s **seller portal-fill / trust-center visitor** slice under the time-box above. Keep A6 counsel checklist in force for whatever vertical is next — especially if any remaining work touches Datadog or Grafana consoles.

---

## Method notes (integrity)

- Joined A1–A3 × A4 × A5 on `task_id`; A6/A7 used for memo only.  
- No new API/Terraform/existence claims beyond cited census files.  
- FREQUENCY/PAIN drawn from A5 rows; BROWSER_ONLY from A4 verdicts with PARTIAL substantive vs trivial judgment as required by METHOD.

*Adjudicator: A8. Decision date: 2026-07-24.*

## Open questions / what I could not verify

- Pre-standard Week-0 artifact: see docs/INTEGRITY-AUDIT.md for evidence-table shape gaps vs CONTRIBUTING.
- Follow-ups after this FAIL are owned by Track 2 / C5 — not reopened here.
