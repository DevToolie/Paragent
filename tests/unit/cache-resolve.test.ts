/**
 * Program resolution out of a per-step cache (ADR-0013, #120).
 *
 * The test that matters most is the truncation one. Before #120 a resolver
 * given rows 0-3 of an 8-step flow had no way to know it was holding a prefix,
 * because **every individual row is valid in both cases** — the difference only
 * exists at the program level. The consequence was not a bad number; it was a
 * live browser executing half a flow and stopping inside a form.
 *
 * So these are grouped by the two questions ADR-0013 answers differently:
 *
 * 1. *Do I hold every step?* — structural, **fails closed**. A resolver never
 *    returns a program it cannot prove whole.
 * 2. *Are those steps still trustworthy?* — empirical, **reported only**. An
 *    invalidated program still resolves, with all of its rows. #64 pinned that
 *    invariant, and a read path is exactly where someone helpfully breaks it.
 */

import { describe, expect, it } from "vitest";

import { MemoryCacheStore } from "../../src/cache/store.js";
import { resolveProgram } from "../../src/cache/resolve.js";
import { applyOutcome } from "../../src/cache/confidence.js";
import { writeCacheRow } from "../../src/cache/write.js";
import type { CacheRow } from "../../src/cache/types.js";

const SITE = "grafana-oss@example";
const TASK = "create-stat-dashboard";
const COMPILED_AT = "2026-08-11T10:00:00.000Z";

function row(
  step_index: number,
  overrides: Partial<CacheRow> = {},
  program: Partial<CacheRow["program"]> = {},
): CacheRow {
  return {
    schema_version: "1.0.0",
    row_id: `cache-${SITE}-${TASK}-${step_index}`,
    site_key: SITE,
    task_key: TASK,
    step_index,
    program: {
      program_id: "prog-traj-1",
      steps_total: 3,
      compiled_at: COMPILED_AT,
      ...program,
    },
    compiled_action: {
      type: "click",
      locator_fallback_chain: [{ strategy: "role_name", role: "button", name: "Save" }],
    },
    assertion: { type: "element-visible", strength: "strong" },
    confidence: 1,
    success_count: 1,
    failure_count: 0,
    last_verified_at: COMPILED_AT,
    pool_eligible: true,
    pool_ineligible_reason: null,
    ...overrides,
  };
}

function storeWith(rows: CacheRow[]): MemoryCacheStore {
  const store = new MemoryCacheStore();
  for (const r of rows) store.write(r);
  return store;
}

describe("a complete program resolves", () => {
  it("returns every row, ordered, when 0..steps_total-1 are all present", () => {
    const store = storeWith([row(2), row(0), row(1)]);
    const result = resolveProgram(store, { site_key: SITE, task_key: TASK });

    expect(result.status).toBe("hit");
    if (result.status !== "hit") return;
    expect(result.rows.map((r) => r.step_index)).toEqual([0, 1, 2]);
    expect(result.steps_total).toBe(3);
    expect(result.program_id).toBe("prog-traj-1");
    expect(result.compiled_at).toBe(COMPILED_AT);
  });

  it("a hit always holds exactly steps_total rows — that is what hit means", () => {
    const store = storeWith([row(0), row(1), row(2)]);
    const result = resolveProgram(store, { site_key: SITE, task_key: TASK });
    if (result.status !== "hit") throw new Error("expected a hit");
    expect(result.rows).toHaveLength(result.steps_total);
  });

  it("does not resolve a task that was never written", () => {
    const result = resolveProgram(storeWith([row(0), row(1), row(2)]), {
      site_key: SITE,
      task_key: "some-other-task",
    });
    expect(result.status).toBe("miss");
    if (result.status !== "miss") return;
    expect(result.reason).toBe("no_rows");
  });
});

describe("incompleteness fails closed — no short program is ever returned", () => {
  it("a missing tail row is a MISS, not a 2-step program", () => {
    // The case that motivated #120: rows 0-1 of a 3-step flow. Both rows are
    // individually valid, so nothing below the program level can catch this.
    const result = resolveProgram(storeWith([row(0), row(1)]), {
      site_key: SITE,
      task_key: TASK,
    });
    expect(result.status).toBe("miss");
    if (result.status !== "miss") return;
    expect(result.reason).toBe("incomplete");
    expect(result.detail).toContain("missing step_index 2");
  });

  it("a gap in the middle is a MISS, even though the count looks plausible", () => {
    // Two rows present and a hole at 1. A resolver that only counted rows would
    // see "2 of 3" here and "2 of 3" above and treat them the same; a resolver
    // that checks contiguity reports the hole.
    const result = resolveProgram(storeWith([row(0), row(2)]), {
      site_key: SITE,
      task_key: TASK,
    });
    expect(result.status).toBe("miss");
    if (result.status !== "miss") return;
    expect(result.reason).toBe("incomplete");
    expect(result.detail).toContain("missing step_index 1");
  });

  it("a row past the declared end is a MISS — steps_total itself is suspect", () => {
    // A row at index 3 of a program claiming 3 steps means steps_total is
    // wrong, and steps_total is the only thing standing between a resolver and
    // a truncated replay. Refusing is the point.
    const result = resolveProgram(storeWith([row(0), row(1), row(2), row(3)]), {
      site_key: SITE,
      task_key: TASK,
    });
    expect(result.status).toBe("miss");
    if (result.status !== "miss") return;
    expect(result.detail).toContain("outside 0..2");
  });

  it("rows disagreeing about steps_total is a MISS, not a vote", () => {
    const store = storeWith([
      row(0),
      row(1),
      row(2, {}, { steps_total: 5 }),
    ]);
    const result = resolveProgram(store, { site_key: SITE, task_key: TASK });
    expect(result.status).toBe("miss");
    if (result.status !== "miss") return;
    expect(result.detail).toContain("disagree about steps_total");
  });

  it("rows with no program identity are a MISS with a reason, never a guess", () => {
    // Rows written before ADR-0013. The highest step_index present is a lower
    // bound on the program's length, never the length — so there is no honest
    // way to infer completeness, and "probably complete" is the failure this
    // whole change exists to prevent.
    const legacy = [row(0), row(1), row(2)].map((r) => {
      const { program: _dropped, ...rest } = r;
      return rest as CacheRow;
    });
    const result = resolveProgram(storeWith(legacy), { site_key: SITE, task_key: TASK });
    expect(result.status).toBe("miss");
    if (result.status !== "miss") return;
    expect(result.reason).toBe("no_program_ref");
    expect(result.detail).toContain("recompile");
  });

  it("the miss reason names the task, so a run log is readable", () => {
    const result = resolveProgram(storeWith([row(0)]), { site_key: SITE, task_key: TASK });
    if (result.status !== "miss") throw new Error("expected a miss");
    expect(result.site_key).toBe(SITE);
    expect(result.task_key).toBe(TASK);
  });
});

describe("a recompile does not strand the new version behind the old tail", () => {
  it("resolves the new short program and ignores the orphaned old rows", () => {
    // Recompiling a 5-step task down to 3 updates rows 0-2 and leaves 3-4 on
    // disk under the previous program_id (the store is last-write-wins per
    // step, and append-only — nothing deletes them). Pooled together they look
    // like a 5-row task with a version change in the middle. Grouped by
    // program_id, the new version is whole and the orphaned tail correctly has
    // no step 0.
    const store = storeWith([
      row(0, {}, { program_id: "prog-old", steps_total: 5, compiled_at: "2026-08-01T00:00:00.000Z" }),
      row(1, {}, { program_id: "prog-old", steps_total: 5, compiled_at: "2026-08-01T00:00:00.000Z" }),
      row(2, {}, { program_id: "prog-old", steps_total: 5, compiled_at: "2026-08-01T00:00:00.000Z" }),
      row(3, {}, { program_id: "prog-old", steps_total: 5, compiled_at: "2026-08-01T00:00:00.000Z" }),
      row(4, {}, { program_id: "prog-old", steps_total: 5, compiled_at: "2026-08-01T00:00:00.000Z" }),
      // The recompile overwrites 0-2 only.
      row(0, {}, { program_id: "prog-new", steps_total: 3 }),
      row(1, {}, { program_id: "prog-new", steps_total: 3 }),
      row(2, {}, { program_id: "prog-new", steps_total: 3 }),
    ]);

    const result = resolveProgram(store, { site_key: SITE, task_key: TASK });
    expect(result.status).toBe("hit");
    if (result.status !== "hit") return;
    expect(result.program_id).toBe("prog-new");
    expect(result.rows.map((r) => r.step_index)).toEqual([0, 1, 2]);
  });

  it("prefers the newer version when two are both complete", () => {
    const store = storeWith([
      row(0, { row_id: "old-0" }, { program_id: "prog-a", compiled_at: "2026-08-01T00:00:00.000Z" }),
      row(1, { row_id: "old-1" }, { program_id: "prog-a", compiled_at: "2026-08-01T00:00:00.000Z" }),
      row(2, { row_id: "old-2" }, { program_id: "prog-a", compiled_at: "2026-08-01T00:00:00.000Z" }),
    ]);
    // A second complete version at different step keys is not reachable through
    // the real store (last-write-wins per step), so this drives the tie-break
    // directly through the grouping: same steps, newer program.
    const newer = new MemoryCacheStore();
    for (const r of store.list()) newer.write(r);
    for (const i of [0, 1, 2]) {
      newer.write(row(i, {}, { program_id: "prog-b", compiled_at: "2026-08-09T00:00:00.000Z" }));
    }

    const result = resolveProgram(newer, { site_key: SITE, task_key: TASK });
    if (result.status !== "hit") throw new Error("expected a hit");
    expect(result.program_id).toBe("prog-b");
  });
});

describe("identity survives the rewrite path", () => {
  it("a program still resolves after every row has been replayed and rewritten", () => {
    // `finalize()` in write.ts builds each row explicitly rather than spreading,
    // so a field it forgets is silently dropped on every rewrite. For `program`
    // that failure would be quiet in the worst possible way: a task would become
    // unresolvable *because* it had been replayed successfully, and the cache
    // would look broken only for the tasks that were working.
    const store = storeWith([row(0), row(1), row(2)]);
    const ctx = { now: "2026-08-12T00:00:00.000Z" };

    for (const original of store.list({ site_key: SITE, task_key: TASK })) {
      writeCacheRow(applyOutcome(original, "pass", ctx), { store });
    }

    const result = resolveProgram(store, { site_key: SITE, task_key: TASK });
    expect(result.status).toBe("hit");
    if (result.status !== "hit") return;
    expect(result.rows).toHaveLength(3);
    expect(result.program_id).toBe("prog-traj-1");
    for (const r of result.rows) expect(r.program?.steps_total).toBe(3);
  });

  it("a repair rewrite keeps the row in its program", () => {
    // A repair changes what a step *does*; it never changes which program the
    // step belongs to. `forRewrite()` strips provenance and pool fields, so this
    // pins that it does not also strip identity.
    const store = storeWith([row(0), row(1), row(2)]);
    const target = store.get({ site_key: SITE, task_key: TASK, step_index: 1 })!;
    const repaired = applyOutcome(target, "repaired", {
      now: "2026-08-12T00:00:00.000Z",
      repair: {
        run_id: "run-1",
        repair_attempt: 1,
        corrected_action: {
          type: "click",
          locator_fallback_chain: [{ strategy: "testid", testid: "save" }],
        },
      },
    });
    writeCacheRow(repaired, { store });

    const result = resolveProgram(store, { site_key: SITE, task_key: TASK });
    expect(result.status).toBe("hit");
    if (result.status !== "hit") return;
    expect(result.rows[1]?.program?.program_id).toBe("prog-traj-1");
    expect(result.rows[1]?.repair_provenance?.run_id).toBe("run-1");
  });
});

describe("confidence is reported, never enforced (#64's invariant on the read path)", () => {
  const invalidated = { invalidated_at: "2026-08-10T00:00:00.000Z", confidence: 0.2 };

  it("an invalidated program still resolves, with all of its rows", () => {
    // The whole point. Dropping or refusing invalidated rows here would shrink
    // the step-validity denominator and inflate the headline gate number — the
    // exact optimisation ADR-0009 forbids, arriving through a new door.
    const store = storeWith([row(0), row(1, invalidated), row(2)]);
    const result = resolveProgram(store, { site_key: SITE, task_key: TASK });

    expect(result.status).toBe("hit");
    if (result.status !== "hit") return;
    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((r) => r.step_index)).toEqual([0, 1, 2]);
  });

  it("flags the program as invalidated when any single row is", () => {
    // "A flow is only as replayable as its worst step" — ADR-0013.
    const store = storeWith([row(0), row(1, invalidated), row(2)]);
    const result = resolveProgram(store, { site_key: SITE, task_key: TASK });
    if (result.status !== "hit") throw new Error("expected a hit");
    expect(result.invalidated).toBe(true);
    expect(result.invalidated_step_indices).toEqual([1]);
  });

  it("a healthy program is not flagged — the flag is not blanket", () => {
    // Counter-check: if `invalidated` were always true the assertion above
    // would pass for the wrong reason.
    const result = resolveProgram(storeWith([row(0), row(1), row(2)]), {
      site_key: SITE,
      task_key: TASK,
    });
    if (result.status !== "hit") throw new Error("expected a hit");
    expect(result.invalidated).toBe(false);
    expect(result.invalidated_step_indices).toEqual([]);
  });

  it("reports every invalidated step, not just the first", () => {
    const store = storeWith([row(0, invalidated), row(1), row(2, invalidated)]);
    const result = resolveProgram(store, { site_key: SITE, task_key: TASK });
    if (result.status !== "hit") throw new Error("expected a hit");
    expect(result.invalidated_step_indices).toEqual([0, 2]);
  });
});
