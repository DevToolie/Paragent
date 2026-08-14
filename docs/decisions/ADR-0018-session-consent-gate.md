---
title: "ADR-0018 — Where the SC-05 consent moment lives, and its guard"
doc_type: adr
status: accepted
owner: B0
created: 2026-08-14
updated: 2026-08-14
confidence: MED
supersedes: null
sources_verified: true
---

# ADR-0018 — Where the SC-05 consent moment lives, and its guard

## Status

accepted

## Context

**Triggered by:** issue #102, itself filed by `docs/privacy/session-custody.md`'s gap analysis
for SC-05. PRD §7 requires "explicit customer consent language ('you are authorizing automation of
your own account')" before Fork A rides a user's own authenticated session. At the time #102 was
filed, that sentence existed nowhere but the PRD itself — no UI copy, no CLI banner, no onboarding
step, no ToS click-through, and no code path that checks for one.

**Not currently blocking Track 1, and this ADR does not change that.** `establishSession`
(`src/recorder/preamble.ts`) authenticates to a local, self-hosted Grafana container using
`FIXTURE_ADMIN_USER`/`FIXTURE_ADMIN_PASS` (`src/testbed/constants.ts`) — a fixture credential the
project itself provisions and tears down. There is no real account holder to consent on behalf of,
which is the same reasoning `docs/privacy/session-custody.md`'s "Track-1 relevance" section already
gives for SC-05 being inapplicable today. **It becomes required the moment anything establishes a
session against a non-local target**, and that is the moment this ADR's guard is built for, not a
hypothetical future one.

Issue #102 asks for three things. This ADR resolves the first two; the third is the code delivered
alongside it, described under Decision 2.

1. Where the consent moment lives.
2. The actual copy, reviewed by whoever owns legal risk (founder).
3. A guard function that refuses a non-local session establishment without a recorded consent
   acknowledgment, with a unit test on the refusal path.

## Decision 1 — Where the consent moment lives: a stored consent record, checked before every session-establishing run

### Options considered

#### A — Onboarding flow (rejected)

Honest case for: the conventional place a product asks for this kind of agreement, and it would
sit naturally beside a future account-creation or workspace-setup step.

Honest case against: **this product has no onboarding flow to put it in.** Paragent today is a CLI
and a set of libraries (`src/recorder/cli.ts`, `src/testbed/cli.ts`, the `paragent` binary shipped
in the commit immediately before this one) — there is no signup, no hosted account, no step a user
passes through once before ever running a task. Inventing an onboarding flow to hold a consent
screen would be building product surface this ADR has no mandate for, and it would decouple the
consent moment from the thing it is supposed to gate: a user can complete "onboarding" once and
then point the same install at a dozen different real accounts over months, with no onboarding
step in between any of them.

#### B — First-run CLI banner (rejected as the sole mechanism)

Honest case for: it fits the CLI shape this repo actually has, and "first run" is a real, checkable
event — this repo already has first-run logic for an unrelated reason (`dismissFirstRunModal` in
`src/recorder/preamble.ts` handles Grafana's own first-run dialog, so the concept is not foreign
to this codebase).

Honest case against: **"first run" is a property of the install, not of the account being
automated, and Fork A's whole premise is that the same install may be pointed at many different
real accounts over its lifetime.** A banner shown once and never checked again cannot express "the
user agreed to automate *this* account" versus "the user agreed to something, once, a long time
ago, possibly about a different site." It is also structurally unable to satisfy SC-05's own
checkable restatement — "shown before **the session is used**, and this is enforced somewhere
checkable" (`docs/privacy/session-custody.md`) — for any run after the first, because by
definition it does not run again. The banner is real UX, but by itself it answers "has this CLI
ever shown this text," not "did the user agree to automate *this* account, recently enough for
that agreement to still mean something" — and only the latter is what a guard at the point of
session establishment can check.

#### C — A stored consent record, checked before every session-establishing run (chosen)

Honest case for: it is the only one of the three candidates that is a **runtime precondition
rather than a UI moment**, which is what makes it possible to write a guard function against at
all — a guard cannot check "did an onboarding flow run" or "was a banner shown eventually,"
but it can check "does a valid record exist for this target, right now." It is also
mechanism-agnostic about *how* the record gets created: an onboarding flow, a first-run banner, or
a plain CLI prompt can all be the thing that writes it, so choosing C does not foreclose A or B
later as the UX that *produces* the record — it only insists that whatever produces it, the record
is what gets checked, not the act of production itself.

Honest case against: it is the option that requires actually building a gate in the code, not
just copy and a screen — which is the same reason it is the one that makes SC-05 "enforced
somewhere checkable" rather than aspirational. This ADR accepts that cost; see Decision 2.

### Decision

**C.** The consent moment is a stored acknowledgment, checked immediately before any
session-establishing run against a non-local target. What "stored" and "checked" mean concretely
is Decision 2.

## Decision 2 — The guard: `SessionAuthorization`, gating `establishSession` itself

`src/session/consent.ts` adds:

- **`isLocalTarget(baseUrl)`** — true for the IPv4 loopback block (127.0.0.0/8, not just
  `127.0.0.1`), `localhost`, and IPv6 loopback (`::1`, bracketed or not), false for everything
  else including an unparseable URL. Verified against what the test-bed actually binds:
  `DEFAULT_HOST_PORT` in `src/testbed/constants.ts` is served on `127.0.0.1`
  (`experiments/gate-v1/live-run.ts`'s `hostOf` defaults there too), so the predicate is a
  deliberate superset of the one address in use today rather than a pinned literal that would trap
  the next port or interface choice.
- **`ConsentAcknowledgment`** — `{ copy_version, acknowledged_at }`, nothing else. Private
  constructor and a private `#brand` field (mirroring `TenantKey`, `src/session/keys.ts`), so an
  object literal cannot forge one; only `ConsentAcknowledgment.record(copyVersion)` can produce it.
  Carries no credential or session material, by construction — there is no field to put one in.
- **`SessionAuthorization`** — `{ baseUrl, local, consent }`. Same private-constructor-plus-`#brand`
  shape. The only way to obtain one is `SessionAuthorization.authorize(baseUrl, consent?)`, which
  throws `ConsentRequiredError` for a non-local `baseUrl` with no `consent`.
- **`establishSession`'s signature changed**: `EstablishSessionOptions` now takes
  `target: SessionAuthorization` instead of `baseUrl: string`. This is the load-bearing change —
  every existing caller (`src/recorder/cli.ts`, `experiments/gate-v1/live-run.ts`,
  `tests/unit/recorder-preamble.test.ts`) now constructs its target via
  `SessionAuthorization.authorize(baseUrl)` first. All of them target the local test-bed today, so
  none needed a `consent` argument and none changed behavior — verified by running
  `tests/unit/recorder-preamble.test.ts` (the real-browser login suite) unchanged against the new
  signature: 8/8 pass.

### Where this lands on the enforcement ladder

`docs/privacy/session-custody.md` defines three rungs: **enforced by construction** (the bad state
cannot be represented), **enforced by test** (representable, caught by a test), **conventional
only**. This guard is genuinely on the first rung for one specific claim and the second rung for
another, and the two must not be collapsed into one word:

- **"Can a session be established without going through the check at all" — enforced by
  construction.** `establishSession` no longer accepts a `baseUrl` string. There is no second door:
  every call site must first call `SessionAuthorization.authorize`, or it does not type-check.
  `tests/unit/session-consent.test.ts` pins this with `@ts-expect-error` cases — a raw string in
  place of `target`, and a `baseUrl` field where `EstablishSessionOptions` has none — the same
  pattern `tests/unit/session-store.test.ts` uses to pin `TenantKey`.
- **"Does a non-local, non-consented call actually get refused" — enforced by test, not by
  construction.** `consent` is an optional argument to `authorize`, and TypeScript cannot evaluate
  a runtime string (is this hostname local?) at compile time — so a non-local `baseUrl` with no
  `consent` **type-checks**, and the refusal is a runtime throw (`ConsentRequiredError`), not a
  compile error. `tests/unit/session-consent.test.ts` covers this refusal directly, plus the
  matching non-refusal for a local target and for a non-local target *with* consent supplied.

Stated together: **you cannot reach the login flow without passing through the gate, and the gate
refuses the one case SC-05 cares about — but the refusal itself is a checked runtime property, not
an unrepresentable state.** A caller who is determined to bypass consent cannot do it by forgetting
a step; they would have to call `SessionAuthorization.authorize` with a non-local URL and no
consent and have that call *not* throw, which is exactly the case the test suite exercises.

### What this guard does not do

- **It does not persist or read a consent record from disk.** Nothing in this repo establishes a
  session against a non-local target yet (re-verified: `grep -rn "SessionAuthorization\.authorize"`
  across `src/` and `experiments/` returns only the three local call sites above), so there is no
  real caller to build storage for, and inventing one would be exactly the kind of speculation
  `src/recorder/preamble.ts`'s own header warns against ("no speculative branches for versions the
  matrix does not contain" — the same principle applied to a persistence layer nothing calls).
  `ConsentAcknowledgment.record()` is the seam a future CLI prompt or config-file reader calls into;
  this ADR builds the seam, not the caller.
- **It does not show anyone the copy.** `docs/privacy/session-consent-copy.md` is the draft text;
  displaying it and capturing the typed confirmation is UI work with no caller to attach to today,
  for the same reason as above.
- **It is not legal review.** The copy is explicitly marked unreviewed. See that document's own
  "Open questions" section.

**All three of the above are tracked, not just implied by omission**: filed as
[#163](https://github.com/DevToolie/Paragent/issues/163), "the deferred half of SC-05" — the same
shape #146 gave SC-01's custody half after #98 landed the mechanism. That issue also names the
sharpest limitation of what ships here: `ConsentAcknowledgment.record()` takes no required
arguments, so what this guard proves today is "a caller asserted consent," not "a human was shown
the copy and agreed" — a distinction that only closes once persistence and UI land.

## Consequences

**`EstablishSessionOptions.baseUrl` is gone; every caller now supplies `target`.** This is a
breaking change to `establishSession`'s public shape, contained to three files plus the new test
file. All are local, so the change is mechanical there — normalize-and-wrap — but it is a real
signature change and anything outside this repo importing `establishSession` directly (there is no
such consumer today; it is not published as part of the `paragent` binary's public surface) would
need the same update.

**SC-05 moves from "not addressed" to "enforced by construction (unbypassable gate) + enforced by
test (the refusal itself)", with the persistence and UI halves still open.** `docs/privacy/session-custody.md`'s
SC-05 row and gap-analysis section are updated in the same PR to say exactly this, not more.

**No behavior changes for Track 1.** `tests/unit/recorder-preamble.test.ts` passes unchanged
(8/8), and `experiments/gate-v1/live-run.ts` / `src/recorder/cli.ts` both authorize their local
targets with no `consent` argument, exactly as today.

## Reversal cost

**Low today, and this ADR is timed the same way ADR-0016 timed itself** — before a real caller
exists rather than after. Reverting `establishSession`'s signature back to a raw `baseUrl` costs
nothing yet: zero real (non-local) callers exist, so nothing would need re-authorizing. That
changes the moment a persistence layer and a real caller land on top of this gate — at that point,
reversing means every stored consent record and every call site built against
`SessionAuthorization` would need migrating, which is the same "decide the shape before real data
exists" argument ADR-0016 made for session-key custody.

## Open questions / what I could not verify

- **Tracked as [#163](https://github.com/DevToolie/Paragent/issues/163).** The next four bullets —
  persistence, UI, expiry, and legal review — are exactly what that issue exists to resolve; it is
  the place to look for whether any of them has since been answered, not just this list.
- **The persistence and UI mechanism for the consent record are not designed here.** Decision 1
  commits to "a stored consent record, checked before every session-establishing run" as the
  *shape*; where it is stored (a local config file, an OS keychain entry, something else), and what
  UI writes it (a CLI prompt is the natural fit for this repo today, per
  `docs/privacy/session-consent-copy.md`), is left to the first real non-local caller, the same way
  ADR-0016 left key custody to a caller that does not exist yet.
- **Whether one consent record should cover every future target, or one per distinct site.**
  `docs/privacy/session-consent-copy.md`'s open questions cover this from the copy side;
  `SessionAuthorization.authorize` takes a `consent` argument per call, which is compatible with
  either policy without further code change, but this ADR does not pick one.
- **Whether a consent acknowledgment should expire.** Nothing here gives `ConsentAcknowledgment` a
  validity window — `acknowledged_at` is recorded but never compared against a policy. Not decided,
  because there is no caller yet to enforce a window against.
- **The legal adequacy of the draft copy** — entirely out of this ADR's competence; see
  `docs/privacy/session-consent-copy.md`.
- **This ADR has not been reviewed by anyone outside this repo**, the same caveat ADR-0016 and
  `session-state-encryption.md` carry for their own threat models.
