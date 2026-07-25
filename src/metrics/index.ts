/** Metrics package — PRD §9 instrumentation. Schema: contracts/metrics.schema.json */
export const PACKAGE = "metrics" as const;
export * from "./types.js";
export * from "./cost.js";
export * from "./emitter.js";
export * from "./aggregate.js";
