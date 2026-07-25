import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  compileTrajectory,
  looksLikeTenantLiteral,
  orderLocatorCandidates,
  PACKAGE,
  validateCompiledBundle,
  type Trajectory,
} from "../../src/compiler/index.js";

describe("compiler package", () => {
  it("exports package id", () => {
    expect(PACKAGE).toBe("compiler");
  });
});

describe("locator preference order", () => {
  it("orders by B2 preference then rank", () => {
    const ordered = orderLocatorCandidates([
      { strategy: "structural", rank: 1 },
      { strategy: "role_name", rank: 2 },
      { strategy: "testid", rank: 1 },
      { strategy: "label", rank: 1 },
      { strategy: "text", rank: 1 },
    ]);
    expect(ordered.map((c) => c.strategy)).toEqual([
      "role_name",
      "label",
      "testid",
      "structural",
      "text",
    ]);
  });
});

describe("tenant literal heuristics", () => {
  it("flags emails and uuids; allows chrome labels and holes", () => {
    expect(looksLikeTenantLiteral("user@example.com")).toBe(true);
    expect(
      looksLikeTenantLiteral("550e8400-e29b-41d4-a716-446655440000"),
    ).toBe(true);
    expect(looksLikeTenantLiteral("Username")).toBe(false);
    expect(looksLikeTenantLiteral("http://{host}:{port}/login")).toBe(false);
  });
});

describe("compileTrajectory example", () => {
  it("emits one asserted cache-row per step with no tenant literals", async () => {
    const trajPath = path.join(
      process.cwd(),
      "contracts/examples/trajectory.example.json",
    );
    const trajectory = JSON.parse(
      await readFile(trajPath, "utf8"),
    ) as Trajectory;

    const bundle = compileTrajectory(trajectory, {
      compiledAt: "2026-07-25T00:00:00.000Z",
      inputPath: "contracts/examples/trajectory.example.json",
    });

    expect(bundle.bundle_kind).toBe("compiled_trajectory");
    expect(bundle.rows).toHaveLength(trajectory.steps.length);

    for (const row of bundle.rows) {
      expect(
        row.assertion.strength === "strong" ||
          row.assertion.strength === "weak",
      ).toBe(true);
      expect(row.assertion.notes).toBeTruthy();
      expect(row.compiled_action.locator_fallback_chain).toBeDefined();
      if (row.pool_eligible === false) {
        expect(row.pool_ineligible_reason).toBeTruthy();
      } else {
        expect(row.pool_ineligible_reason).toBeNull();
      }
    }

    expect(["element-visible", "url-matches"]).toContain(
      bundle.rows[0]!.assertion.type,
    );
    expect(bundle.rows[0]!.assertion.strength).toBe("strong");
    expect(bundle.rows[0]!.compiled_action.locator_fallback_chain).toEqual([]);
    expect(bundle.rows[0]!.pool_eligible).toBe(true);

    expect(bundle.rows[1]!.assertion.type).toBe("element-visible");
    expect(bundle.rows[1]!.assertion.strength).toBe("weak");
    expect(
      bundle.rows[1]!.compiled_action.locator_fallback_chain[0]!.strategy,
    ).toBe("role_name");
    expect(bundle.rows[1]!.pool_eligible).toBe(true);

    const validation = await validateCompiledBundle(bundle);
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);
  });
});
