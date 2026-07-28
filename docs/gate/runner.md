---
title: Runner, repair loop, and gate metrics
doc_type: spec
status: draft
owner: B4
created: 2026-07-24
updated: 2026-07-27
confidence: MED
supersedes: null
sources_verified: true
---

# Gate — Runner (B4)

Replays a **compiled program** (cache-row actions + assertions) in Playwright,
repairs **actions only** on failure (≤2 repairs/run by default), and emits
**measured** step/run metrics for PRD §9. Never invents token counts or gate rates.

## Package layout (`src/runner/`)

| Module | Responsibility |
| --- | --- |
| `types.ts` | `CompiledProgram`, steps, assertions, repair/run result types |
| `templates.ts` | `interpolate`, `deepFreeze`, `assertionsEqual` |
| `locators.ts` | Playwright `getByRole` / `getByLabel` / `getByTestId` / `getByText` / `getByPlaceholder` / `locator`; `topology_only` → not found |
| `assertions.ts` | `evaluateAssertion` → `PASS` / `ASSERTION_FAILED` / `LOCATOR_NOT_FOUND` / `TIMEOUT` / `PAGE_ERROR` |
| `actions.ts` | `executeAction` for navigate/click/fill/select/check/uncheck/press/hover/wait/upload/custom |
| `page-state.ts` | `capturePageState` / `emptyPageState` — no cookies, storage, or raw HTML. `visible_landmarks` runs the **one** enumeration from `src/shared/landmarks.ts`, byte-identical to what `src/recorder/fingerprint.ts` runs ([ADR-0007](../decisions/ADR-0007-post-action-visibility.md), #74). It owns no role list of its own: before #74 it enumerated 6 `[role=]` selectors and missed `complementary` / `contentinfo` / `region` the recorder reported, so the repair model would be handed landmarks the recorder never produced. The evaluate body is a string on purpose: named function expressions get esbuild's `__name` wrapper, which does not exist in the browser. Covered by `tests/unit/page-state.test.ts` and `tests/unit/landmarks.test.ts` |
| `repair.ts` | `RepairModelClient`, `StubRepairModelClient` (null action, zero tokens), `assertAssertionUnchanged` |
| `replay.ts` | `ReplayRunner` — dry-run, repair loop, metrics emission |
| `metrics/` | Sibling package: emitter + §9 aggregates |

## Invariants

1. **Assertions are immutable in repair.** `deepFreeze` + `assertAssertionUnchanged` — proposals may only supply `corrected_action`.
2. **No invented metrics.** Stub repair and unwired fresh baselines emit **zeros**; aggregates report `no_data` when denominators are empty.
3. **`maxRepairsPerRun` default 2** — aligns with `success_with_le_2_repairs` on run metrics.
4. **Dry-run required for gate matrix today.** Live matrix exits 2 until page injection + B1 pins land.

## Outcomes

From `contracts/metrics.schema.json` `$defs.stepOutcome`:

`PASS` · `ASSERTION_FAILED` · `LOCATOR_NOT_FOUND` · `TIMEOUT` · `PAGE_ERROR` · `REPAIRED_PASS` · `REPAIR_EXHAUSTED`

## Gate harness

See [`experiments/gate-v1/README.md`](../../experiments/gate-v1/README.md).

```bash
npm run gate:matrix -- --dry-run
npm run gate:report
```

## Sources

| Claim | Source | Access date |
| --- | --- | --- |
| Action + locator strategies | `contracts/cache-row.schema.json` | 2026-07-24 |
| Assertion types / strength / “MUST NOT weaken” | `contracts/assertion.schema.json` | 2026-07-24 |
| Step/run metric fields + outcomes | `contracts/metrics.schema.json` | 2026-07-24 |
| Fingerprint posture (no HTML/cookies) | `contracts/trajectory.schema.json` `$defs.fingerprint` | 2026-07-24 |
| Playwright locators / actions | https://playwright.dev/docs/locators | 2026-07-24 |
| Stack choice | `docs/decisions/ADR-0001-typescript-node-playwright.md` | 2026-07-24 |

## Open questions / what I could not verify

- Exact §9 kill thresholds (numeric gate) — **not invented**; pending founder PRD drop + Track-1 measurement (`docs/prd/` still placeholder).
- Model wiring for `RepairModelClient` — stub only (`TODO(model-wiring)`); real proposals PENDING.
- Whether `compiled_trajectory` bundle `$id` becomes a first-class contract (B3 packaging convention today).
- Fresh-reasoning cost capture for `cost_fresh` — measured separately; defaults to zeros when unwired.
- Live `page` injection API for matrix vs caller-owned browser lifecycle — not locked yet.
