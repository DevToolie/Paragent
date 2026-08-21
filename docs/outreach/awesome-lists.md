---
title: Awesome-lists submission packet
doc_type: brief
status: draft
owner: D2
created: 2026-08-21
updated: 2026-08-21
confidence: HIGH
supersedes: null
sources_verified: true
---

# Awesome-lists submission packet

In-repo draft for [GitHub issue #138](https://github.com/DevToolie/Paragent/issues/138).
**Do not open external PRs from this packet** until a founder confirms the visitor
README is honest (see [#167](https://github.com/DevToolie/Paragent/issues/167)).
Awesome-list maintainers click through; a broken Quick Start is worse than no entry.

Verified against this branch (`docs/138-awesome-lists`, based on `origin/main`) on
2026-08-21.

---

## Preconditions checklist (current status)

| Precondition | Issue status | Verified in repo | Status |
| --- | --- | --- | --- |
| Visitor README | **#133 MERGED** ([#133](https://github.com/DevToolie/Paragent/pull/133)) | Root `README.md` is a visitor landing page; internal map lives in [`docs/README-internal.md`](../README-internal.md) | **Done** |
| Install path / npm | **#134 CLOSED** (publishable work landed; see also [#155](https://github.com/DevToolie/Paragent/pull/155)) | `package.json` has `bin` / `files` / no `private: true`, but **`npm view paragent` → 404** — package is **not** on the registry. Root README Quick Start still documents `npx paragent …` | **Issue closed; publish missing.** Honest path waits on [#167](https://github.com/DevToolie/Paragent/issues/167) (clone Quick Start) and/or an actual publish |
| Demo GIF | **#137 CLOSED** ([#140](https://github.com/DevToolie/Paragent/pull/140)) | [`docs/assets/demo.gif`](../assets/demo.gif) exists (~924 KB, 720×428) and is embedded in the root README | **Done** |

The original #138 gate treated “#134 landed” as “visitor can install without cloning.”
That is **not** true today: publishable ≠ published. Treating the closed issue as green
would send list maintainers to a 404.

---

## Ready to submit?

**Verdict: blocked** until [#167](https://github.com/DevToolie/Paragent/issues/167) merges
(and this packet is re-checked), **or** until `paragent` is actually on npm and the
README `npx` path works from a clean machine.

Rationale on this branch:

- Root README still instructs `npx paragent record …` / `npx paragent compile …`.
- `npm view paragent` returns 404.
- Submitting now advertises a Quick Start that fails for every stranger who tries it.

After #167 lands with a **clone-based** Quick Start that works, re-run this checklist.
A clone-only entry may then be acceptable to the founder even without npm; #138’s
original note that clone-only “reads as unfinished” remains a judgment call — do not
treat this packet as authorization to submit.

**Not in scope for agents on this task:** opening PRs to `angrykoala/awesome-browser-automation`
or `e2b-dev/awesome-ai-agents`. Founder submits after the README/#167 honesty gate.

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
- After #167 merges: confirm the Quick Start is clone-based (or that npm publish is real),
  then flip the verdict above and let the founder submit.
