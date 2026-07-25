import { describe, it, expect } from "vitest";
import { parseArgs } from "../../src/testbed/args.js";
import { PACKAGE } from "../../src/testbed/constants.js";
import {
  getVersion,
  loadMatrix,
  testdataTypeFor,
} from "../../src/testbed/matrix.js";

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
