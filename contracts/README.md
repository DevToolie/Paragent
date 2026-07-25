# contracts/

Machine-readable integration surface for Wave-1 agents. **Ambiguity here becomes
a merge conflict in three days** — extend via ADR, not silent fields.

| Schema | Consumer agents | Purpose |
| --- | --- | --- |
| `trajectory.schema.json` | B2 (write), B3 (read) | Recorded run; params lifted; locator candidates |
| `assertion.schema.json` | B3 (write), B4/B5 (read) | Post-condition templates + strength |
| `cache-row.schema.json` | B3/B5 (write), B4 (read) | Compiled step + `pool_eligible` |
| `metrics.schema.json` | B4 (write) | Step + run metrics for PRD §9 |

Examples: `examples/*.example.json`  
Validate: `npm run validate:contracts`

## Design notes for parallel work

- **B2** never stores literal input values — only `parameters: { name: type }` and
  `param_refs` on actions.
- **B3** embeds a full assertion object on each cache row; strength is required.
- **B4** emits `metric_kind: step | run` rows; computes replay-validity and
  `success_with_le_2_repairs` from raw fields (do not hand-compute in docs).
- **B5** refuses cache writes unless allowlist/`pool_eligible` rules pass;
  `pool_ineligible_reason` is mandatory when ineligible.

## Open questions / what I could not verify

- PRD v0.2 exact §9 threshold constants — schemas capture *measurable fields*,
  not pass/fail cutoffs.
