/**
 * Intent -> task_key resolution (issue #124, ADR-0015).
 *
 * The property that matters most: a near-miss is a MISS, never the "closest"
 * task. `ExactNormalizedMatcher` has no notion of "close" at all — it is
 * string equality after normalization — so the tests that matter are the ones
 * proving that closeness is not silently treated as a match.
 */
import { describe, expect, it } from "vitest";

import {
  ExactNormalizedMatcher,
  KNOWN_TASKS,
  normalizeIntentText,
  PACKAGE,
  resolveTaskIntent,
  type IntentMatcher,
  type IntentResolution,
  type KnownTask,
} from "../../src/intent/index.js";

describe("intent package", () => {
  it("exports package id", () => {
    expect(PACKAGE).toBe("intent");
  });
});

describe("normalizeIntentText", () => {
  it("lowercases", () => {
    expect(normalizeIntentText("Create A Stat Dashboard")).toBe("create a stat dashboard");
  });

  it("strips punctuation", () => {
    expect(normalizeIntentText("create a stat dashboard, from testdata!")).toBe(
      "create a stat dashboard from testdata",
    );
  });

  it("collapses internal whitespace and trims the ends", () => {
    expect(normalizeIntentText("  create  a   stat\tdashboard  ")).toBe("create a stat dashboard");
  });

  it("treats NFKC-equivalent forms the same", () => {
    // "ﬁ" (U+FB01, a single ligature glyph) vs "fi" (two letters) — NFKC folds
    // the ligature to its plain-letter expansion.
    expect(normalizeIntentText("conﬁgure")).toBe(normalizeIntentText("configure"));
  });

  it("normalizes a punctuation-only or blank string to empty", () => {
    expect(normalizeIntentText("   ")).toBe("");
    expect(normalizeIntentText("!!! ,,, ---")).toBe("");
  });
});

describe("resolveTaskIntent — exact and normalized match resolve (issue #124 example)", () => {
  it("resolves the issue's own example phrase", () => {
    const resolution = resolveTaskIntent("create a stat dashboard from testdata");
    expect(resolution).toMatchObject({
      status: "resolved",
      task_key: "create-stat-dashboard-from-testdata",
      method: "exact-normalized",
    });
  });

  it("resolves the same task through a different catalog phrasing", () => {
    const resolution = resolveTaskIntent("build a stat panel using the testdata datasource");
    expect(resolution).toMatchObject({
      status: "resolved",
      task_key: "create-stat-dashboard-from-testdata",
    });
  });

  it("resolves regardless of case, punctuation, and extra whitespace", () => {
    const resolution = resolveTaskIntent(
      "  CREATE a Stat Dashboard, FROM   testdata!!  ",
    );
    expect(resolution).toMatchObject({
      status: "resolved",
      task_key: "create-stat-dashboard-from-testdata",
    });
  });

  it("resolves the fixture task through its catalog phrasing", () => {
    const resolution = resolveTaskIntent("log in and open the dashboards list");
    expect(resolution).toMatchObject({
      status: "resolved",
      task_key: "login-open-dashboards-list",
    });
  });
});

describe("resolveTaskIntent — unrelated intent is a MISS, never nearest-neighbour", () => {
  it("misses on a wholly unrelated goal", () => {
    const resolution = resolveTaskIntent("delete every user account on the instance");
    expect(resolution).toMatchObject({ status: "miss", reason: "no_match" });
  });

  it("misses on the issue's own 'no key' example rather than picking the nearest task", () => {
    // Deliberately close to a catalog entry ("build a stat panel using the
    // testdata datasource") but not literally on file. An exact-normalized
    // matcher must not treat "close" as "resolved" — that is the whole point
    // of choosing this matcher first (#124 item 2/3).
    const resolution = resolveTaskIntent("make me a stat panel using the testdata source");
    expect(resolution.status).toBe("miss");
    if (resolution.status === "miss") {
      expect(resolution.reason).toBe("no_match");
    }
  });

  it("misses on an empty or punctuation-only query without touching the catalog", () => {
    expect(resolveTaskIntent("").status).toBe("miss");
    expect(resolveTaskIntent("   ")).toMatchObject({ status: "miss", reason: "empty_query" });
    expect(resolveTaskIntent("!!!")).toMatchObject({ status: "miss", reason: "empty_query" });
  });

  it("never returns needs_confirmation or a task_key on a miss", () => {
    const resolution = resolveTaskIntent("book a flight to paris");
    expect(resolution.status).toBe("miss");
    expect(resolution).not.toHaveProperty("task_key");
    expect(resolution).not.toHaveProperty("candidate_task_key");
  });
});

describe("ExactNormalizedMatcher — ambiguous catalog entries never resolve by tiebreak", () => {
  it("misses with reason 'ambiguous' when two task_keys share a normalized description", () => {
    const matcher = new ExactNormalizedMatcher();
    const catalog: KnownTask[] = [
      { task_key: "task-a", descriptions: ["do the thing"] },
      { task_key: "task-b", descriptions: ["do the thing"] },
    ];
    const resolution = matcher.match("Do The Thing!", catalog);
    expect(resolution).toMatchObject({ status: "miss", reason: "ambiguous" });
    if (resolution.status === "miss") {
      expect(resolution.detail).toContain("task-a");
      expect(resolution.detail).toContain("task-b");
    }
  });

  it("is unaffected by ambiguity elsewhere in the catalog", () => {
    const matcher = new ExactNormalizedMatcher();
    const catalog: KnownTask[] = [
      { task_key: "task-a", descriptions: ["do the thing"] },
      { task_key: "task-b", descriptions: ["do the thing"] },
      { task_key: "task-c", descriptions: ["do a different thing entirely"] },
    ];
    expect(matcher.match("do a different thing entirely", catalog)).toMatchObject({
      status: "resolved",
      task_key: "task-c",
    });
  });
});

describe("resolveTaskIntent — swappable matcher (issue #124 item 2)", () => {
  it("accepts an override matcher and catalog without touching the default table", () => {
    const stubResolution: IntentResolution = {
      status: "needs_confirmation",
      candidate_task_key: "some-task",
      matched_description: "some phrase",
      method: "stub-similarity",
      reason: "similarity below the auto-accept line — a chosen default, see ADR-0015",
    };
    const stubMatcher: IntentMatcher = {
      id: "stub-similarity",
      match: () => stubResolution,
    };
    const resolution = resolveTaskIntent("anything at all", {
      matcher: stubMatcher,
      catalog: [],
    });
    expect(resolution).toEqual(stubResolution);
  });

  it("the real default catalog contains at least the two recorder tasks", () => {
    const taskKeys = new Set(KNOWN_TASKS.map((t) => t.task_key));
    expect(taskKeys.has("create-stat-dashboard-from-testdata")).toBe(true);
    expect(taskKeys.has("login-open-dashboards-list")).toBe(true);
  });

  it("no catalog description carries a parameter-shaped literal", () => {
    // A cheap guard, not a full secret-scan substitute: descriptions must read
    // as goals, not as recorded values. Digits are the cheapest signal that a
    // parameter value leaked into a description (series counts, uids, ports).
    for (const task of KNOWN_TASKS) {
      for (const description of task.descriptions) {
        expect(description).not.toMatch(/\d/);
      }
    }
  });
});
