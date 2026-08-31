---
title: Paragent — internal README (status, tracks, repo rules)
doc_type: brief
status: accepted
owner: B0
created: 2026-07-25
updated: 2026-08-31
confidence: HIGH
supersedes: null
sources_verified: true
---

> Moved here from the repository root so the root `README.md` can serve first-time
> visitors. The move itself changed no content — only link depth and this frontmatter.
> Corrections since the move are listed under [Open questions](#open-questions--what-i-could-not-verify).
> This remains the canonical internal entry point for agents, contributors, candidates,
> and investors.

# Paragent

**Pre-seed.** Thesis unproven. Gate number pending. No invented metrics.

Paragent is a stateful execution layer for browser agents. It records an agent's
successful trajectory through a web UI, compiles it into a deterministic
replayable script with a post-condition assertion on every step, replays it at
near-zero token cost, and repairs the script with a model when an assertion
fails.

Value is hypothesized (not yet measured) for tasks performed **repeatedly**, in
a **browser**, where **no clean API** exists — and, after Week-0 census failure
on SaaS observability config, especially where the person doing the work is the
**counterparty** to the software's customer (no API roadmap sympathy).

## Status

| Track | Question | Status |
| --- | --- | --- |
| Track 1 | Do compiled trajectories survive site churn? | Harness in progress — **no gate number yet** |
| Track 2 | Is there a vertical where the counterparty hypothesis holds? | **FAIL — no vertical locked** ([C5 DECISION](./research/vertical-search/DECISION.md), [ADR-0004](./decisions/ADR-0004-vertical-track2-fail.md)) |
| Track 3 | Narrative / pitch | Wave-1 draft in [docs/pitch/](./pitch/); all performance claims **[PENDING TRACK-1]** |

Two consecutive vertical FAILs — Week-0 observability config (2 survivors of 70,
archived under [docs/research/census-week0/](./research/census-week0/)) and Track-2
counterparty (2 of 75, 0 DURABLE) — mean the company now rests on the Track-1
mechanism number. See
[README-narrative.md §6](./README-narrative.md#6-where-evidence-stands-now).

## Public repo — write accordingly

This repository is **public and intended to be**
([ADR-0005](./decisions/ADR-0005-repo-public.md), superseding ADR-0002). The research,
the PRD, the pitch pack, and both FAIL memos are all readable by anyone. Assume a
competitor, a candidate, and an investor will read whatever you add.

That is a constraint on tone, never on honesty — findings are not softened
([CONTRIBUTING.md](../CONTRIBUTING.md) rule 4).

With no confidentiality boundary left, secret hygiene is the only line of defence. Never
commit credentials, cookies, session state, `.env` files, tokens, customer or
design-partner names, or third-party portal content. `npm run secret-scan` is
merge-blocking in CI, GitHub secret scanning with push protection is enabled, and
`npm run test:canary` blocks tenant strings reaching pool-eligible cache rows. None of
these may be weakened.

## Quick start

```bash
git clone https://github.com/DevToolie/Paragent.git
cd Paragent
npm install
npm run ci
```

`npm run ci` is the one command that must be green before any PR: secret-scan,
contract validation, lint, typecheck, unit tests, then the end-to-end integration
test, in that order. The privacy canary (`npm run test:canary`) is merge-blocking
as a separate CI job. Full command list and the pre-PR checklist:
[docs/DEVELOPMENT.md](./DEVELOPMENT.md).

Contracts live in `contracts/`. Wave-1 agents build against those schemas — not
against each other.

## Layout

```
contracts/           # JSON Schema — build against these
src/cli.ts           # the `paragent` binary: record / compile / testbed
src/intent|testbed|recorder|compiler|cache|runner|metrics/   # pipeline, in order
src/shared|session/  # leaves, not pipeline stages
experiments/gate-v1/ # throwaway gate harness
scripts/             # secret-scan, contract validation, branch protection, testbed compose
tests/unit|canary|integration/
artifacts/           # committed compiled bundles
docs/                # map: docs/README.md
archive/             # superseded scaffolds (Python hello) + preserved history
```

How the packages connect: [docs/architecture.md](./architecture.md).
Where the project is and what to pick up next: [docs/ROADMAP.md](./ROADMAP.md).
How to run, test, and ship a change: [docs/DEVELOPMENT.md](./DEVELOPMENT.md).

## Stack

TypeScript + Node 20+ + Playwright — see [ADR-0001](./decisions/ADR-0001-typescript-node-playwright.md).

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md). Branch as `track1/<agent>-<topic>` (or
`track2/` / `track3/`). Small PRs. Document with the code.

## License

[MIT](../LICENSE) © DevToolie

## Open questions / what I could not verify

- **`owner` in the frontmatter is a guess.** This doc had no owner while it lived at
  the repository root. `B0` was chosen to match [ROADMAP.md](./ROADMAP.md); reassign
  if that is wrong.
- **Whether the root `README.md` is still what coding agents read first.** Agents that
  hardcode `README.md` will now land on the visitor-facing page and must follow the
  link here. If that proves disruptive, an `AGENTS.md` pointer at the root is the fix.
- No factual claim, number, or verdict in this document was changed in the move.
- **Correction (2026-08-31):** the Layout block listed six `src/` packages when there
  are nine plus the `paragent` binary — `intent/` (#124), `session/` (#98 / SC-05), and
  `shared/` (#74) all landed after the block was written, and `src/cli.ts` after that.
  Corrected against `ls src/`; the pipeline order now matches
  [architecture.md](./architecture.md). No status, track, or verdict was touched.
