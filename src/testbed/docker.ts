import { spawnSync } from "node:child_process";
import { COMPOSE_PROJECT_PREFIX, DEFAULT_HOST_PORT } from "./constants.js";
import { composeFilePath, composeProjectSlug } from "./paths.js";

export interface ComposeEnv {
  GRAFANA_VERSION: string;
  HOST_PORT: string;
  PROVISIONING_DIR: string;
  COMPOSE_PROJECT_NAME: string;
}

export function buildComposeEnv(opts: {
  versionId: string;
  imageTag: string;
  provisioningDir: string;
  hostPort?: number;
}): ComposeEnv {
  const port = opts.hostPort ?? DEFAULT_HOST_PORT;
  return {
    GRAFANA_VERSION: opts.imageTag,
    HOST_PORT: String(port),
    PROVISIONING_DIR: opts.provisioningDir,
    COMPOSE_PROJECT_NAME: `${COMPOSE_PROJECT_PREFIX}-${composeProjectSlug(opts.versionId)}`,
  };
}

export function dockerAvailable(): boolean {
  const r = spawnSync("docker", ["info"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return r.status === 0;
}

function composeArgs(env: ComposeEnv, sub: string[]): string[] {
  return ["compose", "-f", composeFilePath(), "-p", env.COMPOSE_PROJECT_NAME, ...sub];
}

function runCompose(
  env: ComposeEnv,
  sub: string[],
  opts?: { dryRun?: boolean },
): { ok: boolean; stdout: string; stderr: string; status: number | null } {
  const args = composeArgs(env, sub);
  if (opts?.dryRun) {
    return {
      ok: true,
      stdout: `dry-run: docker ${args.join(" ")}\n` + `env: ${JSON.stringify(env, null, 2)}`,
      stderr: "",
      status: 0,
    };
  }
  const r = spawnSync("docker", args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    status: r.status,
  };
}

export function composeConfig(env: ComposeEnv, dryRun = false) {
  return runCompose(env, ["config"], { dryRun });
}

export function composeUp(env: ComposeEnv, dryRun = false) {
  return runCompose(env, ["up", "-d", "--pull", "missing", "--wait"], { dryRun });
}

export function composeDown(env: ComposeEnv, dryRun = false) {
  return runCompose(env, ["down", "--remove-orphans"], { dryRun });
}
