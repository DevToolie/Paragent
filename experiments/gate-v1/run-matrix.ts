#!/usr/bin/env node
/**
 * Gate-v1 version matrix driver.
 * Live Playwright runs are not enabled yet — --dry-run is required (exit 2 otherwise).
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MetricsEmitter } from "../../src/metrics/emitter.js";
import { ReplayRunner } from "../../src/runner/replay.js";
import type { CompiledProgram } from "../../src/runner/types.js";
import type { StepOutcome } from "../../src/metrics/types.js";
import versionsDoc from "./versions.json" with { type: "json" };
import programFixture from "./fixtures/compiled-program.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "out");

function parseArgs(argv: string[]): {
  dryRun: boolean;
  help: boolean;
} {
  let dryRun = false;
  let help = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    if (a === "--help" || a === "-h") help = true;
  }
  return { dryRun, help };
}

function usage(): void {
  console.log(`Usage: npm run gate:matrix -- --dry-run

  --dry-run   Required for now. Emits zero-token metrics; no browser.
  --help      Show this help.

Live matrix runs exit with code 2 until B1 pins and live wiring land.
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }
  if (!args.dryRun) {
    console.error(
      "gate:matrix: live runs are not enabled yet. Pass --dry-run (exit 2).",
    );
    process.exit(2);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const ndjsonPath = path.join(OUT_DIR, "metrics.ndjson");
  const emitter = new MetricsEmitter(ndjsonPath);

  const program = programFixture as CompiledProgram;
  const versions = versionsDoc.versions ?? [];

  console.log(
    `gate:matrix dry-run — ${versions.length} version(s), program=${program.program_id}`,
  );

  for (const ver of versions) {
    const testbed = ver.testbed_version ?? ver.id;
    const runProgram: CompiledProgram = {
      ...program,
      site_key: ver.site_key ?? program.site_key,
      task_key: ver.task_key ?? program.task_key,
      testbed_version: testbed,
    };

    // Placeholder matrix: first-pass PASS outcomes, zero tokens. No invented rates.
    const dryOutcomes: StepOutcome[] = runProgram.steps.map(() => "PASS");
    const runner = new ReplayRunner({
      dryRun: true,
      dryRunOutcomes: dryOutcomes,
      metrics: emitter,
      maxRepairsPerRun: 2,
    });

    const result = await runner.run(runProgram, {
      base_url: "file://local-demo",
      resource_label: "widget",
    });

    console.log(
      JSON.stringify({
        version: testbed,
        run_id: result.run_id,
        task_success: result.task_success,
        repair_count: result.repair_count,
        steps_replay_valid: result.steps_replay_valid,
        steps_total: result.steps_total,
        note: "dry-run — tokens remain 0; not a gate measurement",
      }),
    );
  }

  await emitter.flush();
  console.log(`wrote ${ndjsonPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
