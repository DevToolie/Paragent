/**
 * SC-04 tripwire — session material is not representable in the compiler's
 * input or the repair model's input (#101).
 *
 * This pins a property that is **already true**. `src/compiler/types.ts`'s
 * `Trajectory` / `TrajectoryStep` / `Fingerprint` and `src/runner/types.ts`'s
 * `PageStateSnapshot` have no cookie- or storage-shaped field, and
 * `contracts/trajectory.schema.json` sets `additionalProperties: false`
 * throughout, so one cannot ride along even if produced upstream. Nothing
 * pinned it, which meant a future field addition would silently reopen the
 * compiler's and the repair model's exposure with no CI signal
 * (`docs/privacy/session-custody.md`, SC-04).
 *
 * ## Why an instance walk alone would not be a tripwire
 *
 * The obvious test — serialize a real trajectory, grep the keys — passes for
 * the wrong reason. Adding `cookies?: string[]` to `Fingerprint` does not
 * populate it in a committed fixture, so an instance-only check stays green
 * through exactly the change it exists to catch. It also cannot see a
 * `additionalProperties: false` that someone relaxed.
 *
 * So this asserts at all three levels the guarantee actually rests on, and each
 * catches something the others cannot:
 *
 * | Level | Catches |
 * | --- | --- |
 * | Type surface | a field **declared** on any reachable interface, populated or not |
 * | Contract schema | a forbidden property, or a loosened `additionalProperties` |
 * | Instances | a value that reached a real artifact through an untyped path |
 *
 * Guard-proven: adding `cookies?: string[]` to `Fingerprint` in
 * `src/compiler/types.ts` fails the type-surface case while every instance
 * assertion stays green — which is the whole reason the first level exists.
 *
 * This is a tripwire, not new enforcement. SC-04's status is "enforced by
 * construction" with or without it; what changes is that the construction stays
 * that way on purpose rather than by nobody having changed it yet.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium, type Browser, type Page } from "playwright";
import { launchTestBrowser } from "../helpers/browser.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { compileTrajectory, type Trajectory } from "../../src/compiler/index.js";
import { capturePageState, emptyPageState } from "../../src/runner/page-state.js";
import type { RepairContext } from "../../src/runner/types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The forbidden set, from #101.
 *
 * Compared after normalization (lowercased, separators stripped) so
 * `storage_state`, `storageState` and `StorageState` are one entry rather than
 * three near-misses — a future field would realistically arrive in whichever
 * convention its author reached for, and a tripwire that only knows one spelling
 * is a tripwire with a gap in it.
 */
const FORBIDDEN = new Set([
  "cookie",
  "cookies",
  "storagestate",
  "localstorage",
  "sessionstorage",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, "");
}

function forbiddenIn(keys: Iterable<string>): string[] {
  const hits: string[] = [];
  for (const key of keys) {
    if (FORBIDDEN.has(normalizeKey(key))) hits.push(key);
  }
  return hits;
}

/** Every key appearing anywhere in a parsed JSON value, at any depth. */
function allKeysDeep(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) allKeysDeep(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      out.add(key);
      allKeysDeep(child, out);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Level 1 — the type surface
// ---------------------------------------------------------------------------

/**
 * Property names declared on a type and on every project-declared type
 * reachable from it.
 *
 * Uses the TypeScript compiler API because the thing being pinned is erased at
 * runtime: an optional field that nothing populates exists only in the
 * declaration, and the declaration is precisely what #101 is worried about
 * someone changing.
 *
 * Recursion stops at anything declared outside this repo (`node_modules`), so
 * walking a `string` does not drag in every method on `String.prototype`.
 */
function declaredPropertyNames(
  checker: ts.TypeChecker,
  type: ts.Type,
  seen = new Set<ts.Type>(),
  out = new Map<string, string>(),
): Map<string, string> {
  if (seen.has(type)) return out;
  seen.add(type);

  // A union/intersection carries no properties of its own worth reading here;
  // recurse into each constituent instead (e.g. `Fingerprint | undefined`).
  if (type.isUnionOrIntersection()) {
    for (const part of type.types) declaredPropertyNames(checker, part, seen, out);
    return out;
  }

  // `TrajectoryStep[]` — the interesting type is the element, not Array itself.
  const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
  for (const arg of typeArgs) declaredPropertyNames(checker, arg, seen, out);

  for (const prop of checker.getPropertiesOfType(type)) {
    const decl = prop.valueDeclaration ?? prop.declarations?.[0];
    if (!decl) continue;
    const file = decl.getSourceFile().fileName;
    if (file.includes("node_modules")) continue;
    out.set(prop.getName(), path.relative(ROOT, file));
    declaredPropertyNames(
      checker,
      checker.getTypeOfSymbolAtLocation(prop, decl),
      seen,
      out,
    );
  }
  return out;
}

/** Resolve an exported interface/type alias by name from a source file. */
function typeByName(
  program: ts.Program,
  checker: ts.TypeChecker,
  relFile: string,
  name: string,
): ts.Type {
  const source = program.getSourceFile(path.join(ROOT, relFile));
  if (!source) throw new Error(`tripwire could not load ${relFile}`);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const exported = moduleSymbol
    ? checker.getExportsOfModule(moduleSymbol).find((s) => s.getName() === name)
    : undefined;
  if (!exported) {
    // A rename is a real signal, not a test bug to route around: the type this
    // guarantee was verified against no longer exists under that name.
    throw new Error(`tripwire could not find exported type ${name} in ${relFile}`);
  }
  return checker.getDeclaredTypeOfSymbol(exported);
}

describe("SC-04 tripwire: the type surface cannot carry session material (#101)", () => {
  /** The types #101 names: the compiler's input, and the repair model's. */
  const roots: Array<[file: string, name: string]> = [
    ["src/compiler/types.ts", "Trajectory"],
    ["src/compiler/types.ts", "TrajectoryStep"],
    ["src/compiler/types.ts", "Fingerprint"],
    ["src/runner/types.ts", "PageStateSnapshot"],
    ["src/runner/types.ts", "RepairContext"],
  ];

  const program = ts.createProgram(
    roots.map(([file]) => path.join(ROOT, file)),
    {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    },
  );
  const checker = program.getTypeChecker();

  it.each(roots)("%s / %s declares no session-material field", (file, name) => {
    const props = declaredPropertyNames(checker, typeByName(program, checker, file, name));
    // Reachability is the point: Trajectory alone declares nine fields, but the
    // walk descends through steps -> TrajectoryStep -> pre_state -> Fingerprint,
    // so a field added on any of them fails here.
    expect(props.size).toBeGreaterThan(0);
    const hits = forbiddenIn(props.keys()).map((k) => `${k} (${props.get(k)})`);
    expect(hits, `session-material field reachable from ${name}`).toEqual([]);
  });

  it("actually reaches the nested types, not just the root's own fields", () => {
    // Guards the guard. If the recursion silently stopped at the root, every
    // case above would pass vacuously for types it never opened.
    const props = declaredPropertyNames(
      checker,
      typeByName(program, checker, "src/compiler/types.ts", "Trajectory"),
    );
    // dom_digest is declared on Fingerprint, which is two hops down:
    // Trajectory -> steps[] -> TrajectoryStep -> pre_state -> Fingerprint.
    expect([...props.keys()]).toContain("dom_digest");
    expect(props.get("dom_digest")).toBe("src/compiler/types.ts");
  });
});

// ---------------------------------------------------------------------------
// Level 2 — the contract schemas
// ---------------------------------------------------------------------------

/** Every `properties` key declared anywhere in a JSON Schema document. */
function schemaPropertyNames(node: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) schemaPropertyNames(item, out);
    return out;
  }
  if (node === null || typeof node !== "object") return out;
  for (const [key, child] of Object.entries(node)) {
    if (key === "properties" && child !== null && typeof child === "object") {
      for (const propName of Object.keys(child)) out.add(propName);
    }
    schemaPropertyNames(child, out);
  }
  return out;
}

/**
 * Object nodes that would accept an undeclared property.
 *
 * `additionalProperties: false` is the mechanism that makes a stray `cookies`
 * field *invalid* rather than merely unpopulated, so an object type that drops
 * it is the loosening #101 names. A schema **object** is fine and not a hole —
 * that is how `parameters` types its name->ParamType map, where the keys are
 * user-chosen but the values are still constrained.
 *
 * Only nodes that actually *define* an object type (`"type": "object"` with
 * `properties`) are checked. An applicator fragment — the `if` / `then` pair
 * under `cache-row.schema.json`'s `allOf`, which constrains
 * `pool_ineligible_reason` when `pool_eligible` is false — carries `properties`
 * without being an object definition, and closing one would be a bug rather
 * than a tightening: `additionalProperties: false` inside a `then` rejects
 * every property the branch does not itself mention, i.e. the whole rest of the
 * row. Do not "fix" this by dropping the `type` check; it fails four real nodes.
 */
function nodesAcceptingAnything(node: unknown, at = "$", out: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach((item, i) => nodesAcceptingAnything(item, `${at}[${i}]`, out));
    return out;
  }
  if (node === null || typeof node !== "object") return out;
  const obj = node as Record<string, unknown>;
  if (
    obj.type === "object" &&
    obj.properties !== undefined &&
    obj.additionalProperties !== false
  ) {
    out.push(`${at} (additionalProperties=${JSON.stringify(obj.additionalProperties)})`);
  }
  for (const [key, child] of Object.entries(obj)) {
    nodesAcceptingAnything(child, `${at}.${key}`, out);
  }
  return out;
}

describe("SC-04 tripwire: the contracts cannot represent session material (#101)", () => {
  /** The trajectory and everything downstream of it, per the SC-04 write-up. */
  const contracts = [
    "contracts/trajectory.schema.json",
    "contracts/cache-row.schema.json",
    "contracts/assertion.schema.json",
    "contracts/metrics.schema.json",
  ];

  it.each(contracts)("%s declares no session-material property", async (rel) => {
    const schema: unknown = JSON.parse(await readFile(path.join(ROOT, rel), "utf8"));
    const names = schemaPropertyNames(schema);
    expect(names.size).toBeGreaterThan(0);
    expect(forbiddenIn(names), `session-material property in ${rel}`).toEqual([]);
  });

  it.each(contracts)("%s closes every object to undeclared properties", async (rel) => {
    // The backstop that makes the above hold for fields nobody declared: an
    // accidental `cookies` is invalid, not merely absent.
    const schema: unknown = JSON.parse(await readFile(path.join(ROOT, rel), "utf8"));
    expect(nodesAcceptingAnything(schema), `open object in ${rel}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Level 3 — real artifacts
// ---------------------------------------------------------------------------

describe("SC-04 tripwire: real artifacts carry no session material (#101)", () => {
  /** Committed recordings plus the contract example, compiled for real. */
  const trajectories = [
    "contracts/examples/trajectory.example.json",
    "experiments/gate-v1/trajectories/grafana-fixture-login-dashboards.json",
    "experiments/gate-v1/trajectories/grafana-create-stat-dashboard-from-testdata-9.5.21.json",
  ];

  it.each(trajectories)("%s has no session-material key", async (rel) => {
    const traj: unknown = JSON.parse(await readFile(path.join(ROOT, rel), "utf8"));
    expect(forbiddenIn(allKeysDeep(traj)), `in ${rel}`).toEqual([]);
  });

  it.each(trajectories)("compiling %s introduces none either", async (rel) => {
    // The compiler is what #101 is about: its *output* is what reaches the
    // cache, so a field invented during compilation matters as much as one
    // carried in.
    const traj = JSON.parse(await readFile(path.join(ROOT, rel), "utf8")) as Trajectory;
    const bundle = compileTrajectory(traj, { compiledAt: "2026-08-06T00:00:00.000Z" });
    expect(bundle.rows.length).toBeGreaterThan(0);
    expect(forbiddenIn(allKeysDeep(bundle)), `compiled from ${rel}`).toEqual([]);
  });

  it("emptyPageState() carries no session material", () => {
    expect(forbiddenIn(allKeysDeep(emptyPageState()))).toEqual([]);
  });

  it("a RepairContext-shaped object carries no session material", async () => {
    // The repair model's whole input, assembled the way ReplayRunner assembles
    // it — page_state is the field that would carry session state if anything
    // did, but the surrounding envelope is shown to the model too.
    const traj = JSON.parse(
      await readFile(path.join(ROOT, trajectories[0]!), "utf8"),
    ) as Trajectory;
    const bundle = compileTrajectory(traj, { compiledAt: "2026-08-06T00:00:00.000Z" });
    const row = bundle.rows[0]!;
    const ctx: RepairContext = {
      run_id: "run-tripwire",
      step: {
        step_index: row.step_index,
        compiled_action: row.compiled_action,
        assertion: row.assertion,
      },
      assertion: row.assertion,
      failed_outcome: "LOCATOR_NOT_FOUND",
      page_state: emptyPageState({ url: "http://127.0.0.1:3000/", title: "Local" }),
      attempt: 1,
      params: {},
    };
    expect(forbiddenIn(allKeysDeep(ctx))).toEqual([]);
  });
});

describe("SC-04 tripwire: a live capturePageState carries no session material (#101)", () => {
  const chromiumAvailable = existsSync(chromium.executablePath());
  const liveIt = chromiumAvailable ? it : it.skip;
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    if (!chromiumAvailable) return;
    browser = await launchTestBrowser();
    page = await browser.newPage();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  liveIt("captures from a real page with cookies set, and carries none of them", async () => {
    // A real browser, deliberately: the type says PageStateSnapshot cannot hold
    // session state, but capturePageState builds the object by hand from live
    // browser APIs. This is the only level that would notice a spread or an
    // extra field added there — and the context genuinely has a cookie to leak,
    // so "no cookies present" is not the reason it passes.
    await page.context().addCookies([
      {
        name: "tripwire_session",
        value: "SYNTHETIC-not-a-real-session",
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    await page.setContent("<main role='main'>tripwire</main>");

    const state = await capturePageState(page);
    expect(state.visible_landmarks).toEqual(["main"]);
    expect(forbiddenIn(allKeysDeep(state))).toEqual([]);
    // Belt and braces: the cookie's value must not have ridden along inside a
    // permitted field either.
    expect(JSON.stringify(state)).not.toContain("SYNTHETIC-not-a-real-session");
  }, 60_000);
});
