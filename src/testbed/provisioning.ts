import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SEED_DASHBOARD_UID, SEED_DATASOURCE_UID } from "./constants.js";
import { testdataTypeFor } from "./matrix.js";
import {
  provisioningTemplateDir,
  runtimeDir,
  runtimeProvisioningDir,
} from "./paths.js";

/**
 * Copy template provisioning into `.runtime/<ver>/provisioning` and rewrite
 * TestData plugin `type` (and dashboard panel datasource types) for the version.
 */
export function prepareProvisioningOverlay(versionId: string): string {
  const dest = runtimeProvisioningDir(versionId);
  const root = runtimeDir(versionId);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(provisioningTemplateDir(), dest, { recursive: true });

  const dsType = testdataTypeFor(versionId);
  rewriteDatasourceType(path.join(dest, "datasources", "testdata.yaml"), dsType);
  rewriteDashboardDatasourceTypes(
    path.join(dest, "dashboards", "json", `${SEED_DASHBOARD_UID}.json`),
    dsType,
  );
  return dest;
}

function rewriteDatasourceType(file: string, dsType: string): void {
  let body = readFileSync(file, "utf8");
  body = body.replace(
    /type:\s*(?:testdata|grafana-testdata-datasource)/g,
    `type: ${dsType}`,
  );
  writeFileSync(file, body, "utf8");
}

function rewriteDashboardDatasourceTypes(file: string, dsType: string): void {
  const dash = JSON.parse(readFileSync(file, "utf8")) as {
    panels?: Array<{
      datasource?: { type?: string; uid?: string };
      targets?: Array<{ datasource?: { type?: string; uid?: string } }>;
    }>;
  };
  for (const panel of dash.panels ?? []) {
    if (panel.datasource?.uid === SEED_DATASOURCE_UID || panel.datasource) {
      panel.datasource = { ...panel.datasource, type: dsType, uid: SEED_DATASOURCE_UID };
    }
    for (const t of panel.targets ?? []) {
      if (t.datasource) {
        t.datasource = { ...t.datasource, type: dsType, uid: SEED_DATASOURCE_UID };
      }
    }
  }
  writeFileSync(file, `${JSON.stringify(dash, null, 2)}\n`, "utf8");
}
