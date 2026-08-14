---
title: Session-custody requirements checklist + gap analysis (PRD §7)
doc_type: spec
status: draft
owner: B5
created: 2026-07-30
updated: 2026-08-14
confidence: HIGH
supersedes: null
sources_verified: true
---

# Privacy — session custody (PRD §7, Fork A)

PRD §7 commits to **Fork A**: the agent rides the user's own authenticated session, so the
product holds the customer's cookies and storage-state — "sensitive infrastructure in its own
right" — and names five v1 requirements. The pivot brief keeps Fork A unchanged under the
counterparty model (decision 5) and escalates the standing problem, because the portal owner is
now a third party with no contract (pivot brief §5).

This is a **sizing and gap-analysis doc, not an implementation.** It restates PRD §7 as checkable
requirements, reads the code at HEAD against each one, and files a follow-up issue per gap. One
one-line documentation fix was taken inline (a stale citation in `docs/architecture.md`, noted
below); everything else is sized, not built, here.

## Requirements table

| Id | Requirement (PRD §7) | Checkable restatement |
| --- | --- | --- |
| SC-01 | Storage-state encrypted at rest, per-tenant keys | Any persisted session material is unreadable without a per-tenant key; a canary test proves a plaintext write is impossible, not merely unobserved |
| SC-02 | Never written to trajectories | No trajectory ever produced by the recorder contains a cookie/storage-shaped field, on disk, regardless of call path |
| SC-03 | Never written to logs | No console output, CI log, or persisted log artifact ever contains cookie/storage-shaped content |
| SC-04 | Session material excluded from the compiler's input by construction | The compiler's input type has no field capable of carrying it, so there is nothing to exclude at runtime — it was never representable |
| SC-05 | Explicit customer consent language | A user automating their own account is shown "you are authorizing automation of your own account" (or equivalent) before the session is used, and this is enforced somewhere checkable — **enforced by construction (gate) + enforced by test (refusal), copy drafted but not legally reviewed; see [ADR-0018](../decisions/ADR-0018-session-consent-gate.md)** |
| SC-06 | Documented ToS position per anchor site | For each real (non-local) portal the agent authenticates against, a written position on authorized-user automation exists before any run against it |

`SC-02` and `SC-03` split PRD's single "never written to logs or trajectories" clause into two
rows because, verified below, they currently have different enforcement mechanisms and different
status — collapsing them into one row would hide that difference.

## Gap analysis against the code at HEAD

Status values: **enforced by construction** (the bad state cannot be represented — cite the
mechanism), **enforced by test** (representable, but a test fails the build if it happens),
**conventional only** (relies on nobody doing the wrong thing; no automated check), **not
addressed** (no mechanism, no test, nothing).

### SC-01 — encrypted at rest, per-tenant keys — **enforced by construction, canary-proven; still no caller**

**Updated 2026-08-11 (#98).** The gap analysis below was written when there was no mechanism at
all. There now is one — `src/session/`, specified in
[session-state-encryption.md](./session-state-encryption.md) — and the status splits in two:

- **The mechanism: enforced by construction.** `writeEncryptedStorageState` requires a
  `TenantKey`, which has a private constructor and private material and therefore cannot be
  forged by an object literal. An unencrypted write is a **compile error**, pinned by
  `@ts-expect-error` cases in `tests/unit/session-store.test.ts` that fail the build if those
  calls ever compile. Per-tenant HKDF derivation, AES-256-GCM, 0600, opaque `key_id` instead of
  the tenant id on disk.
- **The canary: merge-blocking.** `tests/canary/session-plaintext.test.ts` writes synthetic state
  through the real path and greps the **bytes on disk**, with a mutation-style counter-case that
  writes the same state in plaintext and asserts every marker *is* found — so the "not present"
  assertions cannot go vacuous unnoticed.
- **The exposure: still zero, and still untested against reality.** Nothing calls it. Key
  custody (KMS, rotation, offboarding) is deferred and written down. The round trip has only ever
  run over synthetic fixtures, because this repo has never produced a real `storageState()`.

The original analysis is preserved below, because it is what the requirement was assessed
against and the "safe by omission" reading it warns about is still the one to avoid.

#### Original assessment (2026-07-30) — **not addressed**

Verified by repo-wide search: no call to Playwright's `context.storageState()`, `context.cookies()`,
`context.addCookies()`, or `chromium.launchPersistentContext()` (a persisted user-data directory)
exists anywhere in `src/`, `experiments/`, or `tests/`. `TrajectoryRecorder` (`src/recorder/session.ts`)
operates on a `Page` handed to it and never reaches into its `BrowserContext` for session state;
`establishSession` (`src/recorder/preamble.ts`) and the live matrix driver
(`experiments/gate-v1/live-run.ts`) both call `browser.newContext()` fresh per run and never save it.

**The honest reading is not "safe by omission."** Nothing is encrypted because nothing is
persisted — there is no artifact to audit yet, and no guarantee that the first one will be. PRD
phase 1 names "persisted browser profiles (cookies/storage-state) for session continuity" as the
actual v1 mechanism, so this gap is load-bearing the moment that lands, not hypothetical. Filed as
[#98](https://github.com/DevToolie/Paragent/issues/98): an encrypted-at-rest persistence module
gated by a canary that proves a plaintext write is impossible (mirroring
`tests/canary/store-leak.test.ts`'s bytes-on-disk check, not a unit test on the function in
isolation).

### SC-02 — never written to trajectories — **enforced by construction**, one residual gap

Three independent mechanisms, verified:

1. **Nothing captures it to begin with.** Same absence as SC-01 — no cookie/storage read exists
   anywhere the recorder could serialize it from.
2. **The output object cannot carry it.** `TrajectoryRecorder.toTrajectory()`
   (`src/recorder/session.ts:317-337`) constructs its return value from `this.parameters` and
   `this.steps` only. `this.bindings` — the private field holding actual runtime values, including
   anything a caller named like a secret — is never referenced in that method. The class docstring
   states the intent directly: *"Typed values drive Playwright only — never written to JSON"*
   (`session.ts:56`).
3. **The schema has no slot for it, at every level.** `contracts/trajectory.schema.json` sets
   `additionalProperties: false` on the root object and on `$defs.step`, `$defs.fingerprint`,
   `$defs.provenance`, `$defs.locatorCandidate`, and `$defs.action` — verified by walking the
   schema's `properties`/`additionalProperties` pairs directly. A `cookies` field is not merely
   unpopulated, it is **invalid** anywhere in the document. `scripts/validate-contracts.mjs` checks
   this in CI for the committed example and — since
   [#99](https://github.com/DevToolie/Paragent/issues/99) — for **every** `*.json` under any
   `experiments/**/trajectories/` directory, discovered by walking the tree rather than read from
   a hand-maintained array. A new recording is schema-checked by default instead of when someone
   remembers to add a line. Discovering zero is treated as a hard failure, not as "nothing to do":
   an empty result means the walk broke, which is the same silent hole in a new shape.

Defense in depth, verified: `assertNoLiteralSecrets` (`src/recorder/redact.ts:102-117`) greps the
serialized trajectory for `Set-Cookie`, `"cookies?":`, `"localStorage":`, `"sessionStorage":`,
`"value":"..."`, and a literal `"password":"..."`, throwing on a match. Called at
`session.ts:342` inside `write()`. Tested empirically against a synthetic (fake-valued) Playwright
`storageState()`-shaped JSON blob during this audit — it correctly matched on all three of
`"value":`, `"cookies?":`, and `"localStorage":`.

**Residual gap, now covered by test (#99).** `assertNoLiteralSecrets` still only runs inside
`write()`, and a caller that serializes `toTrajectory()`'s return value directly still bypasses
it. What changed is that the bypass is no longer unobserved:
`tests/unit/trajectory-guard.test.ts` records a login-shaped task, takes the object from
`toTrajectory()` — never calling `write()` — and asserts it passes the same guard `write()` would
have applied, in both pretty-printed and compact form.

The distinction is deliberate. The test does not assert *that the guard runs*; it asserts the
**property the guard protects** holds of the object itself, so it fails only if the recorder
actually starts leaking. A guarantee that depends on which method serializes it is not a
guarantee, and this is the check that would notice.

It also pins each of the guard's six patterns individually. The bypass assertions are all "does
not throw", so weakening the guard makes them *more* likely to pass — they cannot detect it.
Verified during development: deleting the `"value"` pattern left every bypass test green, which is
why the per-pattern cases exist.

**Not closed:** `toTrajectory()` still has no guard of its own. Adding one would change behaviour
(it could throw where it previously did not) and was out of scope for #99, which asked for the
bypass to be *covered*, not closed.

### SC-03 — never written to logs — **conventional only**; the one verified hole in the automated backstop is now closed (#100)

No centralized logging module exists in this codebase — CLI output is scattered `console.log` /
`console.error`, none of which is sourced from cookie/storage state, because (per SC-01/SC-02)
nothing reads it in the first place. That absence is real but is a property of what the code
doesn't do yet, not a tested guarantee.

One narrow, positive, existing mechanism: `scrubCredentials` (`src/testbed/readiness.ts:129`)
redacts `key=value` and basic-auth-in-URL patterns from Docker Compose log tails before they reach
stdout on a readiness timeout. Verified its regex (`/((?:password|passwd|secret|token|api[_-]?key|authorization)["'\s]*[:=]\s*).../gi`)
does **not** match a `Set-Cookie` response header or a JSON cookie array — it was written for the fixture admin
password, not for session material, and does not claim otherwise.

The repo-wide backstop is `npm run secret-scan` (`scripts/secret-scan.mjs`), which runs as part of
the `lint-typecheck-test-secrets` job — confirmed a **required, merge-blocking** status check on
`main` via `scripts/apply-branch-protection.mjs:26-27`. `CONTRIBUTING.md` rule 1 states plainly:
"No credentials, cookies, session/storage dumps... Secret-scanning CI fails the build on matches."

**Verified empirically that this claim is false for the shape that matters most.** A synthetic
fixture shaped like a real Playwright `storageState()` dump —

```json
{"cookies":[{"name":"grafana_session","value":"...","domain":"...","httpOnly":true,"sameSite":"Lax"}],
 "origins":[{"origin":"...","localStorage":[{"name":"...","value":"..."}]}]}
```

— run against all eight of `secret-scan.mjs`'s `PATTERNS` (`scripts/secret-scan.mjs:24-32`)
matched **zero** of them. `cookie-header` requires the literal string `Set-` immediately followed by `Cookie:`; `session-json`
requires a JSON key literally spelled `sessionid`/`sessiontoken`/`sessionkey`. Neither appears in a
real cookie array, whose keys are `name`/`value`/`domain`/`httpOnly`/`sameSite`. No real session
material was used to verify this — only synthetic placeholder values, disposed of after the check
and never committed.

**Closed by [#100](https://github.com/DevToolie/Paragent/issues/100).** `scripts/secret-scan.mjs`
gained two patterns — `storage-state-cookies` and `storage-state-origins` — that match the shape
*structurally*: a `"cookies"` / `"origins"` array co-occurring with a cookie-specific key
(`httpOnly` / `sameSite`, or a nested `localStorage` array) **and** a value of 16+ characters.

That last clause is the whole discriminator, and it is why the code block above does not break
CI. This document quotes a real `storageState()` layout verbatim, and `gate/recorder.md` discusses
the same fields in prose; both elide their values (`"value":"..."`). A genuine dump cannot elide
them, because the value *is* the secret. The patterns therefore catch session **material**, not
session **discussion**, and 16 characters clears every placeholder in the tree ("...",
"REDACTED", "<omitted>") while sitting far below a real session cookie.

Those two conditions are checked **inside the candidate array**, not anywhere in the file
([#115](https://github.com/DevToolie/Paragent/issues/115)). Testing each independently against the
whole body let three unrelated fragments combine into a hit — a feature-flag list that happens to
be named `cookies`, a field named `httpOnly` somewhere else, and any 16-character `"value"` in a
third place. `secret-scan.mjs` now bracket-matches the array that opened the suspicion and looks
for the companion key and the substantial value only within it, which is where a real dump keeps
them. A distance bound would not have been enough: unrelated fragments can also happen to be
adjacent. An array that never closes — a truncated dump — is scanned over a capped window rather
than skipped, so the cap fails toward detection.

`tests/unit/secret-scan.test.ts` pins both directions: a synthetic fixture
(`tests/fixtures/storage-state.sample`, fake values only) is caught, every doc discussing cookies
in prose is not, and a final case walks the whole tree asserting nothing already committed
matches — because a false positive here would break CI for every unrelated PR, and the positive
tests would still pass.

The fixture's extension is deliberately outside the set the repo-wide walk reads, so committing it
does not permanently fail the build; `node scripts/secret-scan.mjs <path>` scans an explicitly
named file regardless of extension, which is how the test proves the patterns fire end to end.

`.gitignore` does carry `cookies*.json` and `storage-state*.json` (lines 47-48) — a real,
pre-existing line, worth crediting — but it is a convention (`git add -f` or a differently-named
file, e.g. Playwright's own common `auth.json` / `playwright/.auth/*.json` convention, bypasses
it), not a test, and it only stops accidental inclusion, not a deliberate or careless commit.

Filed as [#100](https://github.com/DevToolie/Paragent/issues/100): extend `secret-scan.mjs`'s
patterns to match the storageState shape structurally, verified against every doc (including this
one) that legitimately discusses cookies/storage in prose, so the fix does not trade a false
negative for a false positive.

### SC-04 — excluded from the compiler's input by construction — **enforced by construction + test**

`src/compiler/types.ts` independently declares its own `Trajectory` / `TrajectoryStep` /
`Fingerprint` interfaces (lines 109, 130, 146) for exactly the reason `src/runner/program.ts`
gives for a similar duplication elsewhere: the compiler's input type is not the recorder's output
type by reference, it is a separately-typed contract. None of the three has a cookie/storage
field. The compiler's read paths (`src/compiler/assertions.ts`, `src/compiler/locators.ts`,
reviewed for #61) only ever touch `pre_state`/`post_state`/`action`/`locator_candidates`/
`assertion_hint` — fields the type makes exhaustive. Same schema-level backstop as SC-02: every
contract downstream of the trajectory — `contracts/cache-row.schema.json`,
`contracts/assertion.schema.json`, `contracts/metrics.schema.json` — also sets
`additionalProperties: false` at every object level, verified directly. There is no point in the
pipeline where an extra field could ride along even if one were accidentally produced upstream.

Worth stating even though it is not literally a PRD §7 clause: the same guarantee already extends
past the compiler to the (currently stubbed) repair-model path. `RepairContext.page_state`
(`src/runner/types.ts`) is a `PageStateSnapshot` — `capturePageState()`
(`src/runner/page-state.ts:22-62`) builds it from `page.url()`, `page.title()`, a landmark
enumeration, and a network-idle probe only. No cookie read exists there either. The day a real
repair-model client replaces `StubRepairModelClient`, the thing it gets shown already has this
property for free.

**Pinned by [#101](https://github.com/DevToolie/Paragent/issues/101).**
`tests/unit/session-material-tripwire.test.ts` asserts that no key normalizing to `cookie`,
`cookies`, `storagestate`, `localstorage` or `sessionstorage` is reachable from any of these
types. Not new enforcement — the status gains "+ test" because the guarantee now stays true on
purpose rather than by nobody having changed it yet.

The tripwire asserts at three levels, because the obvious one is not sufficient on its own:

| Level | Catches | Why the others cannot |
| --- | --- | --- |
| **Type surface** (TypeScript compiler API, walked recursively from each root type) | a field **declared** on any reachable interface | an optional field nobody populates is erased at runtime and invisible to an instance walk |
| **Contract schema** (`properties` names, plus `additionalProperties: false` on every object definition) | a forbidden property, or a relaxed `additionalProperties` | a TS-only change does not touch the schema, and vice versa |
| **Instances** (real recordings, compiled bundles, a live `capturePageState`) | a value that reached an artifact through an untyped path | neither declaration-level check sees a runtime spread |

Guard-proven rather than asserted. Adding an unpopulated `cookies?: string[]` to `Fingerprint`
fails three type-surface cases — including via two-hop reachability from `Trajectory` — while all
twenty schema and instance assertions stay green, which is the whole reason the first level
exists. Relaxing `$defs.fingerprint.additionalProperties` to `true`, declaring a
`storage_state` property, and making `capturePageState()` return the context's cookies each fail
exactly their own level and nothing else.

Keys are compared after normalization (lowercased, separators stripped), so `storage_state`,
`storageState` and `StorageState` are one entry rather than three near-misses — a future field
would arrive in whichever convention its author reached for.

The live-browser case sets a real cookie on the context before capturing, so "no cookies present"
is not the reason it passes.

### SC-05 — explicit consent language — **enforced by construction (the gate) + enforced by test (the refusal); persistence, UI, and legal review still open**

**Updated 2026-08-14 (#102).** The gap analysis below was written when nothing existed at all —
no decision about where the consent moment lives, no copy, no code. [ADR-0018](../decisions/ADR-0018-session-consent-gate.md)
decides the moment (a stored consent record, checked before every session-establishing run, and
explicitly not an onboarding flow or a one-time first-run banner — both rejected in writing there)
and ships the guard it implies. The status splits into three parts, none of which should be
rounded up to cover the others:

- **The gate: enforced by construction.** `establishSession` (`src/recorder/preamble.ts`) no
  longer accepts a `baseUrl` string — `EstablishSessionOptions.target` requires a
  `SessionAuthorization`, and `SessionAuthorization` has a private constructor plus a private
  `#brand` field (mirroring `TenantKey`, `src/session/keys.ts`), so an object literal cannot forge
  one. The only way to obtain one is `SessionAuthorization.authorize(baseUrl, consent?)`
  (`src/session/consent.ts`). There is no second door into the login flow. Pinned by
  `@ts-expect-error` cases in `tests/unit/session-consent.test.ts`, the same pattern
  `tests/unit/session-store.test.ts` uses for `TenantKey`.
- **The refusal: enforced by test, not by construction.** Whether a non-local target with no
  `consent` argument actually gets refused is a runtime check inside `authorize` — TypeScript
  cannot evaluate "is this hostname local" at compile time, so the bad call *type-checks* and the
  refusal (`ConsentRequiredError`) is a throw, verified by
  `tests/unit/session-consent.test.ts`'s refusal-path cases, not an unrepresentable state. ADR-0018
  states this distinction explicitly rather than claiming the whole guard is "enforced by
  construction."
- **Local-target predicate, verified against what the test-bed actually does.** `isLocalTarget`
  treats the IPv4 loopback block (127.0.0.0/8), `localhost`, and IPv6 loopback as needing no
  consent — a deliberate superset of the one address the test-bed binds
  (`DEFAULT_HOST_PORT` in `src/testbed/constants.ts`, `127.0.0.1`), not a pinned literal.
  `tests/unit/session-consent.test.ts` also asserts a private-LAN address (`192.168.x.x`) is
  **not** treated as local — loopback-only, not "looks internal."

**Not built, and said plainly rather than implied by omission:**

- **No persistence layer.** `ConsentAcknowledgment.record()` produces an in-memory acknowledgment;
  nothing reads or writes one from disk. Nothing in this repo establishes a session against a
  non-local target yet (re-verified: `SessionAuthorization.authorize` has exactly three callers,
  `src/recorder/cli.ts`, `experiments/gate-v1/live-run.ts`, and the test suite, all targeting the
  local test-bed), so there is no real caller to build storage for. This is the same "decide the
  shape before real data exists, build persistence when a caller exists" ordering ADR-0016 used for
  session-key custody.
- **No UI.** Nobody sees a consent screen yet. `docs/privacy/session-consent-copy.md` is a draft of
  the copy; no CLI prompt or banner displays it.
- **The copy is drafted, not legally reviewed.** [`session-consent-copy.md`](./session-consent-copy.md)
  states PRD §7's "you are authorizing automation of your own account" close to verbatim, but issue
  #102 requires review "by whoever owns legal risk here (founder)," and that has not happened. The
  document says so in its own frontmatter (`confidence: LOW`) and body — this line is not the only
  place that caveat lives, and it should not need to be found here to be believed.

**No change to Track 1.** All three real call sites target the local test-bed and pass no
`consent` argument; `tests/unit/recorder-preamble.test.ts` (the real-browser login suite) passes
unchanged, 8/8, against the new `establishSession` signature.

### SC-06 — documented ToS position per anchor site — **not addressed, and currently inapplicable**

Track 2 (vertical search) is a documented **FAIL** with no anchor locked
([ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md)) — there is no site to write a position
for yet. Track 1's test-bed is self-hosted Grafana OSS, chosen specifically to carry "no partner or
third-party SaaS ToS" exposure ([ADR-0003](../decisions/ADR-0003-testbed-grafana-oss.md)) — there
is no third party involved in the gate at all. Pivot brief §5 already scopes this correctly:
required **before any paid pilot**, not before Track-1's technical gate, and explicitly says the
counterparty model makes the problem harder ("your user is an authorized guest in a portal owned
by a third party you have no commercial relationship with"). Filed as
[#103](https://github.com/DevToolie/Paragent/issues/103), triggered by a vertical actually being
locked, not by a deadline.

## The distinction this repo must not lose

`docs/privacy/boundary-spec.md` (§6 of the PRD) governs a different question: **what may enter the
cross-tenant pooled cache.** Its canary tests (`tests/canary/canary.test.ts`,
`tests/canary/mutation.test.ts`, `tests/canary/store-leak.test.ts`) seed `CANARY_TENANT` —
synthetic account ids, names, emails, and thresholds (`src/cache/pipeline.ts:9-16`) — and assert
none of them reach `pool_eligible=true` rows, logs, or metrics, while confirming they **do** reach
the tenant-scoped file, proving the split is real rather than merely dropped everywhere. That is a
pooling-allowlist test. It is not a session-custody test — it never constructs a cookie or a
storage-state object, and boundary-spec.md says so itself, in its "Attacks this does NOT defend
against" list: *"Screenshots, HAR, cookies, storage dumps (repo policy, not this module)."*

Session custody governs a different, broader question: **what may exist at rest anywhere**,
including inside a tenant-scoped row that boundary-spec.md's allowlist was never meant to touch,
and including logs, which the allowlist also does not cover except incidentally (its canary does
check that pool-cache logging doesn't leak tenant *content*, which is adjacent but not the same
claim as "no log anywhere leaks session material").

They are different boundaries with different failure modes and, right now, different owners of
proof: the pooling boundary has a merge-blocking canary; session custody, per the gap analysis
above, mostly does not yet. An agent picking up privacy work in this repo must not read "the
canary is green" as evidence that session custody is handled — it is evidence about a boundary one
layer over, on a different kind of data, with a different threat model (cross-tenant leakage vs.
credential/session exposure).

## Track-1 relevance

During the gate, `establishSession` (`src/recorder/preamble.ts`) authenticates to a local,
self-hosted Grafana container using `FIXTURE_ADMIN_USER` / `FIXTURE_ADMIN_PASS`
(`src/testbed/constants.ts`) — a fixture credential the project itself provisions via
`GF_SECURITY_ADMIN_PASSWORD` in the test-bed's own compose config, torn down with the container.
**There is no real customer session at risk in Track 1 today.** SC-05 (consent) and SC-06 (ToS)
are inapplicable for the same reason ADR-0003 gives for choosing a self-hosted test-bed in the
first place: there is no customer being automated and no third party being visited.

**What changes the moment anything runs against a non-local target:** the fixture credential stops
being a fixture. SC-05 becomes required before the first such run, not before a paid pilot — the
consent requirement is about automating *anyone's* real account, not specifically a paying
customer's. SC-06 becomes required the moment the target is a portal this project does not own,
matching pivot brief §5's counterparty framing exactly. SC-01 now has a mechanism and a
merge-blocking canary (#98) but still no caller and no real material behind it; SC-02/03's
"conventional only" statuses stop being acceptable the moment session material is real
rather than absent — none of Track 1's current green checks (`npm run test:canary`,
`npm run secret-scan`) were exercised against real session material, and this doc's empirical
finding under SC-03 shows at least one of them would not catch it if it were.

## Proposed enforcement (fed to the follow-up issues above)

| Gap | Proposed test shape | Issue |
| --- | --- | --- |
| SC-01 | ~~Canary: persist a fixture storage-state through the real path, read raw bytes on disk, assert not plaintext-parseable; mutation case proves a broken key leaves plaintext~~ **Built** — `tests/canary/session-plaintext.test.ts`, with the plaintext counter-case; mechanism in [session-state-encryption.md](./session-state-encryption.md) | [#98](https://github.com/DevToolie/Paragent/issues/98) |
| SC-02 residual | Unit test: `toTrajectory()`'s return value, serialized directly (not via `write()`), still matches none of `assertNoLiteralSecrets`'s patterns. Replace the hand-maintained `extraTrajectories` list with a glob | [#99](https://github.com/DevToolie/Paragent/issues/99) |
| SC-03 | New `secret-scan.mjs` pattern(s) for the storageState shape; fixture proves a catch; every existing doc discussing cookies/storage in prose proves a non-catch | [#100](https://github.com/DevToolie/Paragent/issues/100) |
| SC-04 | Tripwire: forbidden-key list never appears in serialized compiler `Trajectory`/`Fingerprint` or runner `PageStateSnapshot` output | [#101](https://github.com/DevToolie/Paragent/issues/101) |
| SC-05 | ~~Not a test until the product decision lands; then a guard-function refusal path with a unit test~~ **Built** — `SessionAuthorization.authorize` (`src/session/consent.ts`), gating `establishSession`; refusal path pinned by `tests/unit/session-consent.test.ts`. Persistence, UI, and legal review of the copy remain open | [#102](https://github.com/DevToolie/Paragent/issues/102) |
| SC-06 | Not a test; a counsel packet per pivot brief §5, gated on a vertical being locked | [#103](https://github.com/DevToolie/Paragent/issues/103) |

## One-line fix taken in this PR

`docs/architecture.md` invariant 3 cited `src/recorder/redact.ts:66-81` for
`assertNoLiteralSecrets`; the function is at lines 102-117 in the file at HEAD (verified while
grounding SC-02). Corrected in place — a stale citation in a security-invariant list is worse than
no citation, since it reads as verified when it silently is not.

## Open questions / what I could not verify

- ~~Whether any future encrypted-storage implementation (SC-01) should use OS keychain integration,
  a KMS, or a simpler per-install key file for v1 — not sized here, left to #98.~~ **Answered
  (#98):** an env-supplied master key with per-tenant HKDF derivation, and key **custody**
  explicitly deferred with the reasons and the prod prerequisites written down in
  [session-state-encryption.md](./session-state-encryption.md). The derivation is per-tenant from
  the start because that is the part retrofitting cannot fix without re-encrypting everything.
- Whether Grafana's own container logs could ever surface a session cookie server-side (independent
  of anything this repo writes) — out of this repo's control either way, not tested.
- Whether `docs/privacy/boundary-spec.md`'s canary pipeline should grow a session-custody-style
  check of its own, or whether keeping the two test suites (`tests/canary/` vs. whatever #98-#101
  produce) fully separate is the right long-term shape. Leaning separate, given they test different
  claims, but not decided here.
- Real-world coverage of the `secret-scan.mjs` gap (#100) beyond the one synthetic shape tested —
  Playwright's storageState format is the one this codebase would actually produce, but other
  session-material shapes (a raw `document.cookie` string dump, a JWT in a header log) were not
  separately fuzzed against the current patterns.
- **SC-05's persistence layer, UI, and legal review are not built (#102, ADR-0018).** The gate and
  its refusal path are real and tested; reading/writing a consent record from disk, showing anyone
  the copy, and getting the copy reviewed by whoever owns legal risk (founder) are all still open,
  and none of them has a caller to attach to yet because nothing in this repo establishes a session
  against a non-local target. See [ADR-0018](../decisions/ADR-0018-session-consent-gate.md) and
  [session-consent-copy.md](./session-consent-copy.md) for what each piece still needs.
