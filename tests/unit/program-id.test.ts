/**
 * One carrier for the `program_id` convention (ADR-0013, #120).
 *
 * Before #120 the convention lived in exactly one place and could not drift,
 * because exactly one thing produced a program id. #120 makes the **compiler**
 * write that same identity onto every cache row, so a program resolved from the
 * cache and the same program adapted from its bundle now have to agree on it —
 * and the moment two files each hold a `"prog-"` template literal, they can
 * disagree silently. That is the #74 failure mode, which
 * `tests/unit/landmarks.test.ts` guards for the visibility predicate; this is
 * the same guard for the same reason.
 *
 * The equality test below is the one that would actually catch a regression:
 * the single-carrier scan proves nobody re-typed the string, and the round trip
 * proves the two ends of the pipeline still meet in the middle.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { PROGRAM_ID_PREFIX, programIdFor } from "../../src/shared/program-id.js";
import { compileTrajectory } from "../../src/compiler/compile.js";
import { bundleToProgram } from "../../src/runner/program.js";
import type { Trajectory } from "../../src/compiler/types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const fingerprint = (url: string) => ({
  url_template: url,
  title_template: "Fixture",
  dom_digest: "digest",
  visible_landmarks: ["main"],
  network_idle: true,
});

/** Minimal two-step trajectory — enough to compile and adapt. */
function trajectory(): Trajectory {
  return {
    schema_version: "1.0.0",
    trajectory_id: "traj-program-id-guard",
    site_key: "fixture@local",
    task_key: "two-step",
    recorded_at: "2026-08-11T10:00:00.000Z",
    base_url_template: "http://{host}:{port}/",
    provenance: {
      recorder: "test",
      agent_model: "human",
      testbed_version: "fixture-v1",
    },
    parameters: { host: "string", port: "integer" },
    steps: [
      {
        step_index: 0,
        intent: "Open the app",
        action: { type: "navigate" as const, url_template: "http://{host}:{port}/" },
        locator_candidates: [],
        pre_state: fingerprint("http://{host}:{port}/"),
        post_state: fingerprint("http://{host}:{port}/"),
        timing_ms: { started_offset_ms: 0, duration_ms: 5 },
      },
      {
        step_index: 1,
        intent: "Save",
        action: { type: "click" as const },
        locator_candidates: [
          { strategy: "role_name" as const, rank: 0, role: "button", name: "Save" },
        ],
        pre_state: fingerprint("http://{host}:{port}/"),
        post_state: fingerprint("http://{host}:{port}/saved"),
        timing_ms: { started_offset_ms: 5, duration_ms: 5 },
      },
    ],
  } as unknown as Trajectory;
}

describe("program id has exactly one carrier", () => {
  it("no file under src/ re-types the prefix literal", async () => {
    const src = path.join(ROOT, "src");
    const entries = await readdir(src, { withFileTypes: true, recursive: true });
    const carriers: string[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      const file = path.join(entry.parentPath, entry.name);
      if ((await readFile(file, "utf8")).includes(`"${PROGRAM_ID_PREFIX}"`)) {
        carriers.push(path.relative(src, file).replace(/\\/g, "/"));
      }
    }
    expect(carriers).toEqual(["shared/program-id.ts"]);
  });

  it("the scan is capable of firing", () => {
    // Guards the guard: an empty prefix would make the scan above vacuous.
    expect(PROGRAM_ID_PREFIX.length).toBeGreaterThan(0);
  });
});

describe("the compiler and the runner reach the same id", () => {
  it("a compiled row's program_id equals the adapted program's program_id", () => {
    // The two ends of the pipeline: the compiler stamps identity onto rows so a
    // resolver can group them, and `bundleToProgram` derives the same id from
    // the bundle. If these ever disagree, a cache-resolved program and a
    // bundle-resolved program describe the same task under two names and
    // nothing downstream can join them.
    const bundle = compileTrajectory(trajectory());
    const program = bundleToProgram(bundle, "11.0.0");

    expect(program.program_id).toBe(programIdFor("traj-program-id-guard"));
    for (const row of bundle.rows) {
      expect(row.program?.program_id).toBe(program.program_id);
    }
  });

  it("every compiled row records the program's true length", () => {
    // `steps_total` is the whole point of the entity — a resolver cannot derive
    // it from the rows it happens to hold.
    const bundle = compileTrajectory(trajectory());
    expect(bundle.rows).toHaveLength(2);
    for (const row of bundle.rows) {
      expect(row.program?.steps_total).toBe(2);
      expect(row.program?.compiled_at).toBe(bundle.compiled_at);
    }
  });
});
