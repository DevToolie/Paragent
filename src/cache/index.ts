/**
 * Cache package — write-time privacy boundary (B5).
 * @see docs/privacy/boundary-spec.md
 * @see contracts/cache-row.schema.json
 */

export const PACKAGE = "cache" as const;

export * from "./types.js";
export * from "./allowlist.js";
export {
  DEFAULT_TAINT_RULES,
  checkLocatorTaint,
  createTaintChecker,
  taintRulesWithout,
  type TaintRule,
} from "./taint.js";
export {
  CacheWriteRejectedError,
  buildPoolRow,
  buildTenantRow,
  writeCacheRow,
  writeCacheRowPair,
  type WriteLogSink,
  type WriteOptions,
} from "./write.js";
export {
  CONFIDENCE_ALPHA,
  INVALIDATION_THRESHOLD,
  applyOutcome,
  classifyOutcome,
  isInvalidated,
  isVerified,
  nextConfidence,
  type OutcomeContext,
  type OutcomeKind,
} from "./confidence.js";
export {
  createCacheUpdateSink,
  recordStepOutcome,
  type CacheUpdateOptions,
  type CacheUpdateResult,
  type StepOutcomeReport,
} from "./update.js";
export {
  JsonlCacheStore,
  MemoryCacheStore,
  POOL_FILE,
  TENANT_FILE,
  cacheKeyOf,
  cacheKeyString,
  type CacheKey,
  type CacheListFilter,
  type CacheStore,
  type CacheStoreLogSink,
  type JsonlCacheStoreOptions,
} from "./store.js";
export {
  CANARY_TENANT,
  allCanaryStrings,
  compileCanaryCandidate,
  compileFullyTaintedCandidate,
  createLogBuffer,
  createMemoryMetrics,
  findCanariesIn,
  runCanaryPipeline,
} from "./pipeline.js";
