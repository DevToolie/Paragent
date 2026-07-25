import type { Cost } from "./types.js";

export function zeroCost(model_id?: string): Cost {
  const c: Cost = { tokens_in: 0, tokens_out: 0, wall_clock_ms: 0 };
  if (model_id !== undefined) c.model_id = model_id;
  return c;
}

export function addCost(a: Cost, b: Cost): Cost {
  const out: Cost = {
    tokens_in: a.tokens_in + b.tokens_in,
    tokens_out: a.tokens_out + b.tokens_out,
    wall_clock_ms: a.wall_clock_ms + b.wall_clock_ms,
  };
  const model = b.model_id ?? a.model_id;
  if (model !== undefined) out.model_id = model;
  return out;
}

export function totalTokens(c: Cost): number {
  return c.tokens_in + c.tokens_out;
}

export async function measureWallClock<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; wall_clock_ms: number }> {
  const started = Date.now();
  const result = await fn();
  return { result, wall_clock_ms: Math.max(0, Date.now() - started) };
}
