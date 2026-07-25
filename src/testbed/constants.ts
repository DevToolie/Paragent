/** Shared constants for the Grafana OSS test-bed harness. */

export const PACKAGE = "testbed" as const;

/** Fixture admin login — local Docker only, not a production credential. */
export const FIXTURE_ADMIN_USER = "admin" as const;
export const FIXTURE_ADMIN_PASS = "paragent" as const;

/** Provisioned / seeded object UIDs (stable across matrix versions). */
export const SEED_DATASOURCE_UID = "paragent-testdata" as const;
export const SEED_DATASOURCE_NAME = "Paragent TestData" as const;
export const SEED_DASHBOARD_UID = "paragent-seed" as const;
export const SEED_FOLDER_UID = "paragent-folder" as const;
export const SEED_OPERATOR_LOGIN = "paragent-operator" as const;
export const SEED_OPERATOR_EMAIL = "operator@paragent.local" as const;
/** Fixture operator credential — local Docker only. */
export const SEED_OPERATOR_PASS = "paragent" as const;

export const DEFAULT_HOST_PORT = 3000 as const;
export const COMPOSE_PROJECT_PREFIX = "paragent-tb" as const;
