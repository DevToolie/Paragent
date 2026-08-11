/**
 * Shared package — in-page source strings needed by more than one capture site.
 *
 * Not a pipeline stage and not a utility drawer. Something belongs here only if
 * it runs **inside the browser** and two packages must run the identical copy;
 * anything else goes in the package that owns it. See `landmarks.ts` for why
 * these are strings rather than functions.
 */
export const PACKAGE = "shared" as const;
export * from "./landmarks.js";
export * from "./page-context.js";
