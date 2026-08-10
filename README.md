# Paragent

**Record a browser agent once. Replay it deterministically, without the model. Repair it when the page changes.**

[![CI](https://github.com/DevToolie/Paragent/actions/workflows/ci.yml/badge.svg)](https://github.com/DevToolie/Paragent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](./tsconfig.json)

Browser agents re-derive the same work on every run. Ask one to pull a report out of
a dashboard, and it re-reads the DOM, re-plans, and re-infers every click — burning
tokens and wall-clock to rediscover a path it already found yesterday, with a fresh
chance of getting it wrong.

Paragent takes the model out of the second run. It records an agent's **successful** trajectory
through a web UI, compiles it into a deterministic replayable script with a
**post-condition assertion on every step**, and replays it with no model in the loop.
When an assertion fails — a button moved, a label changed — the model is called back
in to repair just that step, and the repaired script is what runs next time.

<!-- ┌──────────────────────────────────────────────────────────────────────────┐
     │ DEMO GIF PLACEHOLDER                                                     │
     │ Record the gif, save it to docs/assets/demo.gif, then delete these       │
     │ comment markers to publish it. Kept commented so the README never        │
     │ renders a broken image. Tracking issue: "Record and embed demo GIF".     │
     └──────────────────────────────────────────────────────────────────────────┘
<p align="center">
  <img src="docs/assets/demo.gif" alt="Recording a trajectory, replaying it without the model, and repairing it after the UI changes" width="720">
</p>
-->



## How it works

| Stage | What happens | Model involved? |
| --- | --- | --- |
| **Record** | An agent completes the task once. Every action and its post-condition is captured as a trajectory. | Yes |
| **Compile** | The trajectory becomes a bundle of cache rows — one per step, each with its assertion. Typed values become parameter slots. | No |
| **Replay** | Steps execute in order. Each asserts its post-condition before the next runs. | No |
| **Repair** | On assertion failure, the model is called to fix that step; the updated script is written back. | Only on failure |

The assertion-per-step design is the load-bearing part: a replay that drifts fails
loudly at the step that broke, instead of silently completing the wrong task.

## Try it in 60 seconds

No credentials or live site needed — a browser fixture ships with the repo.

```bash
git clone https://github.com/DevToolie/Paragent.git
cd Paragent
npm install

# 1. Record a login → dashboard-list trajectory against the bundled fixture
npm run recorder -- --fixture --out trajectory.json

# 2. Compile it into a replayable bundle, one cache row per step
npm run compile -- --in trajectory.json --out bundle.json
```

Point the recorder at a real site instead:

```bash
npm run recorder -- --base-url http://127.0.0.1:3000 --headed
```

Recorded values become parameter slots, so one recording covers a family of runs:

```bash
npm run recorder -- --fixture --dashboard-title "Q3 Latency" --series-count 5
```

Credentials are read from `PARAGENT_USERNAME` / `PARAGENT_USER_SECRET` and are never
persisted to disk. Full command list: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Where this fits

Most browser-agent frameworks optimise the *first* run — better planning, better DOM
grounding, better recovery. Paragent assumes you already have one that works and
optimises every run after it. It composes with them rather than replacing them: record
whatever agent you already trust, then replay its output.

It's aimed at work that is **repeated**, in a **browser**, where **no clean API
exists** — the cases where you'd write a script if the UI would just hold still.

## Project status — read this before you rely on it

Paragent is pre-seed, two weeks old, and its central thesis is **not yet proven**. We
publish the failures alongside the code:

| Track | Question | Status |
| --- | --- | --- |
| Track 1 | Do compiled trajectories survive site churn? | Harness in progress — **no gate number yet** |
| Track 2 | Is there a vertical where the counterparty hypothesis holds? | **FAIL** — no vertical locked |
| Track 3 | Narrative / pitch | Wave-1 draft; all performance claims **[PENDING TRACK-1]** |

Two consecutive vertical FAILs mean the project now rests on the Track-1 mechanism
number, which does not exist yet. **There are no performance benchmarks in this README
because there are none to report.** Any number you see here later will be traceable to
a gate run.

The full internal picture — research, decision records, both FAIL memos, the pitch
pack, and the contributor rules — is preserved verbatim and kept current in
**[docs/README-internal.md](docs/README-internal.md)**. Start there if you are an
agent, a contributor, a candidate, or an investor. Nothing is softened there and
nothing is hidden.

## Docs

| | |
| --- | --- |
| [docs/README-internal.md](docs/README-internal.md) | Full project status, tracks, and FAIL memos |
| [docs/architecture.md](docs/architecture.md) | System design |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Commands, pre-PR checklist |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What's next |
| [docs/decisions/](docs/decisions/) | ADRs |
| [docs/research/](docs/research/) | Census and vertical research, including failures |

## Contributing

`npm run ci` must be green before any PR — secret-scan, contract validation, lint,
typecheck, unit tests, then integration tests. The privacy canary
(`npm run test:canary`) is a separate merge-blocking job.

This repo is public by design ([ADR-0005](docs/decisions/ADR-0005-repo-public.md)).
Never commit credentials, cookies, session state, `.env` files, tokens, customer or
design-partner names, or third-party portal content. Secret scanning with push
protection is enabled and those checks may not be weakened.

Read [CONTRIBUTING.md](./CONTRIBUTING.md) first — rule 4 is that findings are never
softened, and it applies to everyone.

## License

[MIT](./LICENSE)
