---
title: Awesome-lists submission packet
doc_type: brief
status: draft
owner: D2
created: 2026-08-21
updated: 2026-08-28
confidence: HIGH
supersedes: null
sources_verified: true
---

# Awesome-lists submission packet

In-repo draft for [GitHub issue #138](https://github.com/DevToolie/Paragent/issues/138).
**Do not open external PRs from this packet** without explicit founder sign-off.
The honesty precondition that used to block this ([#167](https://github.com/DevToolie/Paragent/issues/167))
is closed — the Quick Start now works — but awesome-list maintainers click through, and
submitting is a judgment call about scope and timing, not a checklist outcome.

Preconditions re-verified against `origin/main` and the published `paragent@0.1.1`
tarball on 2026-08-28.

---

## Preconditions checklist (current status)

| Precondition | Issue status | Verified in repo | Status |
| --- | --- | --- | --- |
| Visitor README | **#133 MERGED** ([#133](https://github.com/DevToolie/Paragent/pull/133)) | Root `README.md` is a visitor landing page; internal map lives in [`docs/README-internal.md`](../README-internal.md) | **Done** |
| Install path / npm | **#134 CLOSED**; published by [#183](https://github.com/DevToolie/Paragent/pull/183) | `paragent@0.1.1` is on the registry with SLSA provenance. `npx paragent record --fixture` and `npx paragent compile` were run from a clean directory against the published tarball — both exit 0 and write their artifacts | **Done** |
| Demo GIF | **#137 CLOSED** ([#140](https://github.com/DevToolie/Paragent/pull/140)) | [`docs/assets/demo.gif`](../assets/demo.gif) exists (~924 KB, 720×428) and is embedded in the root README | **Done** |

The original #138 gate treated “#134 landed” as “visitor can install without cloning.”
That gap — publishable ≠ published — is now closed: the package is on the registry and
the README documents the path that actually runs.

---

## Ready to submit?

**Verdict: the mechanical preconditions are met.** All three checklist rows are Done,
and the Quick Start a list maintainer would click through now works from a clean
machine — verified against the published tarball, not the working tree.

Rationale:

- `npm view paragent` returns `0.1.1` (was 404).
- Root README instructs `npx paragent record …` / `npx paragent compile …`, and both
  commands run from the published package.
- The tarball carries an SLSA provenance attestation tying it to a GitHub Actions
  build of this repo.

**This is still not authorization to submit.** #138 reserves the submission itself for
the founder, and two judgment calls remain open: whether a pre-gate project with no
Track-1 number belongs on a curated list at all, and whether the entry text below
clears the no-performance-claims constraint. Re-read both before opening anything.

**Not in scope for agents on this task:** opening PRs to `angrykoala/awesome-browser-automation`
or `e2b-dev/awesome-ai-agents`. The founder submits, and only they decide when.

---

## Constraint (both lists)

**No performance claims. No pending Track-1 metrics.**

Per [`docs/INTEGRITY-AUDIT.md`](../INTEGRITY-AUDIT.md) A-05 / B-02, replay cost and related
numbers are `[PENDING TRACK-1]`. Describe the **mechanism** only — e.g. replays without
the model in the loop, model called back only to repair broken steps. Never quote a
saving, survival rate, or gate number. An external list is where an unmeasured figure
gets quoted back at us with no source.

---

## Target 1 — angrykoala/awesome-browser-automation

- List: [angrykoala/awesome-browser-automation](https://github.com/angrykoala/awesome-browser-automation)
- Section: **AI** (guidelines: tools primarily focused on AI / agents / prompt automation)
- Format: name as a markdown link, then ` - Description.` — alphabetical, capital letter, full stop, no trailing slash on the URL
- Position: under **P**

### Draft entry

```markdown
[Paragent](https://github.com/DevToolie/Paragent) - Records a browser agent's successful run and replays it as a deterministic script with per-step assertions, calling the model back only to repair steps that break.
```

### PR checklist (when unblocked)

- [ ] One PR, this suggestion only
- [ ] Correct alphabetical position in the AI section
- [ ] PR description explains why it is awesome, not just what it is
- [ ] Link is direct, no trailing slash
- [ ] **Agent-submission rule:** if an automated agent opens the PR, the PR message **must include a joke** — required by their [CONTRIBUTING](https://github.com/angrykoala/awesome-browser-automation/blob/master/CONTRIBUTING.md); maintainers use it to spot agents that skipped the guidelines

### Agent joke note (draft — swap before submit)

> Why did the trajectory refuse to cross the road? It already had a compiled path with
> assertions on every step, and the model only comes back when something breaks.

Do not open the external PR from this repo task; leave the joke in the founder PR body
when they submit.

---

## Target 2 — e2b-dev/awesome-ai-agents

- List: [e2b-dev/awesome-ai-agents](https://github.com/e2b-dev/awesome-ai-agents)
- Submit via PR or [their form](https://forms.gle/UXQFCogLYrPFvfoUA)
- Weaker category fit: Paragent is infrastructure agents plug into, not a general-purpose
  autonomous agent. Expect lower marginal traffic and possible out-of-scope pass-over.
- Least-wrong category: **"Build your own"** (not a general-purpose agent bucket)

### Draft block

```markdown
### Paragent

### Category
Build your own

### Description
- Records a successful browser-agent run and compiles it into a deterministic replay script
- Attaches a post-condition assertion to every step
- Replays without keeping the model in the loop; calls the model only to repair steps that break
- Open-source (MIT); pre-seed — thesis and gate number still unproven

### Links
- [GitHub](https://github.com/DevToolie/Paragent)
```

Adjust alphabetical placement and heading level to match the list’s current README
conventions at submit time. Description bullets carry **no metrics**.

---

## Later (not drafted here)

- `Jenqyang/Awesome-AI-Agents` and `kaushikb11/awesome-llm-agents` — lower priority than
  the two targets above; revisit only after the primary submissions land or are declined.

---

## Open questions / what I could not verify

- Whether either maintainer considers a pre-seed project with an unproven thesis in scope
  beyond “documented and functional.”
- Whether `e2b-dev/awesome-ai-agents` prefers the Google form over PRs in practice.
- Whether awesome-browser-automation’s “Related tools” section would be a better home than
  AI if the maintainer reads Paragent as infrastructure rather than an AI tool.
- ~~After #167 merges: confirm the Quick Start is clone-based (or that npm publish is
  real), then flip the verdict above.~~ **Retired** — `paragent@0.1.1` is published and
  the `npx` Quick Start is verified against the published tarball. The verdict above is
  flipped; the submission itself is still the founder's call.
