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
 * Grafana renamed the built-in TestData plugin id at **10.2.0**, not at 10.0.
 *
 * The boundary used to be `major < 10`, which silently broke 10.0.13: the
 * overlay provisioned `type: grafana-testdata-datasource`, Grafana accepted and
 * listed the datasource, and every query then failed with
 * `{"messageId":"plugin.notRegistered","statusCode":404}` — panels rendered
 * "No data" behind an error badge. A presence check cannot see this; only
 * querying the datasource can.
 *
 * Measured 2026-07-27 (issue #23) by reading the plugin id out of each image:
 *
 *   docker run --rm --entrypoint sh grafana/grafana:<tag> \
 *     -c 'ls /usr/share/grafana/public/app/plugins/datasource/ | grep testdata'
 *
 *   9.5.21 testdata · 10.0.13 testdata · 10.1.0 testdata
 *   10.2.0 grafana-testdata-datasource · 10.3.0, 10.4.19, 11.x, 12.x, 13.x same
 *
 * The failure is **asymmetric**, which is why the default below leans old-side.
 * `grafana-testdata-datasource/plugin.json` declares `"aliasIDs": ["testdata"]`
 * on every post-rename pin including 13.0.3, so provisioning the *old* id on a
 * *new* Grafana resolves through the alias and queries fine; there is no reverse
 * alias, so the new id on an old Grafana is the silent 404 above. Guessing
 * old-side is currently free, guessing new-side is fatal.
 *
 * That also makes this branch a choice rather than a requirement — a constant
 * `testdata` would satisfy all eight pins as they stand. It is kept because
 * `aliasIDs` is undocumented surface a future major can drop, and because
 * provisioning the id the image actually ships describes the test-bed honestly.
 * Do not "simplify" it in either direction without re-reading
 * docs/gate/testbed.md.
 *
 * Docs: https://grafana.com/docs/grafana/latest/datasources/testdata/configure/
 */
export function testdataTypeFor(versionId: string): string {
  const parts = versionId.split(".");
  const major = Number.parseInt(parts[0] ?? "", 10);
  if (!Number.isFinite(major)) {
    throw new Error(`cannot parse major from version "${versionId}"`);
  }
  // A bare "10" is treated as 10.0 — the old side, which the asymmetry above
  // makes the safe way to be wrong.
  const minor = Number.parseInt(parts[1] ?? "0", 10);
  const preRename = major < 10 || (major === 10 && (Number.isFinite(minor) ? minor : 0) < 2);
  return preRename ? "testdata" : "grafana-testdata-datasource";
}

export function listVersions(matrix = loadMatrix()): MatrixVersion[] {
  return [...matrix.versions];
}
