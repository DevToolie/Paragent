# A2 — Grafana Cloud Task Enumerator

**Role:** Grafana Cloud task enumerator (Week-0 Task Census)  
**Access date for all cited URLs:** 2026-07-24  
**Scope:** Candidate console tasks a platform/DevOps engineer performs in Grafana Cloud (stack UI + Cloud Portal). Browser-only guesses are hypotheses for A4 to falsify — not verdicts.

---

## Free-tier baseline (sourced)

Official Free plan messaging and limits used for `free_tier_ok`:

| Cap / note | Source |
| --- | --- |
| Free = “All Grafana Cloud services, with limited usage”; 14-day retention for metrics/logs/traces/profiles/k6 | https://grafana.com/pricing/ |
| Metrics: 10k active series/mo; Logs/Traces/Profiles: 50 GB ingested each/mo | https://grafana.com/pricing/ |
| Visualization: 3 active Grafana users/mo | https://grafana.com/pricing/ |
| IRM: 3 active IRM users/mo | https://grafana.com/pricing/ |
| Synthetics: 100k API test executions & 10k browser test executions/mo | https://grafana.com/pricing/ |
| Frontend Observability: 50k sessions/mo (product card) / summary table also lists 100k sessions — **CONFIDENCE: MED** on which figure is current for Free | https://grafana.com/pricing/ |
| k6 Performance Testing: 500 VUh/mo | https://grafana.com/pricing/ |
| Adaptive Telemetry / Adaptive Metrics included on Free messaging | https://grafana.com/products/cloud/free-tier/ ; Adaptive Metrics GA on free forever: https://grafana.com/blog/adaptive-metrics-grafana-cloud-announcement/ |
| Custom branding: Cloud Free = login title and footer links only; full custom branding = Cloud Pro | https://grafana.com/docs/grafana-cloud/security-and-account-management/cloud-portal/ |
| Enterprise plugins: paid add-on (not Free default) | https://grafana.com/pricing/ |
| Excess Free usage discarded (not billed) | https://community.grafana.com/t/what-happens-when-my-usage-exceed-the-free-plan-limitations/102795 |

**Test-bed implication:** Feature configuration UIs are generally available on Free within usage caps. Tasks that require **>3 active Grafana users**, **Enterprise plugins**, **full custom branding**, or **sustained ingestion above Free caps** are marked `N` or `?`. Repeated agent runs that only mutate config (no heavy telemetry) are usually Fine; runs that install Alloy and scrape production-scale series can blow the 10k series cap.

---

## Task census table

| task_id | vendor | task_name | one_line_description | ui_steps_est | observable_end_state | initial_browser_only_guess (Y/N/?) | why_guessed | free_tier_ok (Y/N/?) | evidence_urls | confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GC-01 | Grafana Cloud | Install OS integration via Connections | From Connections, pick an OS/server integration (e.g. Linux), follow Configuration details (Alloy install/token), Install dashboards/alerts | 10–15 | Integration shows Installed; prebuilt dashboard (e.g. Linux Node / Nodes) populates after scrape | N | Docs describe UI wizard but Alloy install is CLI on the host; A4 should check API/Terraform for integration install | Y | https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/get-started/ ; https://grafana.com/pricing/ | HIGH |
| GC-02 | Grafana Cloud | Add external data source | Connections → choose data source → fill connection settings → Save & test | 6–10 | Data source listed under Connections/Data sources; Save & test succeeds | N | Classic Grafana HTTP API + provisioning paths exist in docs ecosystem; guess not browser-only | Y | https://grafana.com/docs/grafana-cloud/connect-externally-hosted/data-sources/ ; https://grafana.com/docs/grafana-cloud/connect-externally-hosted/existing-datasource/ | HIGH |
| GC-03 | Grafana Cloud | Create dashboard folder | Dashboards → New → New folder → enter unique name → Create | 4–6 | Folder appears on Dashboards page with given title | N | Folder HTTP API documented | Y | https://grafana.com/docs/grafana-cloud/visualizations/dashboards/manage-dashboards/ ; https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/http-api/folder/ | HIGH |
| GC-04 | Grafana Cloud | Create Grafana-managed alert rule | Alerts & IRM → Alerting → New alert rule → define query/condition → Save rule | 8–12 | Alert rule appears in Alert rules list with configured name/state | N | Alerting docs mention provisioning via files, Terraform, Alerting API | Y | https://grafana.com/docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/ ; https://grafana.com/docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/ | HIGH |
| GC-05 | Grafana Cloud | Create contact point | Alerting → Notification configuration → Contact points → + New contact point → integration fields → Save | 6–9 | Contact point listed on Contact points tab; optional Test sends test notification | N | Contact points export to Terraform/JSON/YAML mentioned in same UI docs | Y | https://grafana.com/docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/ | HIGH |
| GC-06 | Grafana Cloud | Add notification child policy | Alerting → Notification policies → +New child policy → label matchers → contact point → Save | 6–10 | Child policy visible under default policy tree with matchers and contact point | N | Notification policy tree is core Alertmanager config; typically API/Terraform-manageable (hypothesis) | Y | https://grafana.com/docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-notification-policy/ | HIGH |
| GC-07 | Grafana Cloud | Create SLO | Alerts & IRM → SLO → + Create SLO → time window, SLI, target, optional alerts → save | 8–12 | SLO listed with target/window; SLO dashboard/recording rules created per docs | N | SLO create docs describe UI; A4 to check API/Terraform — not asserted here | Y | https://grafana.com/docs/grafana-cloud/alerting-and-irm/slo/create/ | MED |
| GC-08 | Grafana Cloud | Initialize Synthetic Monitoring plugin | Testing & synthetics → Synthetics → Initialize the plugin | 3–5 | Synthetics app initialized; checks UI available | ? | Plugin init may be one-time UI; checks themselves have API/Terraform stories — init step uncertain | Y | https://grafana.com/docs/grafana-cloud/synthetic-monitoring/installation/ | MED |
| GC-09 | Grafana Cloud | Create Synthetic Monitoring HTTP/API check | Synthetics → Create/Add new check → API Endpoint → target, probes, frequency → Save/Submit | 7–12 | Check listed on Checks page; Uptime/Reachability/Latency populate after executions | N | Synthetic Monitoring is a product with documented check types; IaC/API likely (hypothesis for A4) | Y | https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/create-checks/checks/http/ ; https://www.grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/get-started/create-your-first-check/ ; https://grafana.com/pricing/ | HIGH |
| GC-10 | Grafana Cloud | Enable per-check Synthetic alerts | Edit/create check → Alerting → Per-check alerts → enable alert types → save; optionally add notification policy matching `namespace=synthetic_monitoring` | 8–14 | Per-check alerts enabled on check; firing routes to contact point when policy set | N | Alerts ride Grafana Alerting/notification policies | Y | https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/configure-alerts/configure-per-check-alerts/ | HIGH |
| GC-11 | Grafana Cloud | Create Frontend Observability (RUM) application | Frontend → Frontend Apps → Create new → App Name, CORS origins, attributes → Create; copy instrumentation snippet | 6–10 | Frontend app exists; Web SDK Configuration shows collector URL/snippet | ? | App creation is console-led; instrumentation is code-side — API for app create not searched deeply here | Y | https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/quickstart/ ; https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/ ; https://grafana.com/pricing/ | MED |
| GC-12 | Grafana Cloud | Connect AWS account for CloudWatch scrape | Observability → Cloud Provider → AWS → create IAM role (console/CFN) → connect account in Grafana UI → Add scrape job | 12–20 | AWS account connected; scrape job listed; CloudWatch metrics appear in Grafana Cloud | N | Docs explicitly support Terraform and CloudFormation for scrape jobs | Y | https://grafana.com/docs/grafana-cloud/monitor-infrastructure/monitor-cloud-provider/aws/cloudwatch-metrics/config-cw-metric-scrape/ ; https://grafana.com/docs/grafana-cloud/monitor-infrastructure/monitor-cloud-provider/aws/ | HIGH |
| GC-13 | Grafana Cloud | Apply Adaptive Metrics recommendation | Adaptive Metrics → Rules → select recommendation(s) → Apply → confirm | 5–8 | Rule shows as applied; series impact reflected on Rules/Overview | N | Docs state manage via UI, API, or Terraform | Y | https://grafana.com/docs/grafana-cloud/adaptive-telemetry/adaptive-metrics/manage-recommendations/ ; https://grafana.com/docs/grafana-cloud/adaptive-telemetry/adaptive-metrics/ ; https://grafana.com/blog/adaptive-metrics-grafana-cloud-announcement/ | HIGH |
| GC-14 | Grafana Cloud | Create Cloud Access Policy + token | Cloud Portal Security → Access Policies (or Administration → Cloud access policies) → Create access policy → create token | 7–12 | Access policy listed; token secret shown once | N | Docs list Cloud Access Policy API as a management method | Y | https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/create-access-policies/ ; https://grafana.com/docs/grafana-cloud/security-and-account-management/cloud-portal/ | HIGH |
| GC-15 | Grafana Cloud | Create service account + token | Administration → Users and access → Service accounts → Add service account → Create → Generate token | 6–10 | Service account listed; token generated for Grafana HTTP API use | N | Service account HTTP API documented on same page | Y | https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/service-accounts/ ; https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/ | HIGH |
| GC-16 | Grafana Cloud | Invite org member in Cloud Portal | grafana.com Cloud Portal → Org Settings → Members → Invite New Member → email + role → Invite | 5–7 | Invitation email sent; member appears in Members list after accept | ? | Portal invite is UI; org settings also have API snippet for MFA — invite API not verified here | Y* | https://grafana.com/docs/grafana-cloud/security-and-account-management/cloud-portal/ ; https://grafana.com/pricing/ | MED |
| GC-17 | Grafana Cloud | Enforce org-wide MFA | Cloud Portal → Org Settings → Enforce MFA checkbox → Update | 3–5 | Enforce MFA checked; members without MFA redirected to setup on next sign-in | N | Same doc shows equivalent org settings API (`mfaRequired`) | Y | https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/mfa/ | HIGH |
| GC-18 | Grafana Cloud | Configure stack SAML / SSO settings | Stack auth admin / SSO settings flow for SAML (or Cloud Portal SAML under Security) | 10–20 | SAML provider configured; users can sign in via IdP (or settings saved in SSO Settings) | ? | Stack SAML supported; SSO Settings API exists; Cloud Portal SAML is Private Preview — browser-only unclear | ? | https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/ ; https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/http-api/sso-settings/ ; https://grafana.com/docs/grafana-cloud/security-and-account-management/cloud-portal/ | MED |
| GC-19 | Grafana Cloud | Install catalog plugin | Administration → Plugins and data → Plugins → All → select plugin → Install → refresh until ready | 5–8 | Plugin status Installed / available in catalog for the stack | N | Docs document Terraform install path for Cloud plugins | Y** | https://grafana.com/docs/grafana-cloud/introduction/find-and-use-plugins/ ; https://grafana.com/pricing/ | HIGH |
| GC-20 | Grafana Cloud | Create billing/usage cost alert | Open Billing/Usage dashboard → panel ellipsis → New alert rule → set threshold → Save rule and exit | 7–12 | Alert rule exists against billing panel / `grafanacloud-usage` queries | N | Standard Grafana-managed alert; docs also show manual Alert rules path | Y | https://grafana.com/docs/grafana-cloud/cost-management-and-billing/set-up/set-up-usage-alerts/ | HIGH |
| GC-21 | Grafana Cloud | Create IRM escalation chain | IRM → Escalation Chains → New escalation chain → add steps → Save | 6–10 | Escalation chain listed with configured steps | N | Docs include Terraform provider and OnCall API for escalation chains | Y*** | https://grafana.com/docs/grafana-cloud/alerting-and-irm/irm/escalation-and-routing/escalation-chains/ ; https://grafana.com/pricing/ | HIGH |
| GC-22 | Grafana Cloud | Set custom stack domain (CNAME) | Cloud Portal → stack Grafana Details → Update Instance → set name/URL → create DNS CNAME → Update Instance URL to custom domain | 8–12 | Instance URL uses custom domain; Grafana reachable at that hostname | Y | Multi-step DNS + portal form; docs present as portal UI (support not required for custom domain) | Y | https://grafana.com/docs/grafana-cloud/security-and-account-management/cloud-portal/ | HIGH |

\*GC-16: Free allows inviting members, but **active Grafana users capped at 3/mo** — inviting a 4th who logs in hits the Free user limit ([pricing](https://grafana.com/pricing/)). Mark `Y` only if staying ≤3 active users.  
\*\*GC-19: Catalog/community plugins OK; **Enterprise plugins are a paid add-on** — installing Enterprise plugins → `free_tier_ok = N` ([pricing](https://grafana.com/pricing/)).  
\*\*\*GC-21: IRM Free includes **3 active IRM users/mo**; escalation chains that notify beyond that set hit the cap ([pricing](https://grafana.com/pricing/)).

---

## Additional candidates noted but not expanded to full rows

These appear in official nav/docs and may be worth A4/A5 follow-up; not counted toward the 15+ distinct tasks above:

| Candidate | Why not fully enumerated | Evidence |
| --- | --- | --- |
| Full custom branding via Support ticket | Support-ticket flow; Free only gets login title/footer | https://grafana.com/docs/grafana-cloud/security-and-account-management/cloud-portal/ |
| Enable login form / LDAP via Support | Explicitly “Contact Support” | Same |
| Application Observability host onboarding | Separate APM product; UI steps not fully walked this pass | Pricing includes App O11y host hours: https://grafana.com/pricing/ |
| Private Data Source Connect (PDC) | Mentioned for private network data sources | https://grafana.com/docs/grafana-cloud/connect-externally-hosted/existing-datasource/ |
| CloudWatch metric streams (Firehose) | Alternate to scrape; heavy AWS console + Grafana | https://grafana.com/docs/grafana-cloud/monitor-infrastructure/monitor-cloud-provider/aws/cloudwatch-metrics/metric-streams/ |
| On-call schedule create in IRM UI | Docs emphasize IaC/API; UI steps exist but less detailed here | https://grafana.com/docs/grafana-cloud/alerting-and-irm/irm/on-call-schedules/schedules-as-code/ |

---

## Notes

### Method
- Walked Cloud Portal Overview sidebar (Stacks, Security/Access Policies, Billing, Org Settings/Members) and stack product areas documented under Connections, Dashboards, Alerting & IRM/SLO, Testing & Synthetics, Frontend, Cloud Provider AWS, Adaptive Metrics, Administration (plugins, service accounts).
- `ui_steps_est` counts distinct UI actions implied by official how-tos (not including external DNS/AWS IAM console clicks unless the task itself is hybrid).
- `initial_browser_only_guess` is a **hypothesis**. Where docs already name Terraform/API/export, guess is **N**. Where only UI + Private Preview / support is documented, guess is **Y** or **?**.

### Free-tier flags for the Paragent test-bed
- **Generally OK on Free (`Y`):** dashboards/folders, alerts, contact points, policies, SLOs, synthetics (within execution caps), Frontend Observability app create (within session caps), Adaptive Metrics, access policies, service accounts, MFA enforce, billing alerts, IRM escalation (within 3 IRM users), OS integrations (watch series/log ingestion), AWS Cloud Provider connect (watch series).
- **Not OK or constrained (`N` / `?`):** full custom branding (Pro); Enterprise plugins; Cloud Portal SAML Private Preview availability on Free unverified (`?`); inviting/logging in >3 Grafana users; sustained metrics >10k series or >50 GB logs/traces.
- **Hybrid tasks:** GC-01 (Alloy CLI), GC-12 (AWS IAM/CloudFormation), GC-22 (DNS CNAME) require non-Grafana consoles even when Grafana UI is involved.

### Confidence legend
- **HIGH:** Official docs give explicit UI steps or named limits used in the row.
- **MED:** Feature documented but Free availability, exact nav labels, or browser-only status partially uncertain.
- **LOW:** Not used in table rows; would require stronger primary sources.

### Explicit absences (do not treat as “does not exist”)
- Deep API inventory for each task → **out of scope (A4)**.
- Frequency/pain scoring → **out of scope (A5)**.
- No API found for Frontend Observability app CRUD in this pass (searched: Frontend Observability quickstart / instrument docs only) — write as **no API found (searched: Frontend Observability get-started/quickstart pages)** for A4 follow-up, not “no API exists.”

---

*Enumerator: A2 (Grafana Cloud). Access date: 2026-07-24.*
