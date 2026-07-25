---
title: "ADR-0001 — TypeScript + Node + Playwright"
doc_type: adr
status: accepted
owner: B0
created: 2026-07-24
updated: 2026-07-24
confidence: HIGH
supersedes: null
sources_verified: true
---

# ADR-0001 — TypeScript + Node + Playwright

## Status

accepted

## Context

**Triggered by:** Wave-0 need for a single stack before B1–B5 implement
test-bed, recorder, compiler, runner, and privacy enforcement in parallel.

The repo previously contained a Python hello-world scaffold
(`archive/python-scaffold/`); it had no browser automation surface and is not
load-bearing.

Constraints:

- We need robust role-based locators and an assertion library (not a custom
  automation primitive set at pre-seed).
- We need CDP access for fingerprints / repair context.
- Contracts are JSON Schema; typed consumers reduce cross-agent schema drift.
- Track-1 must produce measurable gate metrics within days, not a framework.

Sources:

- Playwright docs (locators, assertions, CDP): https://playwright.dev/docs/intro — access_date: 2026-07-24
- Existing archive: `archive/python-scaffold/` (Python 3.11+ hatch package)

## Options considered

### A — TypeScript + Node + Playwright (chosen)

Honest case for: one language for contracts tooling, CI, and browser
automation; Playwright's `getByRole` / web-first assertions match our locator
preference order; CDP session is first-class; hiring/common agent tooling is
TS-heavy.

Honest case against: prior repo identity was Python; some data/science tooling
is nicer in Python.

### B — Python + Playwright

Honest case for: continuity with the archived scaffold; strong scraping/data
ecosystem; Playwright Python is supported.

Honest case against: JSON Schema validation and monorepo packaging are more
awkward; Wave-1 agents would still need Node for some CI secret-scan patterns;
typed parallel contracts are harder without a second package manager story.

### C — Raw CDP (language-agnostic protocol client)

Honest case for: maximum control; no Playwright upgrade coupling.

Honest case against: we would re-implement locators, auto-wait, and assertions —
explicitly out of scope at pre-seed per the wave pack.

## Decision

**TypeScript + Node 20+ + Playwright.** Python hello scaffold archived, not
deleted.

## Consequences

Easy: B2–B4 share one Playwright mental model; contract examples validated with
Ajv in Node; CI is a single `npm run ci`.

Hard: contributors expecting Python must switch; Dependabot pip config is
superseded.

Forecloses: a Python-first public library API in v0 (can revisit post-gate).

## Reversal cost

**Moderate.** Signal to reverse: Playwright cannot express a gate-critical
fingerprint, or a design partner forces Python-only deployment. Reversal means
re-homing `src/*` and keeping contracts unchanged (schemas are language-neutral).

## Open questions / what I could not verify

- Exact Playwright minor pinned in production CI runners after first green
  matrix (will float within ^1 until B1 locks test-bed images).
- Whether repair-loop model SDKs prefer Python — out of scope for stack ADR;
  HTTP boundaries can isolate later.
