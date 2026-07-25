/**
 * Write-time privacy enforcement for the trajectory cache.
 * Sources: Wave pack Agent B5; contracts/cache-row.schema.json.
 */

import { isChromeName, isTemplateOnly } from "./allowlist.js";
import { checkLocatorTaint, createTaintChecker, type TaintRule } from "./taint.js";
import type {
  AssertionLike,
  CacheRow,
  CacheRowCandidate,
  CompiledLocator,
  PoolIneligibleReason,
} from "./types.js";

export class CacheWriteRejectedError extends Error {
  readonly code = "CACHE_WRITE_REJECTED" as const;
  constructor(
    message: string,
    readonly reason: PoolIneligibleReason | "pool_leak_refused",
  ) {
    super(message);
    this.name = "CacheWriteRejectedError";
  }
}

export interface WriteLogSink {
  info?(message: string, meta?: Record<string, unknown>): void;
  debug?(message: string, meta?: Record<string, unknown>): void;
}

export interface CacheStore {
  write(row: CacheRow): void;
}

export interface WriteOptions {
  store?: CacheStore;
  log?: WriteLogSink;
  taintRules?: readonly TaintRule[];
  failClosed?: boolean;
}

function taintChecker(options?: WriteOptions) {
  if (options?.taintRules) return createTaintChecker(options.taintRules);
  return checkLocatorTaint;
}

function assertionHasTenantLiteral(assertion: AssertionLike): boolean {
  const expected = assertion.expected;
  if (expected?.template) {
    const t = expected.template;
    const withoutHoles = t.replace(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, "").trim();
    if (
      withoutHoles.length > 0 &&
      !isChromeName(withoutHoles) &&
      !isTemplateOnly(t) &&
      !isChromeName(t)
    ) {
      return true;
    }
  }
  const loc = assertion.target?.locator;
  if (loc && checkLocatorTaint(loc).tainted) return true;
  const stripped = JSON.stringify(assertion).replace(/\{[^}]+\}/g, "");
  return /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(stripped);
}

function classifyLocators(
  chain: CompiledLocator[],
  check: (l: CompiledLocator) => ReturnType<typeof checkLocatorTaint>,
) {
  const poolSafe: CompiledLocator[] = [];
  const tenantOnly: CompiledLocator[] = [];
  const reasons = new Set<PoolIneligibleReason>();
  for (const loc of chain) {
    const result = check(loc);
    if (result.tainted) {
      tenantOnly.push({ ...loc, tenant_scoped: true });
      if (result.reasons.includes("non_vocab_attr")) reasons.add("tainted_attribute");
      else if (result.reasons.includes("non_vocab_role")) reasons.add("non_vocab_role");
      else reasons.add("tenant_locator_text");
    } else {
      poolSafe.push({ ...loc, tenant_scoped: false });
    }
  }
  return { poolSafe, tenantOnly, reasons: [...reasons] };
}

function finalize(
  candidate: CacheRowCandidate,
  chain: CompiledLocator[],
  poolEligible: boolean,
  reason: PoolIneligibleReason | null,
  options?: WriteOptions,
): CacheRow {
  const row: CacheRow = {
    schema_version: "1.0.0",
    row_id: candidate.row_id,
    site_key: candidate.site_key,
    task_key: candidate.task_key,
    step_index: candidate.step_index,
    compiled_action: {
      ...candidate.compiled_action,
      locator_fallback_chain: chain,
    },
    assertion: JSON.parse(JSON.stringify(candidate.assertion)) as AssertionLike,
    confidence: candidate.confidence,
    success_count: candidate.success_count,
    failure_count: candidate.failure_count,
    last_verified_at: candidate.last_verified_at,
    pool_eligible: poolEligible,
    pool_ineligible_reason: poolEligible ? null : reason,
  };
  if (candidate.flow_topology) row.flow_topology = { ...candidate.flow_topology };

  if (row.pool_eligible) {
    for (const loc of row.compiled_action.locator_fallback_chain) {
      if (loc.tenant_scoped === true && options?.failClosed !== false) {
        throw new CacheWriteRejectedError(
          "pool_eligible row must not include tenant_scoped locators",
          "pool_leak_refused",
        );
      }
      if (loc.strategy === "text") {
        throw new CacheWriteRejectedError(
          "pool_eligible row must not include free-text locators",
          "tenant_locator_text",
        );
      }
    }
  }
  return row;
}

export function buildPoolRow(
  candidate: CacheRowCandidate,
  options?: WriteOptions,
): CacheRow {
  const check = taintChecker(options);
  const { poolSafe, reasons } = classifyLocators(
    candidate.compiled_action.locator_fallback_chain,
    check,
  );
  if (assertionHasTenantLiteral(candidate.assertion)) {
    return finalize(candidate, [], false, "literal_in_assertion", options);
  }
  if (poolSafe.length > 0) {
    return finalize(candidate, poolSafe, true, null, options);
  }
  if (candidate.flow_topology) {
    return finalize(
      candidate,
      [{ strategy: "topology_only", tenant_scoped: false }],
      true,
      null,
      options,
    );
  }
  return finalize(candidate, [], false, reasons[0] ?? "other", options);
}

export function buildTenantRow(
  candidate: CacheRowCandidate,
  options?: WriteOptions,
): CacheRow {
  const check = taintChecker(options);
  const { poolSafe, tenantOnly, reasons } = classifyLocators(
    candidate.compiled_action.locator_fallback_chain,
    check,
  );
  const chain = [
    ...poolSafe.map((l) => ({ ...l, tenant_scoped: false })),
    ...tenantOnly,
  ];
  let reason: PoolIneligibleReason = reasons[0] ?? "other";
  if (assertionHasTenantLiteral(candidate.assertion)) reason = "literal_in_assertion";
  else if (tenantOnly.length > 0 && poolSafe.length === 0) reason = "topology_only_degraded";
  return finalize(candidate, chain, false, reason, options);
}

export function writeCacheRow(
  candidate: CacheRowCandidate,
  options?: WriteOptions,
): CacheRow {
  const failClosed = options?.failClosed !== false;
  const poolRow = buildPoolRow(candidate, options);
  if (candidate.pool_eligible === true && !poolRow.pool_eligible) {
    throw new CacheWriteRejectedError(
      "caller requested pool_eligible=true but row failed allowlist/taint checks",
      poolRow.pool_ineligible_reason ?? "other",
    );
  }
  if (poolRow.pool_eligible && failClosed) {
    for (const loc of poolRow.compiled_action.locator_fallback_chain) {
      const t = taintChecker(options)(loc);
      if (t.tainted) {
        throw new CacheWriteRejectedError(
          `pool write refused: locator still tainted (${t.rulesFired.join(",")})`,
          "pool_leak_refused",
        );
      }
    }
    if (assertionHasTenantLiteral(poolRow.assertion)) {
      throw new CacheWriteRejectedError(
        "pool write refused: assertion contains tenant literal",
        "literal_in_assertion",
      );
    }
  }
  options?.log?.info?.("cache.write", {
    row_id: poolRow.row_id,
    site_key: poolRow.site_key,
    task_key: poolRow.task_key,
    step_index: poolRow.step_index,
    pool_eligible: poolRow.pool_eligible,
    pool_ineligible_reason: poolRow.pool_ineligible_reason ?? null,
    locator_count: poolRow.compiled_action.locator_fallback_chain.length,
  });
  options?.store?.write(poolRow);
  return poolRow;
}

export function writeCacheRowPair(
  candidate: CacheRowCandidate,
  options?: WriteOptions,
): { pool: CacheRow; tenant: CacheRow } {
  return {
    pool: writeCacheRow(candidate, options),
    tenant: buildTenantRow(candidate, options),
  };
}
