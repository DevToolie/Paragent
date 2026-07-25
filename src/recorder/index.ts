/**
 * Recorder package — B2 Wave-1.
 * Instruments Playwright sessions into contracts/trajectory.schema.json artifacts.
 */
export { PACKAGE, RECORDER_VERSION, TrajectoryRecorder } from "./session.js";
export { captureFingerprint } from "./fingerprint.js";
export { collectLocatorCandidates } from "./locators.js";
export {
  assertNoLiteralSecrets,
  digestSignals,
  inferParamType,
  resolveTemplate,
  templatizeUrl,
} from "./redact.js";
export type {
  Action,
  ActionType,
  AssertionHint,
  Fingerprint,
  LocatorCandidate,
  LocatorStrategy,
  ParamType,
  Provenance,
  RecordSessionOptions,
  Step,
  TimingMs,
  Trajectory,
} from "./types.js";
export { TRAJECTORY_SCHEMA_VERSION } from "./types.js";
