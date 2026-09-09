/**
 * Repair proposals may correct actions only — never assertions.
 * Source: contracts/assertion.schema.json description (repair MUST NOT weaken).
 */

import { assertionsEqual } from "./templates.js";
import type { Assertion, CompiledAction, RepairContext, RepairProposal } from "./types.js";

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

/**
 * Strip anything that is not a corrected action.
 *
 * A proposal that carries an `assertion` key is not merged and not
 * partially honoured — it is dropped whole. `assertAssertionUnchanged` would
 * catch a mutation after the fact; this refuses to carry one forward at all,
 * which is the difference between detecting a violation and not committing one.
 *
 * Lives here, next to the client contract, rather than beside one client (#189).
 * It was written for `AnthropicRepairModelClient`, but it guards the *invariant*,
 * not that client's parse path — and a second client that re-implemented it
 * would be a second place for the frozen-assertion rule to drift. Importing it
 * from `repair-anthropic.ts` would also make a client whose whole purpose is
 * needing no API key load the Anthropic SDK.
 */
export function sanitizeProposedAction(raw: unknown): {
  action: CompiledAction | null;
  rejected?: string;
} {
  if (raw === null || raw === undefined) return { action: null };
  if (typeof raw !== "object") return { action: null, rejected: "not an object" };

  const obj = raw as Record<string, unknown>;
  if ("assertion" in obj || "expected" in obj || "timeout_ms" in obj) {
    return {
      action: null,
      rejected: "proposal attempted to modify the assertion; dropped whole",
    };
  }
  if (typeof obj["type"] !== "string") {
    return { action: null, rejected: "no action type" };
  }
  if (!Array.isArray(obj["locator_fallback_chain"])) {
    return { action: null, rejected: "no locator_fallback_chain" };
  }
  return { action: obj as unknown as CompiledAction };
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
