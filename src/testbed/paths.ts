import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo root (…/Paragent), two levels up from src/testbed. */
export function repoRoot(): string {
  return path.resolve(here, "../..");
}

export function testbedScriptsDir(): string {
  return path.join(repoRoot(), "scripts", "testbed");
}

export function matrixPath(): string {
  return path.join(testbedScriptsDir(), "matrix.json");
}

export function composeFilePath(): string {
  return path.join(testbedScriptsDir(), "docker-compose.yml");
}

export function provisioningTemplateDir(): string {
  return path.join(testbedScriptsDir(), "provisioning");
}

/** Per-version writable overlay under scripts/testbed/.runtime/<ver>/ */
export function runtimeDir(versionId: string): string {
  return path.join(testbedScriptsDir(), ".runtime", sanitizeVersion(versionId));
}

export function runtimeProvisioningDir(versionId: string): string {
  return path.join(runtimeDir(versionId), "provisioning");
}

/**
 * Saved seed fingerprint for `--verify --json`.
 *
 * Deliberately a sibling of `runtimeDir()`, not a child: `prepareProvisioningOverlay`
 * rm -rf's the per-version directory on every boot, which would delete the very
 * fingerprint a later `--compare` needs to read.
 */
export function verifyFingerprintPath(versionId: string): string {
  return path.join(
    testbedScriptsDir(),
    ".runtime",
    `verify-${sanitizeVersion(versionId)}.json`,
  );
}

export function sanitizeVersion(versionId: string): string {
  return versionId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Compose project names are stricter than filesystem paths: lowercase
 * alphanumerics, hyphens and underscores only, starting with a letter or digit.
 * Dots are legal in a directory name but rejected by `docker compose -p`, so
 * `11.0.0` has to become `11-0-0`.
 */
export function composeProjectSlug(versionId: string): string {
  return versionId
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/^[^a-z0-9]+/, "");
}
