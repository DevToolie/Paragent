/**
 * Repair proposals may correct actions only — never assertions.
 * Source: contracts/assertion.schema.json description (repair MUST NOT weaken).
 */

import { assertionsEqual } from "./templates.js";
import type { Assertion, RepairContext, RepairProposal } from "./types.js";

export interface RepairModelClient {
  propose(context: RepairContext): Promise<RepairProposal>;
}

/**
 * Stub until a real model client is wired.
 * Returns corrected_action: null and zero tokens — never invents repair success.
 */
export class StubRepairModelClient implements RepairModelClient {
  async propose(_context: RepairContext): Promise<RepairProposal> {
    // TODO(model-wiring): plug in LLM / agent repair that proposes corrected_action only.
    return {
      corrected_action: null,
      tokens_in: 0,
      tokens_out: 0,
      notes: "StubRepairModelClient — no model wired",
    };
  }
}

/** Throws if repair mutated the frozen assertion. */
export function assertAssertionUnchanged(
  original: Assertion,
  current: Assertion,
): void {
  if (!assertionsEqual(original, current)) {
    throw new Error(
      "repair violated invariant: assertion must not change (never weaken assertions)",
    );
  }
}
