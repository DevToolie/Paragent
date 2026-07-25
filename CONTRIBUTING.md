# Contributing

## Hard rules

1. **No secrets ever.** No credentials, cookies, session/storage dumps, `.env`
   files, API tokens, customer or design-partner names, or third-party portal
   screenshots/content. Secret-scanning CI fails the build on matches.
2. **Every factual claim needs a source** (URL + access date) in research docs.
3. **Never invent a metric.** Gate numbers and cost savings are `[PENDING TRACK-1]`
   until measured. Fabricating a number is a fireable error.
4. **Stay in your lane.** Do not do another agent's job; do not soften findings.
5. **Document as you go** in the repo, with the standard YAML frontmatter.

## Branch naming

- `track1/<agent>-<topic>` — e.g. `track1/b1-testbed`
- `track2/<agent>-<topic>`
- `track3/<agent>-<topic>`
- `wave0/b0-<topic>` for steward follow-ups

## PRs

- One logical unit per PR; keep them small.
- Write the doc with the code, never after.
- Update `docs/README.md` when you add a document.
- CI must pass except where a documented intentional red exists (historically the
  canary stub — replaced by B5's real canary).
- Contracts in `contracts/` are the integration surface. Prefer extending a
  schema via ADR over ad-hoc JSON fields in one package.

## Documentation standard

Every `.md` in this wave carries YAML frontmatter:

```yaml
---
title: <human title>
doc_type: adr | research | spec | gate-result | pitch | brief | runbook
status: draft | review | accepted | superseded | killed
owner: <agent id>
created: YYYY-MM-DD
updated: YYYY-MM-DD
confidence: LOW | MED | HIGH
supersedes: <path or null>
sources_verified: true | false
---
```

- Filenames: kebab-case; dated when point-in-time.
- Every doc ends with **Open questions / what I could not verify**.
- Evidence tables include `evidence_urls` and `access_date` columns.
- Expensive-to-reverse choices become ADRs under `docs/decisions/`.

## Contracts

Build against:

- `contracts/trajectory.schema.json`
- `contracts/assertion.schema.json`
- `contracts/cache-row.schema.json`
- `contracts/metrics.schema.json`

Worked examples: `contracts/examples/`. Run `npm run validate:contracts`.

## Local checks

```bash
npm install
npm run secret-scan
npm run validate:contracts
npm run lint
npm run typecheck
npm run test
```
