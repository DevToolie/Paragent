/**
 * The known-task table (issue #124).
 *
 * One entry per `task_key` the repo actually records against today —
 * `src/recorder/cli.ts`'s two tasks — with a handful of ways a person might
 * phrase the goal. Every description is a paraphrase of the ADR-0006 gate task
 * or the login/navigate fixture task; none names a parameter value, a
 * customer, or portal content (CONTRIBUTING rule 1) — "stat panel",
 * "TestData datasource" and "dashboard" are Grafana OSS's own generic product
 * vocabulary, already public throughout this repo's committed docs
 * (ADR-0003, ADR-0006), not tenant content.
 *
 * This table is intentionally small and hand-maintained. Growing it is safe —
 * `ExactNormalizedMatcher` treats two descriptions under different task_keys
 * that normalize to the same string as `ambiguous`, never as a tiebreak — but
 * growing it is also not this issue's job. #124 asks for the least clever
 * thing that works, not a comprehensive catalog.
 */
import type { KnownTask } from "./types.js";

export const KNOWN_TASKS: readonly KnownTask[] = [
  {
    // ADR-0006 gate task: build a Stat panel over the seeded TestData
    // datasource and save it as a named dashboard.
    task_key: "create-stat-dashboard-from-testdata",
    descriptions: [
      "create a stat dashboard from testdata",
      "build a stat panel using the testdata datasource",
      "make a stat panel dashboard from the test data source",
      "create a new dashboard with a stat panel backed by testdata",
      "add a stat visualization sourced from testdata and save the dashboard",
    ],
  },
  {
    // Fixture task recorded by `--fixture`: log in, land on the dashboards
    // list.
    task_key: "login-open-dashboards-list",
    descriptions: [
      "log in and open the dashboards list",
      "sign in and go to the list of dashboards",
      "log into grafana and view the dashboards list",
    ],
  },
] as const;
