import { readFileSync } from "node:fs";
import { matrixPath } from "./paths.js";

export interface MatrixVersion {
  id: string;
  image_tag: string;
  released: string;
  churn_role: string;
  docker_hub_tag_url: string;
  github_release_url: string;
  whats_new_url?: string;
  access_date: string;
}

export interface Matrix {
  target: string;
  image: string;
  host_port_default: number;
  container_port: number;
  base_url_template: string;
  fixture_admin_user: string;
  fixture_admin_pass: string;
  fixture_note: string;
  versions: MatrixVersion[];
  sources: { label: string; url: string; access_date: string }[];
}

let cached: Matrix | undefined;

export function loadMatrix(path = matrixPath()): Matrix {
  if (cached && path === matrixPath()) return cached;
  const raw = JSON.parse(readFileSync(path, "utf8")) as Matrix;
  if (!Array.isArray(raw.versions) || raw.versions.length === 0) {
    throw new Error(`matrix has no versions: ${path}`);
  }
  if (path === matrixPath()) cached = raw;
  return raw;
}

export function getVersion(id: string, matrix = loadMatrix()): MatrixVersion {
  const hit = matrix.versions.find((v) => v.id === id || v.image_tag === id);
  if (!hit) {
    const known = matrix.versions.map((v) => v.id).join(", ");
    throw new Error(`unknown version "${id}". Known: ${known}`);
  }
  return hit;
}

/**
 * Grafana renamed the built-in TestData plugin id around v10.
 * <10 → `testdata`; ≥10 → `grafana-testdata-datasource`.
 * Source: https://grafana.com/docs/grafana/latest/datasources/testdata/configure/
 */
export function testdataTypeFor(versionId: string): string {
  const major = Number.parseInt(versionId.split(".")[0] ?? "", 10);
  if (!Number.isFinite(major)) {
    throw new Error(`cannot parse major from version "${versionId}"`);
  }
  return major < 10 ? "testdata" : "grafana-testdata-datasource";
}

export function listVersions(matrix = loadMatrix()): MatrixVersion[] {
  return [...matrix.versions];
}
