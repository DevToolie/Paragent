## Summary

<!-- What does this PR do and why? Link related issues: Fixes #123 -->

## Track

<!-- Delete the rows that do not apply. -->

- [ ] Track 1 — churn harness / gate measurement
- [ ] Track 2 — vertical search
- [ ] Track 3 — narrative / pitch / docs
- [ ] Tooling / CI / housekeeping

## Changes

-
-

## Test plan

- [ ] `npm run ci` passes locally (secret-scan, contracts, lint, typecheck, tests)
- [ ] `npm run test:canary` passes — privacy boundary, merge-blocking
- [ ] Added / updated tests for the behaviour this PR changes

## Hard rules

See [CONTRIBUTING.md](https://github.com/DevToolie/Paragent/blob/main/CONTRIBUTING.md).
All four must hold:

- [ ] **No secrets.** No credentials, cookies, session/storage dumps, `.env`,
      tokens, customer or design-partner names, or third-party portal content.
- [ ] **No invented metrics.** Gate numbers and cost savings are
      `[PENDING TRACK-1]` until measured.
- [ ] **Claims are sourced.** Research docs carry URL + access date.
- [ ] **Docs ship with the code**, carrying the standard YAML frontmatter, and
      [docs/README.md](https://github.com/DevToolie/Paragent/blob/main/docs/README.md)
      is updated if a document was added.

## Contracts

- [ ] This PR does not change `contracts/` — or it does, and there is an ADR
      under `docs/decisions/` for the change.
