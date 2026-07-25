---
title: "A4 — Observability API/IaC adversary"
doc_type: research
status: killed
owner: A4
created: 2026-07-24
updated: 2026-07-24
confidence: HIGH
supersedes: null
sources_verified: true
---

# A4 — Adversary (API / Terraform / as-code falsification)

**Role:** Kill browser-only claims for every task in A1–A3.  
**Access date for all citations:** 2026-07-24  
**Stance:** Assume FULLY_API until search fails. PARTIAL names exact browser-bound sub-steps.  
**Providers checked:** DataDog/datadog (Terraform Registry), grafana/grafana (+ grafana-adaptive-metrics), jianyuan/sentry (Sentry-sponsored).

---

## Tasks I killed

FULLY_API falsifications (task is **dead** as an anchor for browser-agent value). Citation = single strongest kill link.

| task_id | A1–A3 guess | kill citation |
| --- | --- | --- |
| DD-01 | N | https://docs.datadoghq.com/api/latest/monitors/ (`POST /api/v1/monitor`) |
| DD-02 | N | https://docs.datadoghq.com/api/latest/dashboards.md (`POST /api/v1/dashboard`) |
| DD-03 | N | https://docs.datadoghq.com/api/latest/service-level-objectives.md (`POST /api/v1/slo`) |
| DD-04 | N | https://docs.datadoghq.com/api/latest/downtimes/ (`POST /api/v2/downtime`) |
| DD-07 | ? | https://registry.terraform.io/providers/DataDog/datadog/latest/docs/resources/integration_pagerduty (`datadog_integration_pagerduty_service_object`) |
| DD-08 | N | https://docs.datadoghq.com/api/latest/webhooks-integration/create-a-webhooks-integration/ (`POST .../webhooks`) |
| DD-09 | ? | https://registry.terraform.io/providers/datadog/datadog/latest/docs/resources/integration_aws_account |
| DD-10 | ? | https://docs.datadoghq.com/api/latest/azure-integration/ (`POST /api/v1/integration/azure`) |
| DD-11 | N | https://docs.datadoghq.com/api/latest/logs-pipelines.md (`POST /api/v1/logs/config/pipelines`) |
| DD-12 | N | https://docs.datadoghq.com/api/latest/logs-indexes.md (`POST /api/v1/logs/config/indexes`) |
| DD-13 | N | https://docs.datadoghq.com/api/latest/apm-retention-filters.md (`POST /api/v2/apm/config/retention-filters`) |
| DD-14 | ? | https://docs.datadoghq.com/api/latest/synthetics.md (`POST /api/v1/synthetics/tests/browser`) |
| DD-16 | ? | https://docs.datadoghq.com/api/latest/rum.md (`POST /api/v2/rum/applications`) |
| DD-18 | N | https://docs.datadoghq.com/api/latest/key-management.md (`POST /api/v2/api_keys`) |
| DD-19 | N | https://docs.datadoghq.com/api/latest/service-accounts.md (`POST /api/v2/service_accounts` + app keys) |
| DD-20 | N | https://docs.datadoghq.com/api/latest/roles.md (`POST /api/v2/roles`) |
| DD-21 | N | https://docs.datadoghq.com/api/latest/teams/ (`POST /api/v2/team`) |
| DD-22 | ? | https://docs.datadoghq.com/api/latest/incidents/ (`POST /api/v2/incidents/config/types`) |
| GC-02 | N | https://registry.terraform.io/providers/grafana/grafana/latest/docs (data sources via provider / HTTP API) |
| GC-03 | N | https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/http-api/folder/ |
| GC-04 | N | https://grafana.com/docs/grafana/latest/developers/http_api/alerting_provisioning/ (`POST /api/v1/provisioning/alert-rules`) |
| GC-05 | N | same (`POST /api/v1/provisioning/contact-points`) |
| GC-06 | N | https://grafana.com/docs/grafana/v12.4/alerting/set-up/provision-alerting-resources/terraform-provisioning/ (`grafana_notification_policy`) |
| GC-07 | N | https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/slo |
| GC-08 | ? | https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/synthetic_monitoring_installation |
| GC-09 | N | https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/synthetic_monitoring_check |
| GC-10 | N | check settings + `grafana_rule_group` / notification policy (same provisioning docs) |
| GC-11 | ? | https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/frontend_o11y_app |
| GC-12 | N | https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_provider_aws_account |
| GC-13 | N | https://grafana.com/docs/grafana-cloud/adaptive-telemetry/adaptive-metrics/manage-as-code/adaptive-metrics-api/ (`POST .../aggregations/rules`) |
| GC-14 | N | https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/ (`/v1/accesspolicies`, `/v1/tokens`) |
| GC-15 | N | https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_stack_service_account |
| GC-17 | N | https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/mfa/ (`POST https://grafana.com/api/orgs/<ORG_SLUG>/settings` `mfaRequired`) |
| GC-19 | N | https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_plugin_installation |
| GC-20 | N | same as GC-04 (`grafana_rule_group` / provisioning API) |
| GC-21 | N | https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/oncall_escalation_chain |
| GC-22 | Y | https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/cloud-api (`POST /api/instances/<STACK_SLUG>` with `url`) — DNS CNAME via DNS provider API, not Grafana UI |
| SN-01 | N | https://docs.sentry.io/api/projects/create-a-new-project.md |
| SN-02 | N | https://registry.terraform.io/providers/jianyuan/sentry/latest/docs (`sentry_team`) |
| SN-03 | N | https://docs.sentry.io/api/organizations/add-a-member-to-an-organization/ |
| SN-05 | ? | https://docs.sentry.io/api/organizations/update-an-organization.md (`require2FA`) |
| SN-09 | N | https://registry.terraform.io/providers/jianyuan/sentry/latest/docs/resources/issue_alert |
| SN-10 | N | https://docs.sentry.io/api/projects/update-ownership-configuration-for-a-project/ |
| SN-11 | ? | https://docs.sentry.io/api/events/update-an-issue/ (`status` resolved/ignored) |
| SN-12 | N | https://docs.sentry.io/api/crons/create-a-monitor/ |
| SN-13 | N | https://registry.terraform.io/providers/jianyuan/sentry/0.15.0-beta1/docs/resources/uptime_monitor |
| SN-14 | N | https://docs.sentry.io/api/projects/enable-spike-protection.md |
| SN-15 | N | https://docs.sentry.io/api/projects/create-a-new-client-key.md (`rateLimit`) |
| SN-16 | N | https://docs.sentry.io/api/projects.md (Update an Inbound Data Filter) |
| SN-19 | N | https://docs.sentry.io/api/dashboards/create-a-new-dashboard-for-an-organization/ |
| SN-20 | N | https://docs.sentry.io/api/discover/create-a-new-saved-query.md |

**Killed-list length: 51**

Also confirmed FULLY_API where A1–A3 already guessed **N** (still kills as browser-anchor candidates). Remaining rows are PARTIAL or NO_PATH_FOUND (see table).

---

## Verdict table

| task_id | api_endpoint_found | terraform_resource_found | cli_or_as_code_path | verdict | browser_bound_substeps | evidence_urls | search_queries_run | confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DD-01 | `POST /api/v1/monitor` | `datadog_monitor` | TF provider + official API clients | FULLY_API | — | https://docs.datadoghq.com/api/latest/monitors/ ; https://registry.terraform.io/providers/datadog/datadog/latest/docs/resources/monitor | Datadog API create monitor; datadog_monitor terraform | HIGH |
| DD-02 | `POST /api/v1/dashboard` | `datadog_dashboard` | dashboards-as-JSON via API/TF | FULLY_API | — | https://docs.datadoghq.com/api/latest/dashboards.md ; https://registry.terraform.io/providers/datadog/datadog/latest/docs/resources/dashboard | Datadog API dashboards; datadog_dashboard | HIGH |
| DD-03 | `POST /api/v1/slo` | `datadog_service_level_objective` (provider docs overview lists SLOs) | API + TF | FULLY_API | — | https://docs.datadoghq.com/api/latest/service-level-objectives.md ; https://registry.terraform.io/providers/Datadog/datadog/latest/docs | Datadog API SLO; datadog_service_level_objective | HIGH |
| DD-04 | `POST /api/v2/downtime` | `datadog_downtime_schedule` (searched; downtime schedule resource in provider ecosystem) | API | FULLY_API | — | https://docs.datadoghq.com/api/latest/downtimes/ | Datadog API downtime; datadog_downtime terraform | HIGH |
| DD-05 | Channel APIs exist; **workspace OAuth install path is UI/consent** (create integration marked deprecated) | no TF resource found for Slack OAuth workspace link | — | PARTIAL | Slack “Allow” OAuth / admin approval to connect workspace to Datadog | https://docs.datadoghq.com/api/latest/slack-integration/ ; https://docs.datadoghq.com/integrations/slack/ | Datadog Slack integration API OAuth | HIGH |
| DD-06 | `POST /api/v1/integration/slack/configuration/accounts/{account_name}/channels` | no dedicated TF channel resource found | — | PARTIAL | Slack-side `/invite @Datadog` (or equivalent bot membership) before channel is usable; API configures channel display after account exists | https://docs.datadoghq.com/api/latest/slack-integration/create-a-slack-integration-channel/ ; https://docs.datadoghq.com/integrations/slack/ | Datadog Slack create channel API | HIGH |
| DD-07 | PagerDuty service objects via integration API surface used by TF | `datadog_integration_pagerduty` + `datadog_integration_pagerduty_service_object` | TF | FULLY_API | — (Datadog handle creation given PD integration key; PD key itself via PagerDuty API/console is out-of-vendor but not Datadog-browser) | https://registry.terraform.io/providers/DataDog/datadog/latest/docs/resources/integration_pagerduty ; https://docs.datadoghq.com/integrations/pagerduty/ | datadog_integration_pagerduty terraform | HIGH |
| DD-08 | `POST /api/v1/integration/webhooks/configuration/webhooks` | `datadog_webhook` | TF | FULLY_API | — | https://docs.datadoghq.com/api/latest/webhooks-integration/create-a-webhooks-integration/ ; https://registry.terraform.io/providers/DataDog/datadog/latest/docs/resources/webhook | Datadog webhooks API; datadog_webhook | HIGH |
| DD-09 | AWS Integration APIs (account config) | `datadog_integration_aws_account` | TF + AWS IAM role via AWS TF/CLI (no Datadog UI required) | FULLY_API | — | https://registry.terraform.io/providers/datadog/datadog/latest/docs/resources/integration_aws_account ; https://docs.datadoghq.com/integrations/amazon-web-services/ | datadog_integration_aws_account terraform | HIGH |
| DD-10 | `POST /api/v1/integration/azure` | `datadog_integration_azure` | TF + Azure app registration via Azure API/CLI | FULLY_API | — | https://docs.datadoghq.com/api/latest/azure-integration/ ; https://registry.terraform.io/providers/DataDog/datadog/latest/docs/resources/integration_azure | Datadog Azure integration API terraform | HIGH |
| DD-11 | `POST /api/v1/logs/config/pipelines` | `datadog_logs_custom_pipeline` (provider manages log pipelines) | API + TF | FULLY_API | — | https://docs.datadoghq.com/api/latest/logs-pipelines.md ; https://docs.datadoghq.com/integrations/terraform/ | Datadog logs pipelines API | HIGH |
| DD-12 | `POST /api/v1/logs/config/indexes` | logs indexes managed via provider (docs overview) | API + TF | FULLY_API | — | https://docs.datadoghq.com/api/latest/logs-indexes.md | Datadog logs indexes API | HIGH |
| DD-13 | `POST /api/v2/apm/config/retention-filters` | `datadog_apm_retention_filter` (provider resource naming in registry searches) | API | FULLY_API | — | https://docs.datadoghq.com/api/latest/apm-retention-filters.md | Datadog APM retention filters API | HIGH |
| DD-14 | `POST /api/v1/synthetics/tests/browser` | `datadog_synthetics_test` (`type = "browser"`) | steps as JSON in API/TF (recorder optional) | FULLY_API | — | https://docs.datadoghq.com/api/latest/synthetics.md ; https://registry.terraform.io/providers/datadog/datadog/latest/docs/resources/synthetics_test | Datadog create browser test API; datadog_synthetics_test | HIGH |
| DD-15 | `POST /api/v1/synthetics/private-locations` | `datadog_synthetics_private_location` (provider) | config file from API; worker = Docker/host | PARTIAL | Install/run private location worker on host/container until location healthy (not Datadog REST; not browser but not “API-only end state”) | https://docs.datadoghq.com/api/latest/synthetics.md ; https://docs.datadoghq.com/synthetics/platform/private_locations/ | Datadog synthetics private locations API | HIGH |
| DD-16 | `POST /api/v2/rum/applications` | RUM apps via API (TF may wrap) | API | FULLY_API | — (end state = app IDs/tokens exist; traffic requires app deploy, not browser admin) | https://docs.datadoghq.com/api/latest/rum.md | Datadog RUM applications API | HIGH |
| DD-17 | `POST /api/v2/saml_configurations/idp_metadata` ; `PATCH .../saml_configurations/{uuid}` | no first-party SAML TF resource found | API for Datadog half | PARTIAL | IdP admin console: register Datadog SP, export metadata, attribute mapping; users’ first SSO link may be interactive | https://docs.datadoghq.com/api/latest/organizations/upload-idp-metadata.md ; https://docs.datadoghq.com/api/latest/organizations/update-a-saml-configuration/ | Datadog SAML API upload IdP metadata | HIGH |
| DD-18 | `POST /api/v2/api_keys` | `datadog_api_key` | API + TF | FULLY_API | — | https://docs.datadoghq.com/api/latest/key-management.md | Datadog API keys create | HIGH |
| DD-19 | `POST /api/v2/service_accounts` ; `POST .../application_keys` | service account resources in provider | API | FULLY_API | — | https://docs.datadoghq.com/api/latest/service-accounts.md | Datadog service accounts API | HIGH |
| DD-20 | `POST /api/v2/roles` ; grant permissions endpoints | `datadog_role` | API + TF | FULLY_API | — | https://docs.datadoghq.com/api/latest/roles.md | Datadog roles API | HIGH |
| DD-21 | `POST /api/v2/team` | `datadog_team` | API + TF | FULLY_API | — | https://docs.datadoghq.com/api/latest/teams/ | Datadog teams API create | HIGH |
| DD-22 | `POST /api/v2/incidents/config/types` (preview/unstable flag in clients) | incident type TF coverage not verified | API | FULLY_API | — | https://docs.datadoghq.com/api/latest/incidents/ | Datadog create incident type API | MED |
| DD-23 | **GET** usage attribution only (`/api/v1/usage/monthly-attribution` etc.) | no TF for tag config | reports via API; **tag key selection UI-only in docs** | NO_PATH_FOUND | Edit Tags (choose up to 3 keys) — no write API found | https://docs.datadoghq.com/account_management/billing/usage_attribution/ ; https://docs.datadoghq.com/api/latest/usage-metering/get-monthly-usage-attribution/ | Datadog usage attribution configure tags API; Update usage attribution | HIGH |
| DD-24 | no plan upgrade/downgrade endpoint found | none found | none found | NO_PATH_FOUND | Plan & Usage → Plan tab upgrade/downgrade / billing | https://docs.datadoghq.com/account_management/plan_and_usage/ | Datadog API upgrade plan billing change plan | HIGH |
| GC-01 | Connections / integration-management scopes exist; OS wizard installs Alloy | connections/cloud provider TF for some scrape jobs; not a full “OS integration tile” kill | Alloy install CLI on host | PARTIAL | Host-side Alloy/agent install with token; confirm scrape/dashboards populated | https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/get-started/ ; https://registry.terraform.io/providers/grafana/grafana/latest/docs | Grafana Cloud OS integration API Alloy terraform | MED |
| GC-02 | Grafana data source HTTP API | `grafana_data_source` | provisioning YAML + TF | FULLY_API | — | https://grafana.com/docs/grafana-cloud/connect-externally-hosted/data-sources/ ; provider docs | Grafana data source HTTP API terraform | HIGH |
| GC-03 | Folder HTTP API | `grafana_folder` | API + TF | FULLY_API | — | https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/http-api/folder/ | Grafana folder API | HIGH |
| GC-04 | `POST /api/v1/provisioning/alert-rules` | `grafana_rule_group` | TF + file provisioning | FULLY_API | — | https://grafana.com/docs/grafana/latest/developers/http_api/alerting_provisioning/ ; https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/rule_group | Grafana alerting provisioning API | HIGH |
| GC-05 | `POST /api/v1/provisioning/contact-points` | `grafana_contact_point` | TF | FULLY_API | — | https://grafana.com/docs/grafana/latest/developers/http_api/alerting_provisioning/ | Grafana contact points API terraform | HIGH |
| GC-06 | notification policy provisioning API | `grafana_notification_policy` | TF | FULLY_API | — | https://grafana.com/docs/grafana/v12.4/alerting/set-up/provision-alerting-resources/terraform-provisioning/ | Grafana notification policy terraform | HIGH |
| GC-07 | SLO API (export/create documented with TF) | `grafana_slo` | TF | FULLY_API | — | https://grafana.com/docs/grafana-cloud/alerting-and-irm/slo/set-up/terraform/ ; https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/slo | Grafana SLO terraform API | HIGH |
| GC-08 | SM install via Cloud/TF path | `grafana_synthetic_monitoring_installation` | TF (explicitly alternative to UI init) | FULLY_API | — | https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/synthetic_monitoring_installation | grafana_synthetic_monitoring_installation | HIGH |
| GC-09 | Synthetic Monitoring API | `grafana_synthetic_monitoring_check` | TF + Grizzly + SM API | FULLY_API | — | https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/synthetic_monitoring_check ; https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/set-up/provision-synthetic-monitoring-resources/ | grafana_synthetic_monitoring_check | HIGH |
| GC-10 | per-check alerts as check fields + Grafana alerting | check TF + `grafana_notification_policy` | TF | FULLY_API | — | https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/configure-alerts/configure-per-check-alerts/ | Grafana synthetic per-check alerts terraform | HIGH |
| GC-11 | Frontend Observability API (via access token) | `grafana_frontend_o11y_app` | TF | FULLY_API | — | https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/frontend_o11y_app ; https://grafana.com/docs/grafana-cloud/as-code/infrastructure-as-code/terraform/terraform-frontend-observability/ | grafana_frontend_o11y_app | HIGH |
| GC-12 | Cloud Provider AWS APIs | `grafana_cloud_provider_aws_account` (+ scrape job resources in provider) | TF + AWS IAM TF | FULLY_API | — | https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_provider_aws_account ; https://grafana.com/docs/grafana-cloud/monitor-infrastructure/monitor-cloud-provider/aws/ | grafana_cloud_provider_aws_account | HIGH |
| GC-13 | `GET/POST $URL/aggregations/rules` ; recommendations APIs | `grafana-adaptive-metrics_rule` / recommendations_config | Adaptive Metrics TF provider + HTTP API | FULLY_API | — | https://grafana.com/docs/grafana-cloud/adaptive-telemetry/adaptive-metrics/manage-as-code/adaptive-metrics-api/ ; https://grafana.com/docs/grafana-cloud/adaptive-telemetry/adaptive-metrics/manage-as-code/adaptive-metrics-terraform-provider/ | Adaptive Metrics API apply recommendations | HIGH |
| GC-14 | `/v1/accesspolicies` ; `/v1/tokens` | `grafana_cloud_access_policy` ; `grafana_cloud_access_policy_token` | Cloud API + TF | FULLY_API | — | https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/ ; https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/using-an-access-policy-token/ | Grafana Cloud Access Policy API | HIGH |
| GC-15 | Service account HTTP API; Cloud stack SA API | `grafana_cloud_stack_service_account` (+ token resource) | API + TF | FULLY_API | — | https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_stack_service_account ; https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/service-accounts/ | Grafana service account API terraform | HIGH |
| GC-16 | **no Cloud Portal invite path found** in Cloud API reference (scopes `invites:*` listed on access policies page only) | none found for grafana.com invites | Portal UI documented | NO_PATH_FOUND | Cloud Portal → Org Settings → Members → Invite (email accept) | https://grafana.com/docs/grafana-cloud/security-and-account-management/cloud-portal/ ; https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/ ; https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/cloud-api | Grafana Cloud API invite members; invites:write endpoint | MED |
| GC-17 | `POST https://grafana.com/api/orgs/<ORG_SLUG>/settings` `{"mfaRequired": true}` | none required | curl/API | FULLY_API | — | https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/mfa/ | Grafana Cloud MFA mfaRequired API | HIGH |
| GC-18 | SSO Settings HTTP API (stack) | SSO settings TF/API documented | API for stack SAML settings | PARTIAL | IdP-side app registration/metadata; Cloud Portal SAML Private Preview may still be UI if used | https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/http-api/sso-settings/ ; https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/ | Grafana SSO Settings API SAML | MED |
| GC-19 | `POST /api/instances/<STACK_SLUG>/plugins` | `grafana_cloud_plugin_installation` | Cloud API + TF | FULLY_API | — | https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/cloud-api ; https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_plugin_installation | Grafana Cloud plugin install terraform API | HIGH |
| GC-20 | same alerting provisioning as GC-04 | `grafana_rule_group` | TF | FULLY_API | — | https://grafana.com/docs/grafana-cloud/cost-management-and-billing/set-up/set-up-usage-alerts/ ; alerting provisioning API | Grafana billing usage alert terraform | HIGH |
| GC-21 | OnCall/IRM API | `grafana_oncall_escalation_chain` | TF + OnCall API | FULLY_API | — | https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/oncall_escalation_chain ; https://grafana.com/docs/grafana-cloud/alerting-and-irm/irm/escalation-and-routing/escalation-chains/ | grafana_oncall_escalation_chain | HIGH |
| GC-22 | `POST https://grafana.com/api/instances/<STACK_SLUG>` (`url` custom domain) | `grafana_cloud_stack` url field (provider/Pulumi docs) | Cloud API + DNS provider API | FULLY_API | — (CNAME via Route53/Cloudflare API; not Grafana browser) | https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/cloud-api ; https://grafana.com/docs/grafana-cloud/security-and-account-management/cloud-portal/ | Grafana Cloud custom domain API update stack | HIGH |
| SN-01 | `POST /api/0/teams/{org}/{team}/projects/` ; keys APIs | `sentry_project` ; `sentry_key` / data source | TF + API | FULLY_API | — | https://docs.sentry.io/api/projects/create-a-new-project.md ; https://registry.terraform.io/providers/jianyuan/sentry/latest/docs | Sentry create project API terraform | HIGH |
| SN-02 | Teams API (TF wraps) | `sentry_team` ; `sentry_team_member` | TF | FULLY_API | — | https://registry.terraform.io/providers/jianyuan/sentry/latest/docs ; https://blog.sentry.io/introducing-terraform-for-sentry/ | Sentry create team API terraform | HIGH |
| SN-03 | `POST /api/0/organizations/{org}/members/` | `sentry_organization_member` | API (personal token may be required per provider note) | FULLY_API | — | https://docs.sentry.io/api/organizations/add-a-member-to-an-organization/ | Sentry invite member API | HIGH |
| SN-04 | no SAML configure write API found in public API index | none found | UI Auth wizard | PARTIAL | IdP app registration + Sentry Auth configure/activate SSO (docs are UI-first) | https://docs.sentry.io/organization/authentication/sso/ ; https://docs.sentry.io/organization/authentication/sso/saml2/ ; https://docs.sentry.io/api/ | Sentry API configure SAML SSO | HIGH |
| SN-05 | `PUT /api/0/organizations/{org}/` `require2FA` | none required | API | FULLY_API | — | https://docs.sentry.io/api/organizations/update-an-organization.md | Sentry require2FA API | HIGH |
| SN-06 | no Slack workspace OAuth install API found | none for OAuth install | — | PARTIAL | Slack OAuth “Allow” / Add Workspace consent | https://docs.sentry.io/integrations/notification-incidents/slack/ ; https://docs.sentry.io/api/ | Sentry Slack install API OAuth | HIGH |
| SN-07 | no GitHub App install API that replaces GitHub UI | `sentry_organization_repository` may manage post-install links (not searched as kill) | — | PARTIAL | GitHub App install window + repo selection permissions | https://docs.sentry.io/integrations/source-code-mgmt/github/ | Sentry GitHub integration install API | HIGH |
| SN-08 | no Atlassian Marketplace install API found | none | — | PARTIAL | Jira/Atlassian Marketplace install + authorize orgs | https://docs.sentry.io/integrations/issue-tracking/jira/ | Sentry Jira Cloud install API marketplace | HIGH |
| SN-09 | Alert rules API (issue/metric) | `sentry_issue_alert` | TF + API | FULLY_API | — | https://registry.terraform.io/providers/jianyuan/sentry/latest/docs/resources/issue_alert | Sentry issue alert API terraform | HIGH |
| SN-10 | `PUT /api/0/projects/{org}/{project}/ownership/` | ownership via API; TF may wrap | API | FULLY_API | — | https://docs.sentry.io/api/projects/update-ownership-configuration-for-a-project/ | Sentry ownership rules API | HIGH |
| SN-11 | `PUT /api/0/organizations/{org}/issues/{id}/` (`status` resolved/ignored) | — | API + bulk mutate | FULLY_API | — | https://docs.sentry.io/api/events/update-an-issue/ ; https://docs.sentry.io/api/events/bulk-mutate-an-organizations-issues/ | Sentry update issue resolve archive API | HIGH |
| SN-12 | `POST /api/0/organizations/{org}/monitors/` | cron monitors via API; `sentry-cli` crons | API + CLI upsert | FULLY_API | — | https://docs.sentry.io/api/crons/create-a-monitor/ ; https://docs.sentry.io/cli/crons/ | Sentry create cron monitor API | HIGH |
| SN-13 | Uptime via API/TF resource | `sentry_uptime_monitor` (jianyuan ≥0.15 beta) | TF | FULLY_API | — | https://registry.terraform.io/providers/jianyuan/sentry/0.15.0-beta1/docs/resources/uptime_monitor | Sentry uptime monitor API terraform | MED |
| SN-14 | `POST /api/0/organizations/{org}/spike-protections/` | `sentry_project_spike_protection` (community/forks; official API exists) | API | FULLY_API | — | https://docs.sentry.io/api/projects/enable-spike-protection.md | Sentry enable spike protection API | HIGH |
| SN-15 | `POST/PUT .../keys/` with `rateLimit` | `sentry_key` | API + TF | FULLY_API | — | https://docs.sentry.io/api/projects/create-a-new-client-key.md | Sentry client key rate limit API | HIGH |
| SN-16 | Update inbound data filter (projects API index) | inbound filter TF resources exist in forks; official API listed | API | FULLY_API | — | https://docs.sentry.io/api/projects.md | Sentry inbound data filters API | HIGH |
| SN-17 | no subscription quota change API found | none | — | NO_PATH_FOUND | Settings → Subscription → Manage Subscription / Review & Confirm | https://docs.sentry.io/pricing/quotas/manage-event-stream-guide/ ; https://docs.sentry.io/api/ | Sentry API change subscription reserved quota billing | HIGH |
| SN-18 | **no create Organization Token API found**; docs/UI + sentry-cli login | none | creation documented as Settings UI / wizard | NO_PATH_FOUND | Developer Settings → Organization Tokens → create (or Internal Integration UI token mint) | https://docs.sentry.io/account/auth-tokens/ ; https://docs.sentry.io/api/guides/create-auth-token/ ; https://docs.sentry.io/cli/configuration/ | Sentry API create organization auth token | HIGH |
| SN-19 | `POST /api/0/organizations/{org}/dashboards/` | `sentry_dashboard` (provider blog/docs) | API + TF | FULLY_API | — | https://docs.sentry.io/api/dashboards/create-a-new-dashboard-for-an-organization/ | Sentry create dashboard API | HIGH |
| SN-20 | `POST /api/0/organizations/{org}/discover/saved/` | — | API | FULLY_API | — | https://docs.sentry.io/api/discover/create-a-new-saved-query.md | Sentry create discover saved query API | HIGH |
| SN-21 | no Seer feature-toggle API found | none found | — | NO_PATH_FOUND | Settings → Seer toggles; requires SCM install (SN-07) | https://docs.sentry.io/product/ai-in-sentry/seer/ ; https://docs.sentry.io/api/ | Sentry Seer API enable Autofix settings | MED |
| SN-22 | no create Internal Integration / Sentry App write API found in public docs | none | UI Developer Settings | NO_PATH_FOUND | Create New Integration → Internal → permissions → save → copy token | https://docs.sentry.io/integrations/integration-platform/internal-integration/ ; https://docs.sentry.io/api/guides/create-auth-token/ | Sentry API create internal integration | HIGH |
| SN-23 | issue linking may exist via integration APIs; **create/link Jira from issue not confirmed as public endpoint** | — | Alerts can create Jira issues (automation) | PARTIAL | Manual Linked Issues panel create/link in Issue Details (after SN-08) | https://docs.sentry.io/integrations/issue-tracking/jira/ ; https://docs.sentry.io/api/ | Sentry API link create Jira issue from issue | MED |
| SN-24 | ownership API covers rules; CODEOWNERS import/mappings UI | ownership API | — | PARTIAL | SCM app install (SN-07); Team/User Mappings UI under GitHub/GitLab Configure; CODEOWNERS import may remain UI | https://docs.sentry.io/product/issues/ownership-rules/ ; https://docs.sentry.io/integrations/source-code-mgmt/github/ ; https://docs.sentry.io/api/projects/update-ownership-configuration-for-a-project/ | Sentry CODEOWNERS API team mappings | MED |

---

## Counts

| verdict | count |
| --- | --- |
| FULLY_API | **51** |
| PARTIAL | **12** |
| NO_PATH_FOUND | **7** |
| **Total task rows** | **70** |

**Killed list length:** 51

**PARTIAL (12):** DD-05, DD-06, DD-15, DD-17, GC-01, GC-18, SN-04, SN-06, SN-07, SN-08, SN-23, SN-24.

**NO_PATH_FOUND (7):** DD-23, DD-24, GC-16, SN-17, SN-18, SN-21, SN-22.

---

## Adversary notes (for A8)

1. **Core observability CRUD is dead as an anchor.** Monitors/alerts, dashboards, SLOs, downtimes, keys, roles/teams, log pipelines/indexes, synthetic checks, RUM/Frontend apps, spike protection, ownership, Discover queries — all have documented REST and/or Terraform. A browser-agent cache competing with Datadog/Grafana/Sentry IaC is value-negative on these paths.

2. **Surviving browser-ish residue clusters at trust/billing edges:** Slack/GitHub/Jira OAuth & marketplace installs (DD-05/06, SN-06/07/08), IdP consoles for SAML (DD-17, GC-18, SN-04), billing/plan/quota UIs (DD-23/24, SN-17), minting first org auth tokens / internal integrations (SN-18/22), Cloud Portal member invite path not found in Cloud API docs (GC-16), Seer toggles (SN-21).

3. **PARTIAL ≠ good anchor.** Tasks that are 90% API with a 10% OAuth/IdP click are explicitly **not** vertical proof for a browser execution layer — competent teams automate the API half and eat the rare consent step manually.

4. **Cloud account connect (DD-09/10, GC-12) is FULLY_API under the census definition** when AWS/Azure IAM is done via those clouds’ APIs/Terraform plus Datadog/Grafana integration resources — the CloudFormation/console wizards are convenience, not necessity.

5. **Absence discipline:** NO_PATH_FOUND lists searches; do not treat as proof of nonexistence. Especially GC-16 (`invites:*` scopes exist without a documented path in the Cloud API page fetched) and SN-18/22 (token creation documented as UI).

## Open questions / what I could not verify

- Pre-standard Week-0 artifact: see docs/INTEGRITY-AUDIT.md for evidence-table shape gaps vs CONTRIBUTING.
- Follow-ups after this FAIL are owned by Track 2 / C5 — not reopened here.
