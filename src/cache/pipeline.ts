/**
 * Minimal in-process record → compile → cache-write pipeline for privacy canaries.
 */

import { writeCacheRowPair, type WriteLogSink, type WriteOptions } from "./write.js";
import type { CacheRow, CacheRowCandidate, CompiledLocator } from "./types.js";

export const CANARY_TENANT = {
  accountId: "CANARY_ACCT_7f3a9c2e1b84d055",
  accountName: "CANARY_NAME_AcmeWidgets7f3a9c",
  email: "canary.user.7f3a9c2e1b84@example.test",
  resourceName: "CANARY_RES_dashboard_7f3a9c2e1b84",
  threshold: "CANARY_THRESHOLD_99117733",
  personName: "Canary Person 7f3a9c2e1b84",
} as const;

export function allCanaryStrings(): string[] {
  return Object.values(CANARY_TENANT);
}

export interface PipelineLogBuffer extends WriteLogSink {
  lines: string[];
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  dump(): string;
}

export function createLogBuffer(): PipelineLogBuffer {
  const lines: string[] = [];
  const push = (level: string, message: string, meta?: Record<string, unknown>) => {
    lines.push(`${level}:${message}:${meta ? JSON.stringify(meta) : ""}`);
  };
  return {
    lines,
    info: (m, meta) => push("info", m, meta),
    debug: (m, meta) => push("debug", m, meta),
    dump: () => lines.join("\n"),
  };
}

export interface MemoryMetrics {
  rows: Record<string, unknown>[];
  emit(row: Record<string, unknown>): void;
  dump(): string;
}

export function createMemoryMetrics(): MemoryMetrics {
  const rows: Record<string, unknown>[] = [];
  return {
    rows,
    emit: (row) => { rows.push(row); },
    dump: () => JSON.stringify(rows),
  };
}

export function compileCanaryCandidate(): CacheRowCandidate {
  const taintedLocators: CompiledLocator[] = [
    { strategy: "css_vocab", css: `[data-account-id="${CANARY_TENANT.accountId}"]` },
    { strategy: "role_name", role: "button", name: CANARY_TENANT.personName },
    { strategy: "text", text: CANARY_TENANT.resourceName },
    { strategy: "label", label: CANARY_TENANT.accountName },
    { strategy: "role_name", role: "textbox", name: "Username" },
    { strategy: "testid", testid: "username-input" },
    { strategy: "structural", structural_path: "main > form > input:nth-of-type(1)" },
  ];
  return {
    schema_version: "1.0.0",
    row_id: "cache-canary-step-0",
    site_key: "canary-synthetic@test",
    task_key: "canary-login-fill",
    step_index: 0,
    compiled_action: {
      type: "fill",
      param_refs: ["username"],
      locator_fallback_chain: taintedLocators,
    },
    assertion: {
      schema_version: "1.0.0",
      assertion_id: "assert-username-visible",
      type: "element-visible",
      strength: "strong",
      target: { locator: { strategy: "role_name", role: "textbox", name: "Username" } },
      expected: {
        visible: true,
        template: "{username_field}",
        param_types: { username_field: "string" },
      },
      timeout_ms: 5000,
      failure_classification: "assertion_failed",
    },
    confidence: 0,
    success_count: 0,
    failure_count: 0,
    last_verified_at: "2026-07-24T21:00:00.000Z",
    flow_topology: { next_action_type: "fill", landmark: "login" },
  };
}

export function compileFullyTaintedCandidate(): CacheRowCandidate {
  const base = compileCanaryCandidate();
  return {
    ...base,
    row_id: "cache-canary-step-topo",
    compiled_action: {
      ...base.compiled_action,
      locator_fallback_chain: [
        { strategy: "css_vocab", css: `[data-account-id="${CANARY_TENANT.accountId}"]` },
        { strategy: "text", text: CANARY_TENANT.resourceName },
        { strategy: "role_name", role: "button", name: CANARY_TENANT.personName },
      ],
    },
  };
}

export interface PipelineResult {
  poolRows: CacheRow[];
  tenantRows: CacheRow[];
  log: PipelineLogBuffer;
  metrics: MemoryMetrics;
}

export function runCanaryPipeline(options?: WriteOptions): PipelineResult {
  const log = createLogBuffer();
  const metrics = createMemoryMetrics();
  const store = { write(_row: CacheRow) { /* sink */ } };
  const writeOpts: WriteOptions = { ...options, store, log };
  const poolRows: CacheRow[] = [];
  const tenantRows: CacheRow[] = [];
  for (const candidate of [compileCanaryCandidate(), compileFullyTaintedCandidate()]) {
    const { pool, tenant } = writeCacheRowPair(candidate, writeOpts);
    poolRows.push(pool);
    tenantRows.push(tenant);
    metrics.emit({
      metric_kind: "step",
      row_id: pool.row_id,
      pool_eligible: pool.pool_eligible,
      outcome: "PASS",
    });
  }
  return { poolRows, tenantRows, log, metrics };
}

export function findCanariesIn(text: string): string[] {
  return allCanaryStrings().filter((c) => text.includes(c));
}
