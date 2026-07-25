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

export function sanitizeVersion(versionId: string): string {
  return versionId.replace(/[^a-zA-Z0-9._-]/g, "_");
}
