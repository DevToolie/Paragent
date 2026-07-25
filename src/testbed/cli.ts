#!/usr/bin/env node
/**
 * Grafana OSS test-bed CLI — bring up / tear down a seeded matrix version.
 *
 *   npm run testbed -- --version 11.0.0
 *   npm run testbed -- --version 11.0.0 --dry-run
 *   npm run testbed -- --list
 */
import { parseArgs, usage } from "./args.js";
import { DEFAULT_HOST_PORT, PACKAGE } from "./constants.js";
import {
  buildComposeEnv,
  composeConfig,
  composeDown,
  composeUp,
  dockerAvailable,
} from "./docker.js";
import { getVersion, listVersions, loadMatrix } from "./matrix.js";
import { prepareProvisioningOverlay } from "./provisioning.js";
import { seedInstance } from "./seed.js";

export { PACKAGE };

async function main(): Promise<void> {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    console.error(usage());
    process.exit(2);
    return;
  }

  if (args.help || process.argv.slice(2).length === 0) {
    console.log(usage());
    process.exit(0);
    return;
  }

  const matrix = loadMatrix();

  if (args.list) {
    console.log(`target: ${matrix.target} (${matrix.image})`);
    for (const v of listVersions(matrix)) {
      console.log(`  ${v.id.padEnd(10)}  ${v.released}  ${v.churn_role}`);
    }
    process.exit(0);
    return;
  }

  if (!args.version) {
    console.error("--version is required (or use --list / --help)");
    console.error(usage());
    process.exit(2);
    return;
  }

  const ver = getVersion(args.version, matrix);
  const provisioningDir = prepareProvisioningOverlay(ver.id);
  const env = buildComposeEnv({
    versionId: ver.id,
    imageTag: ver.image_tag,
    provisioningDir,
    hostPort: args.port,
  });
  const baseUrl = matrix.base_url_template.replace(
    "{port}",
    String(args.port ?? DEFAULT_HOST_PORT),
  );

  if (args.down) {
    if (!args.dryRun && !dockerAvailable()) {
      console.error("Docker daemon not available. Use --dry-run to validate plan only.");
      process.exit(1);
      return;
    }
    const r = composeDown(env, args.dryRun);
    process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    process.exit(r.ok ? 0 : 1);
    return;
  }

  console.log(`testbed: ${matrix.target} ${ver.id}`);
  console.log(`  image: ${matrix.image}:${ver.image_tag}`);
  console.log(`  url:   ${baseUrl}`);
  console.log(`  provisioning overlay: ${provisioningDir}`);

  const cfg = composeConfig(env, args.dryRun);
  if (!cfg.ok) {
    process.stderr.write(cfg.stderr || cfg.stdout);
    process.exit(1);
    return;
  }
  if (args.dryRun) {
    console.log(cfg.stdout);
    console.log("dry-run: skipping docker compose up and seed");
    process.exit(0);
    return;
  }

  if (!dockerAvailable()) {
    console.error(
      "Docker daemon not available. Compose + seed shipped; re-run when Docker is running, or use --dry-run.",
    );
    process.exit(1);
    return;
  }

  const up = composeUp(env, false);
  process.stdout.write(up.stdout);
  if (up.stderr) process.stderr.write(up.stderr);
  if (!up.ok) {
    process.exit(1);
    return;
  }

  if (!args.skipSeed) {
    console.log("seeding…");
    await seedInstance({ baseUrl, versionId: ver.id });
    console.log("seed ok");
  } else {
    console.log("skip-seed: provisioning only");
  }

  console.log(`ready: ${baseUrl}  (admin / fixture pass — see matrix.json fixture_note)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
