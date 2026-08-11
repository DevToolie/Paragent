/**
 * Cache persistence — the read side and an append-only JSONL store (#63).
 *
 * Until this file the cache was write-only: `CacheStore` had a single `write`,
 * and `runCanaryPipeline` passed a store whose `write` body was an empty
 * comment — a literal black hole. That was right for the B5 privacy work, which
 * only had to prove rows are *classified* correctly at write time. It cannot
 * support PRD §5.3,
 * where entries are confidence-weighted, self-invalidate, and are rewritten by
 * repair: none of that exists without a store that survives a process exit and
 * can be read back.
 *
 * Three properties are load-bearing, and each is tested:
 *
 * 1. **Append-only.** Every write is a new line; nothing is ever rewritten in
 *    place. The file *is* the audit trail for the privacy boundary — if a
 *    tenant string ever reached the pool file, a rewriting store would let the
 *    evidence be overwritten by the next correct write. Compaction, if it is
 *    ever needed, is a separate decision.
 *
 * 2. **Two files, never one.** Pool-eligible and tenant-scoped rows go to
 *    separate paths, routed on `row.pool_eligible`, so no bug in one code path
 *    can merge them. The rule is a single comparison and it is asserted from
 *    disk in the canary suite, not just in memory.
 *
 * 3. **The store is dumb.** `writeCacheRow()` remains the only gatekeeper; no
 *    validation lives here and nothing reaches a store without passing through
 *    it. A store that re-checks taint would invite the checks to drift apart,
 *    and a store that *skips* the check would be a privacy incident.
 *
 * Last write wins for a given `(site_key, task_key, step_index)` on read, while
 * every earlier version stays on disk. That is the combination §5.3 needs: a
 * current answer plus the history of how it got there.
 *
 * No new dependencies — NDJSON over `node:fs` is sufficient. A database would
 * be a much larger decision (ADR territory) and is not warranted to store a few
 * thousand rows.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import type { CacheRow } from "./types.js";

/** Identity of a cache entry. One row per step of one task on one site. */
export interface CacheKey {
  site_key: string;
  task_key: string;
  step_index: number;
}

export interface CacheListFilter {
  site_key?: string;
  task_key?: string;
}

/**
 * Storage surface. `write` is unchanged from the B5 shape; `get` and `list` are
 * the read side #63 adds.
 *
 * Deliberately synchronous. `writeCacheRow()` is synchronous and is called from
 * synchronous compiler code; making persistence async would push a promise
 * through the privacy boundary for no benefit at this size.
 */
export interface CacheStore {
  write(row: CacheRow): void;
  get(key: CacheKey): CacheRow | undefined;
  list(filter?: CacheListFilter): CacheRow[];
}

/**
 * Composite key. `\0` separates the parts because it cannot appear in a
 * `site_key` or `task_key` — joining on `:` would let
 * `("a:b", "c")` and `("a", "b:c")` collide into one entry.
 */
export function cacheKeyString(key: CacheKey): string {
  return `${key.site_key}\0${key.task_key}\0${key.step_index}`;
}

export function cacheKeyOf(row: CacheRow): CacheKey {
  return {
    site_key: row.site_key,
    task_key: row.task_key,
    step_index: row.step_index,
  };
}

function matchesFilter(row: CacheRow, filter?: CacheListFilter): boolean {
  if (filter?.site_key !== undefined && row.site_key !== filter.site_key) return false;
  if (filter?.task_key !== undefined && row.task_key !== filter.task_key) return false;
  return true;
}

/**
 * Total order for `list()`: `(site_key, task_key, step_index)`.
 *
 * `step_index` ascending is the part that matters — see `list()`. The two key
 * fields ahead of it only exist to make the whole result deterministic when a
 * filter spans more than one task, so that two runs over the same store produce
 * the same array rather than two different interleavings of the same rows.
 */
function byStepOrder(a: CacheRow, b: CacheRow): number {
  if (a.site_key !== b.site_key) return a.site_key < b.site_key ? -1 : 1;
  if (a.task_key !== b.task_key) return a.task_key < b.task_key ? -1 : 1;
  return a.step_index - b.step_index;
}

/**
 * Read side shared by both stores.
 *
 * The two implementations differ only in *where a write lands*; `get` and
 * `list` must behave identically or the memory store stops being a faithful
 * stand-in for the real one in tests. Sharing the code is the cheapest way to
 * guarantee that, and the contract test then checks it from the outside anyway.
 *
 * Rows are cloned on the way in and out so a caller cannot mutate stored state
 * by holding on to a reference — the cache is supposed to be updated through
 * `writeCacheRow()`, not by reaching into it.
 */
abstract class IndexedCacheStore implements CacheStore {
  /** Latest row per key. */
  protected readonly latest = new Map<string, CacheRow>();

  abstract write(row: CacheRow): void;

  protected index(row: CacheRow): CacheRow {
    const copy = structuredClone(row);
    this.latest.set(cacheKeyString(cacheKeyOf(copy)), copy);
    return copy;
  }

  get(key: CacheKey): CacheRow | undefined {
    const row = this.latest.get(cacheKeyString(key));
    return row ? structuredClone(row) : undefined;
  }

  /**
   * Rows in step order, **not** in the order they happen to sit in the index
   * (#121).
   *
   * Insertion order is not step order and cannot be made to be. `this.latest`
   * is a `Map`, so it iterates in insertion order, and `JsonlCacheStore` loads
   * the pool file to exhaustion before the tenant file — deliberately, see its
   * constructor. Within one process that is invisible, because rows go in as
   * they are written. After a reopen every pool row is inserted before every
   * tenant row, and a task with mixed eligibility (the normal case: 1 of the 12
   * rows in the only committed live bundle is pool-eligible) reads back with its
   * pool rows hoisted to the front.
   *
   * Assembling a program from that would replay a real flow out of order —
   * click before navigate, submit before fill — with every row individually
   * valid, which reads as ordinary churn rather than as a bug. `bundleToProgram`
   * already sorts for exactly this reason (`src/runner/program.ts`); the store
   * is the other way in, so ordering belongs here rather than in each caller.
   */
  list(filter?: CacheListFilter): CacheRow[] {
    return [...this.latest.values()]
      .filter((r) => matchesFilter(r, filter))
      .sort(byStepOrder)
      .map((r) => structuredClone(r));
  }
}

/**
 * In-memory store with the same semantics as the JSONL one, for tests.
 *
 * Shares the contract test with `JsonlCacheStore` — a fixture whose behaviour
 * quietly diverges from the real store is worse than no fixture, because the
 * suite then proves something about a thing that does not ship.
 */
export class MemoryCacheStore extends IndexedCacheStore {
  /** Every write in order, including superseded ones — the audit trail. */
  private readonly history: CacheRow[] = [];

  write(row: CacheRow): void {
    this.history.push(this.index(row));
  }

  /** Every write ever made, oldest first. Superseded rows included. */
  allWrites(): CacheRow[] {
    return this.history.map((r) => structuredClone(r));
  }
}

/**
 * Where `JsonlCacheStore` reports a line it could not load. Optional — see the
 * constructor note on why a missing sink still cannot mean silence.
 */
export interface CacheStoreLogSink {
  warn?(message: string, meta?: Record<string, unknown>): void;
}

export interface JsonlCacheStoreOptions {
  /** Directory holding `pool.jsonl` and `tenant.jsonl`. */
  dir: string;
  /** Override the file names (tests use this to prove routing, not layout). */
  poolFile?: string;
  tenantFile?: string;
  /** Where to report a line that failed to parse on load. See `loadInto`. */
  log?: CacheStoreLogSink;
}

export const POOL_FILE = "pool.jsonl";
export const TENANT_FILE = "tenant.jsonl";

/**
 * Conventional location, relative to the repo root, matched by `.gitignore`.
 *
 * There is deliberately **no default `dir`** on the constructor: a caller has
 * to name the directory it is writing tenant-scoped rows into. A silent default
 * is how a cache file ends up somewhere nobody thought to ignore, and the
 * `.gitignore` rules also match `pool.jsonl` / `tenant.jsonl` by name wherever
 * they land, precisely because this constant can be ignored.
 */
export const DEFAULT_CACHE_DIR = ".cache/paragent";

/**
 * Append-only NDJSON store, one file for pool rows and one for tenant rows.
 *
 * Existing files are read at construction so a store reopened in a new process
 * sees what the previous one wrote — the point of persisting at all.
 */
export class JsonlCacheStore extends IndexedCacheStore {
  readonly poolPath: string;
  readonly tenantPath: string;
  private readonly log?: CacheStoreLogSink;

  constructor(options: JsonlCacheStoreOptions) {
    super();
    this.poolPath = path.join(options.dir, options.poolFile ?? POOL_FILE);
    this.tenantPath = path.join(options.dir, options.tenantFile ?? TENANT_FILE);
    if (options.log !== undefined) this.log = options.log;
    mkdirSync(options.dir, { recursive: true });
    // Pool first, then tenant: within one key the later file wins, which is the
    // conservative direction — a key that appears in both reads back as the
    // tenant-scoped version rather than the pooled one.
    this.loadInto(this.poolPath);
    this.loadInto(this.tenantPath);
  }

  /**
   * Route on `pool_eligible`. This single comparison is the entire separation
   * between the two files, which is why it is asserted from disk rather than
   * from the returned rows.
   */
  private pathFor(row: CacheRow): string {
    return row.pool_eligible ? this.poolPath : this.tenantPath;
  }

  /**
   * Skip a line that fails to parse rather than throwing out of the
   * constructor (#96).
   *
   * The file is append-only, and a bad line is never removed by anything —
   * so a truncated last line (process killed mid-`appendFileSync`, disk full)
   * would otherwise make *every future* `new JsonlCacheStore({ dir })` against
   * this directory throw too. A transient crash would become a permanent
   * outage of the cache. This is a cache, not a ledger: a row that never fully
   * landed is exactly as good as a cache miss, and the compiler can always
   * write it again. What must not happen is losing it silently, so a skip is
   * reported through `log.warn` — or `console.warn` when no sink is given,
   * because "no logger configured" is not the same as "nothing to report."
   */
  private loadInto(file: string): void {
    if (!existsSync(file)) return;
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();
      if (!trimmed) continue;
      try {
        this.index(JSON.parse(trimmed) as CacheRow);
      } catch (err) {
        const message =
          `${file}:${i + 1}: skipping unparseable cache line ` +
          `(${err instanceof Error ? err.message : String(err)})`;
        if (this.log?.warn) {
          this.log.warn(message, { file, line: i + 1, preview: trimmed.slice(0, 120) });
        } else {
          console.warn(`[cache] ${message}`);
        }
      }
    }
  }

  write(row: CacheRow): void {
    // Append, never rewrite. The superseded line stays on disk.
    appendFileSync(this.pathFor(row), `${JSON.stringify(row)}\n`, "utf8");
    this.index(row);
  }

  /** Raw file contents, for tests that must inspect what actually hit disk. */
  readRaw(which: "pool" | "tenant"): string {
    const file = which === "pool" ? this.poolPath : this.tenantPath;
    return existsSync(file) ? readFileSync(file, "utf8") : "";
  }
}
