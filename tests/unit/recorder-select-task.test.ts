/**
 * The recorder's task_key decision, and site_key's product+version identity
 * (issue #124, ADR-0015).
 *
 * `resolveTaskKeyForRecording` and `buildLiveSiteKey` are imported from
 * `src/recorder/index.js` — never from `src/recorder/cli.js`. `cli.ts` runs
 * `main()` unconditionally on import (the `paragent` binary router, #134,
 * dispatches by dynamically importing it — see that module's header comment),
 * so importing it here would launch a browser and call `process.exit` as a
 * side effect of loading the test file.
 */
import { describe, expect, it } from "vitest";

import { buildLiveSiteKey, resolveTaskKeyForRecording } from "../../src/recorder/index.js";

const LIVE_DEFAULT = "create-stat-dashboard-from-testdata";

describe("resolveTaskKeyForRecording — --task-key wins outright", () => {
  it("uses the explicit task_key even when --intent is also given", () => {
    const result = resolveTaskKeyForRecording(
      { "task-key": "some-explicit-key", intent: "create a stat dashboard from testdata" },
      LIVE_DEFAULT,
    );
    expect(result).toEqual({ task_key: "some-explicit-key" });
  });
});

describe("resolveTaskKeyForRecording — --intent resolves through src/intent/", () => {
  it("resolves a cataloged phrase to its task_key and returns a note", () => {
    const result = resolveTaskKeyForRecording(
      { intent: "create a stat dashboard from testdata" },
      LIVE_DEFAULT,
    );
    expect("task_key" in result && result.task_key).toBe(
      "create-stat-dashboard-from-testdata",
    );
    expect("task_key" in result && result.note).toContain("intent resolved");
  });

  it("refuses (does not fall back to the default) when intent misses", () => {
    const result = resolveTaskKeyForRecording(
      { intent: "delete every user account on the instance" },
      LIVE_DEFAULT,
    );
    expect("errorMessage" in result).toBe(true);
    if ("errorMessage" in result) {
      expect(result.errorMessage).toContain("did not resolve");
    }
  });

  it("refuses on a near-miss phrase rather than resolving the closest task", () => {
    const result = resolveTaskKeyForRecording(
      { intent: "make me a stat panel using the testdata source" },
      LIVE_DEFAULT,
    );
    expect("errorMessage" in result).toBe(true);
  });
});

describe("resolveTaskKeyForRecording — neither flag falls back to the caller's default", () => {
  it("returns the default unchanged when no --task-key and no --intent are given", () => {
    expect(resolveTaskKeyForRecording({}, LIVE_DEFAULT)).toEqual({ task_key: LIVE_DEFAULT });
    expect(resolveTaskKeyForRecording({}, "login-open-dashboards-list")).toEqual({
      task_key: "login-open-dashboards-list",
    });
  });
});

describe("buildLiveSiteKey — product+version identity, never an address (ADR-0015)", () => {
  it("builds product@version", () => {
    expect(buildLiveSiteKey("grafana-oss", "9.5.21")).toBe("grafana-oss@9.5.21");
  });

  it("has no host or port parameter to vary — the same task at a different host resolves " +
    "to the same site_key by construction", () => {
    // The function's signature is the proof: there is no third argument for an
    // address, so two recordings of the same product+version, taken against
    // different hosts, cannot produce different site_keys — a caller cannot
    // even pass one in by mistake.
    expect(buildLiveSiteKey.length).toBe(2);
    const fromOneHost = buildLiveSiteKey("grafana-oss", "9.5.21");
    const fromAnotherHost = buildLiveSiteKey("grafana-oss", "9.5.21");
    expect(fromOneHost).toBe(fromAnotherHost);
    expect(fromOneHost).toBe("grafana-oss@9.5.21");
  });

  it("a different version is a different site_key — locators are version-specific (ADR-0006)", () => {
    expect(buildLiveSiteKey("grafana-oss", "9.5.21")).not.toBe(
      buildLiveSiteKey("grafana-oss", "13.0.3"),
    );
  });
});
