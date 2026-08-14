---
title: Session-automation consent copy (SC-05 draft)
doc_type: spec
status: draft
owner: B0
created: 2026-08-14
updated: 2026-08-14
confidence: LOW
supersedes: null
sources_verified: true
---

# Session-automation consent copy (SC-05, PRD §7)

**This copy has NOT been legally reviewed.** [ADR-0018](../decisions/ADR-0018-session-consent-gate.md)
requires review "by whoever owns legal risk here (founder)" (issue #102, echoing pivot brief §5's
counsel-packet pattern) before this text is shown to a real user against a real account. Nothing
in this repo has done that review. Treat every string below as a first draft, not as cleared
copy — do not ship it, and do not cite this document as evidence the requirement is satisfied.
`sources_verified: true` in the frontmatter means the *factual* claims the copy makes about this
codebase (what is/isn't logged, what SC-06 covers) were checked against the code and other privacy
docs at authoring time; it says nothing about legal adequacy, which is a different kind of
verification this document cannot perform.

## What this must say, and why

PRD §7 requires "explicit customer consent language ('you are authorizing automation of your own
account')" before Fork A rides a user's own authenticated session. The requirement names a specific
sentence as the bar (`or equivalent`), not a topic to cover loosely, so the draft below states it
close to verbatim rather than paraphrasing it away.

## When this is shown

Per ADR-0018, the enforcement point is **a stored consent record, checked before every
session-establishing run** — not a one-time onboarding screen and not only a first-run banner.
This copy is the text a user sees at the moment that record is created. The natural home for that
moment, given this repo is a CLI today, is an interactive prompt the first time
`establishSession` (`src/recorder/preamble.ts`) is about to run against a **non-local** target;
`docs/privacy/session-custody.md`'s Track-1 relevance section is why local (test-bed) runs never
show this at all. **Building that prompt and its storage is explicitly out of scope for this
document and for issue #102** — see `src/session/consent.ts`'s module doc for what is and is not
built. This file only owns the words.

## Consent screen text — `copy_version: sc05-v1`

> ### You're about to let Paragent act inside your account
>
> Paragent is going to use **your** sign-in to continue. That means **you are authorizing
> automation of your own account** — every action it takes from here (clicking, typing,
> navigating, saving) happens as you, with your permissions, inside your own session.
>
> Paragent does not create a separate account and does not act on anyone else's behalf.
>
> Your password is never stored by Paragent. Your session (cookies / sign-in state) is never
> written into a recorded task, a log, or anything shared with other users of this tool.
>
> Before continuing, confirm:
>
> - [ ] I am automating **my own account**, or an account I am explicitly authorized to operate.
> - [ ] I understand Paragent will take real, effective actions inside this account on my behalf —
>       not a simulation.
> - [ ] I am responsible for checking whether the site I'm pointing Paragent at allows this kind of
>       automation under its own terms.
>
> Type **I CONSENT** to continue, or anything else to cancel.

## Recorded acknowledgment

Confirming records `{ copy_version: "sc05-v1", acknowledged_at: <ISO timestamp> }` and nothing
else — see `ConsentAcknowledgment` in `src/session/consent.ts`. No credential, cookie, or session
value is ever a field on that record; CONTRIBUTING rule 1 ("no secrets ever") applies to a consent
record exactly as it does to a trajectory or a log line.

## Declining

Typing anything other than the exact confirmation string is a decline, not a retry loop that
nags — `establishSession` is never called for that run, and the caller sees
`ConsentRequiredError`'s message (`src/session/consent.ts`), which restates why and points back
at this document's `copy_version`.

## What is deliberately NOT in this copy

- **No liability waiver or indemnification language.** That is exactly the kind of clause pivot
  brief §5 reserves for whoever owns legal risk (the founder), and drafting one here would be
  writing that person's decision for them under the cover of "consent copy."
- **No per-site legalese about a specific portal's terms of service.** That is SC-06's job
  (`docs/privacy/session-custody.md`, filed as
  [#103](https://github.com/DevToolie/Paragent/issues/103)), triggered by a real anchor site being
  locked, not by this document. This copy only asks the user to take responsibility for checking —
  it does not check on their behalf.

## Open questions / what I could not verify

- **Legal adequacy — the load-bearing open question.** Whether this text actually satisfies PRD
  §7's "or equivalent" bar in a way that would hold up under scrutiny is not something this
  document, or the agent that wrote it, can verify. It requires the founder's review named in
  issue #102, which has not happened.
- **Whether a typed confirmation string (`I CONSENT`) is the right affirmative-action pattern for
  a CLI, versus a single keypress or a `--i-consent` flag.** Chosen here for being unambiguous and
  hard to trigger accidentally; not tested against a real user.
- **Whether the copy needs to name the specific site/portal being automated**, once SC-06 exists
  for a real anchor. This draft is deliberately site-agnostic because no anchor is locked yet
  (`docs/privacy/session-custody.md`, SC-06); revisit when one is.
- **Whether one global acknowledgment should cover every future site**, or whether a new consent
  event is needed per distinct non-local target. Leaning toward per-target (a user agreeing to
  automate their email account says nothing about their bank), but not decided — `src/session/consent.ts`'s
  `SessionAuthorization.authorize` takes a `consent` argument per call, which is compatible with
  either policy but does not itself pick one.
