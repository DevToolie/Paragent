import { describe, it, expect } from "vitest";
import { parseArgs } from "../../src/testbed/args.js";
import { PACKAGE } from "../../src/testbed/constants.js";
import { buildComposeEnv } from "../../src/testbed/docker.js";
import {
  getVersion,
  loadMatrix,
  testdataTypeFor,
} from "../../src/testbed/matrix.js";
import { composeProjectSlug } from "../../src/testbed/paths.js";
import {
  canonicalJson,
  diffFingerprints,
  flattenPanels,
  sortPanels,
  type SeedFingerprint,
} from "../../src/testbed/verify.js";

describe("testbed matrix", () => {
  it("exposes package id", () => {
    expect(PACKAGE).toBe("testbed");
  });

  it("loads at least 8 Grafana versions", () => {
    const m = loadMatrix();
    expect(m.target).toBe("grafana-oss");
    expect(m.versions.length).toBeGreaterThanOrEqual(8);
    expect(m.versions.map((v) => v.id)).toContain("9.5.21");
    expect(m.versions.map((v) => v.id)).toContain("13.0.3");
  });

  it("resolves a known version", () => {
    const v = getVersion("11.0.0");
    expect(v.image_tag).toBe("11.0.0");
  });

  it("selects TestData plugin type by major", () => {
    expect(testdataTypeFor("9.5.21")).toBe("testdata");
    expect(testdataTypeFor("10.0.13")).toBe("grafana-testdata-datasource");
    expect(testdataTypeFor("11.0.0")).toBe("grafana-testdata-datasource");
    expect(testdataTypeFor("13.0.3")).toBe("grafana-testdata-datasource");
  });
});

describe("compose project name", () => {
  // `docker compose -p paragent-tb-11.0.0` is rejected outright: project names
  // allow no dots. Every matrix id has them, so the slug must strip them.
  it("produces a compose-legal slug for every matrix version", () => {
    for (const v of loadMatrix().versions) {
      const env = buildComposeEnv({
        versionId: v.id,
        imageTag: v.image_tag,
        provisioningDir: "/tmp/provisioning",
      });
      expect(env.COMPOSE_PROJECT_NAME).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
    }
  });

  it("maps dots to hyphens", () => {
    expect(composeProjectSlug("11.0.0")).toBe("11-0-0");
    expect(composeProjectSlug("9.5.21")).toBe("9-5-21");
  });
});

describe("testbed args", () => {
  it("parses --version and flags", () => {
    const a = parseArgs([
      "--version",
      "11.0.0",
      "--port",
      "3001",
      "--dry-run",
      "--skip-seed",
    ]);
    expect(a.version).toBe("11.0.0");
    expect(a.port).toBe(3001);
    expect(a.dryRun).toBe(true);
    expect(a.skipSeed).toBe(true);
    expect(a.down).toBe(false);
  });

  it("parses --list and --down", () => {
    expect(parseArgs(["--list"]).list).toBe(true);
    expect(parseArgs(["--version", "9.5.21", "--down"]).down).toBe(true);
  });

  it("rejects unknown flags", () => {
    expect(() => parseArgs(["--nope"])).toThrow(/unknown argument/);
  });
});

describe("verify args", () => {
  it("parses --verify --json", () => {
    const a = parseArgs(["--version", "11.0.0", "--verify", "--json"]);
    expect(a.verify).toBe(true);
    expect(a.json).toBe(true);
    expect(a.compare).toBeUndefined();
  });

  it("parses --compare with two versions and no --version", () => {
    const a = parseArgs(["--verify", "--compare", "11.0.0", "12.0.0"]);
    expect(a.compare).toEqual(["11.0.0", "12.0.0"]);
  });

  it("parses --compare with one version alongside --version", () => {
    const a = parseArgs(["--version", "11.0.0", "--verify", "--compare", "12.0.0"]);
    expect(a.version).toBe("11.0.0");
    expect(a.compare).toEqual(["12.0.0"]);
  });

  it("does not swallow the flag that follows --compare", () => {
    const a = parseArgs(["--verify", "--compare", "11.0.0", "--dry-run"]);
    expect(a.compare).toEqual(["11.0.0"]);
    expect(a.dryRun).toBe(true);
  });

  it("rejects --compare with no version", () => {
    expect(() => parseArgs(["--verify", "--compare"])).toThrow(/one or two matrix ids/);
  });
});

describe("seed fingerprint canonicalisation", () => {
  // The gate compares two instances that differ only in Grafana version. If the
  // fingerprint is not byte-stable, a diff proves nothing.
  const fp = (): SeedFingerprint => ({
    dashboard: {
      panel_count: 2,
      panels: [
        { title: "Paragent Random Walk", type: "timeseries" },
        { title: "Paragent Stat", type: "stat" },
      ],
      title: "Paragent Seed",
      uid: "paragent-seed",
    },
    datasource: { name: "Paragent TestData", queryable: true, uid: "paragent-testdata" },
    users: { operator_present: true, operator_role: "Editor" },
  });

  it("is byte-identical under key reordering", () => {
    const reordered = {
      users: { operator_role: "Editor", operator_present: true },
      datasource: { uid: "paragent-testdata", queryable: true, name: "Paragent TestData" },
      dashboard: {
        uid: "paragent-seed",
        title: "Paragent Seed",
        panels: [
          { type: "timeseries", title: "Paragent Random Walk" },
          { type: "stat", title: "Paragent Stat" },
        ],
        panel_count: 2,
      },
    } as unknown as SeedFingerprint;
    expect(canonicalJson(reordered)).toBe(canonicalJson(fp()));
  });

  it("is byte-identical on a re-fetch of identical input", () => {
    expect(canonicalJson(fp())).toBe(canonicalJson(fp()));
  });

  it("sorts panels so Grafana's array order cannot leak in", () => {
    const shuffled = sortPanels([
      { title: "Paragent Stat", type: "stat" },
      { title: "Paragent Random Walk", type: "timeseries" },
    ]);
    expect(shuffled.map((p) => p.title)).toEqual([
      "Paragent Random Walk",
      "Paragent Stat",
    ]);
  });

  it("flattens row-nested panels and drops the row itself", () => {
    const flat = flattenPanels([
      { type: "row", title: "A row", panels: [{ title: "Inner", type: "stat" }] },
      { title: "Top", type: "timeseries" },
    ]);
    expect(flat).toEqual([
      { title: "Inner", type: "stat" },
      { title: "Top", type: "timeseries" },
    ]);
  });

  it("reports no differences for equal fingerprints", () => {
    expect(diffFingerprints(fp(), fp())).toEqual([]);
  });

  it("names the path of a real difference", () => {
    const other = fp();
    other.dashboard.panel_count = 3;
    const diffs = diffFingerprints(fp(), other);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.path).toBe("dashboard.panel_count");
    expect(diffs[0]!.left).toBe(2);
    expect(diffs[0]!.right).toBe(3);
  });

  it("catches a panel-set difference, which is the seeding artifact that matters", () => {
    const other = fp();
    other.dashboard.panels = [{ title: "Paragent Random Walk", type: "timeseries" }];
    const diffs = diffFingerprints(fp(), other);
    expect(diffs.map((d) => d.path)).toContain("dashboard.panels");
  });
});
