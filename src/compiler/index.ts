export { PACKAGE } from "./package.js";
export { COMPILER_VERSION, SCHEMA_VERSION } from "./types.js";
export type {
  Assertion,
  CacheRow,
  CompiledTrajectoryBundle,
  Trajectory,
} from "./types.js";
export { compileTrajectory, compileStep } from "./compile.js";
export { synthesizeAssertion, templateToRegex } from "./assertions.js";
export {
  buildLocatorFallbackChain,
  orderLocatorCandidates,
} from "./locators.js";
export { decidePoolEligibility } from "./pool.js";
export { looksLikeTenantLiteral } from "./literals.js";
export { validateCompiledBundle } from "./validate.js";
