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
| Track 2 | Is there a vertical where the counterparty hypothesis holds? | Search in progress |
| Track 3 | Narrative / pitch | Placeholders only until Track 1 + 2 land |

Week-0 census (**observability config**): **FAIL** — 2 survivors of 70; archived under
`docs/research/census-week0/`.

## Privacy

This repository is **private** (ADR-0002). Still: never commit credentials,
cookies, session state, `.env` files, tokens, customer names, or third-party
portal content. Secret-scanning CI is merge-blocking.

## Quick start

```bash
git clone https://github.com/DevToolie/Paragent.git
cd Paragent
npm install
npm run ci
```

Contracts live in `contracts/`. Wave-1 agents build against those schemas — not
against each other.

## Layout

```
contracts/           # JSON Schema — build against these
src/testbed|recorder|compiler|runner|cache|metrics/
experiments/gate-v1/ # throwaway gate harness
docs/                # map: docs/README.md
archive/             # superseded scaffolds (Python hello) + preserved history
```

## Stack

TypeScript + Node 20+ + Playwright — see [ADR-0001](docs/decisions/ADR-0001-typescript-node-playwright.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Branch as `track1/<agent>-<topic>` (or
`track2/` / `track3/`). Small PRs. Document with the code.

## License

[MIT](./LICENSE) © DevToolie
