#!/usr/bin/env node
/**
 * Grafana OSS test-bed CLI — bring up / tear down a seeded matrix version.
 *
 *   npm run testbed -- --version 11.0.0
 *   npm run testbed -- --version 11.0.0 --dry-run
 *   npm run testbed -- --list
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
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
import { verifyFingerprintPath } from "./paths.js";
import { prepareProvisioningOverlay } from "./provisioning.js";
import { seedInstance } from "./seed.js";
import {
  buildFingerprint,
  canonicalJson,
  diffFingerprints,
  summarize,
  verifyPlan,
  VerifyError,
  type SeedFingerprint,
} from "./verify.js";

export { PACKAGE };

/** Read seeded state back and print (optionally save) the fingerprint. */
async function runVerify(
  versionId: string,
  baseUrl: string,
  opts: { json: boolean; dryRun: boolean },
): Promise<never> {
  if (opts.dryRun) {
    console.log(`verify plan for ${versionId} against ${baseUrl}:`);
    for (const line of verifyPlan()) console.log(`  ${line}`);
    console.log("dry-run: no HTTP calls made");
    process.exit(0);
  }

  let result;
  try {
    result = await buildFingerprint(baseUrl);
  } catch (err) {
    if (err instanceof VerifyError) {
      console.error(`verify failed: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  console.log(`verify: ${versionId} at ${baseUrl}`);
  console.log(summarize(result));

  if (opts.json) {
    const out = verifyFingerprintPath(versionId);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, canonicalJson(result.fingerprint), "utf8");
    console.log(`\nwrote ${path.relative(process.cwd(), out)}`);
  }
  process.exit(0);
}

function loadFingerprint(versionId: string): SeedFingerprint {
  const file = verifyFingerprintPath(versionId);
  if (!existsSync(file)) {
    console.error(
      `no saved fingerprint for ${versionId} (expected ${path.relative(process.cwd(), file)}).\n` +
        `Run: npm run testbed -- --version ${versionId} --verify --json`,
    );
    process.exit(1);
  }
  return JSON.parse(readFileSync(file, "utf8")) as SeedFingerprint;
}

/** Diff two saved fingerprints. Non-zero exit when they differ — this is the guard. */
function runCompare(left: string, right: string): never {
  const a = loadFingerprint(left);
  const b = loadFingerprint(right);
  const diffs = diffFingerprints(a, b);

  if (diffs.length === 0) {
    console.log(`compare ${left} vs ${right}: IDENTICAL seed fingerprint`);
    process.exit(0);
  }

  console.error(`compare ${left} vs ${right}: ${diffs.length} difference(s)`);
  for (const d of diffs) {
    console.error(`  ${d.path}`);
    console.error(`    ${left}: ${JSON.stringify(d.left)}`);
    console.error(`    ${right}: ${JSON.stringify(d.right)}`);
  }
  console.error(
    "\nSeed state differs across versions. A gate number measured against these\n" +
      "two instances would mix seeding artifacts with churn. Fix the seed or\n" +
      "record the divergence in docs/gate/testbed.md as a disclosed confound.",
  );
  process.exit(1);
}

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

  // Compare reads two saved files; it needs no daemon and no live instance.
  if (args.compare) {
    const [first, second] = args.compare;
    const left = second ? first! : args.version;
    const right = second ?? first!;
    if (!left) {
      console.error(
        "--compare with one version needs --version too (or pass both: --compare A B)",
      );
      process.exit(2);
      return;
    }
    runCompare(left, right);
    return;
  }

  if (!args.version) {
    console.error("--version is required (or use --list / --help)");
    console.error(usage());
    process.exit(2);
    return;
  }

  const ver = getVersion(args.version, matrix);
  const baseUrl = matrix.base_url_template.replace(
    "{port}",
    String(args.port ?? DEFAULT_HOST_PORT),
  );

  // Before the overlay is prepared: verify reads a *running* instance, and
  // prepareProvisioningOverlay rm -rf's the directory that instance has
  // bind-mounted. Verify needs nothing but the base URL.
  if (args.verify) {
    await runVerify(ver.id, baseUrl, {
      json: args.json,
      dryRun: args.dryRun,
    });
    return;
  }

  const provisioningDir = prepareProvisioningOverlay(ver.id);
  const env = buildComposeEnv({
    versionId: ver.id,
    imageTag: ver.image_tag,
    provisioningDir,
    hostPort: args.port,
  });

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
