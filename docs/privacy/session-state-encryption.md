---
title: Encrypted-at-rest session state — threat model and v1 scope
doc_type: spec
status: accepted
owner: B5
created: 2026-08-11
updated: 2026-08-12
confidence: MED
supersedes: null
sources_verified: true
---

# Privacy — encrypted-at-rest session state (SC-01)

Closes the mechanism half of [#98](https://github.com/DevToolie/Paragent/issues/98).
[`session-custody.md`](./session-custody.md) SC-01 restates PRD §7 as: *any persisted session
material is unreadable without a per-tenant key, and a canary test proves a plaintext write is
impossible rather than merely unobserved.*

## The honest starting position

**Nothing in this repo persists session material, and this does not change that.** Re-verified
at the time of writing: no call to `context.storageState()`, `context.cookies()`,
`context.addCookies()` or `chromium.launchPersistentContext()` exists in `src/`, `experiments/`
or `tests/` outside `src/session/` itself. `TrajectoryRecorder`, `establishSession` and the live
matrix driver all use ephemeral `browser.newContext()` sessions.

So this ships a **capability with no callers**, deliberately. PRD phase 1 names "persisted
browser profiles (cookies/storage-state) for session continuity" as the v1 mechanism; the point
of building the safe path before the first caller is that the first caller then has no
unencrypted path to reach for. It is not evidence that anything is protected today, because
there is nothing to protect yet.

## Threat model, stated before the design

"At rest" means different things in the three places this code runs, and building against an
unstated threat model is what the constraint in #98 warns about.

| Context | What "at rest" means | In scope | Out of scope |
| --- | --- | --- | --- |
| **Local dev** | A developer laptop's filesystem, plus whatever backup/sync software watches it | Another process or user on the box reading the file; the file being copied into a backup, a bug report, or a repo | A compromised laptop with the developer's own privileges while the key is in memory |
| **CI** | An ephemeral runner's disk and its log/artifact upload | A file surviving into an uploaded artifact; material reaching a log | Real session material — CI never has any, and the canary uses synthetic values |
| **Prod (not yet built)** | Persistent storage under the product's control | Per-tenant separation of readable material; one tenant's key never yielding another's session | Key custody: a KMS, rotation, escrow, HSM. **Decided in [ADR-0016](../decisions/ADR-0016-session-key-custody.md), not yet implemented — see below** |

Two threats are explicitly **not** addressed and must not be assumed away: an attacker who holds
the master key, and an attacker with live access to the process while it is decrypting. This
protects bytes on a disk, not a running process.

## Design

`src/session/`, four modules and no plaintext sibling:

| Module | Role |
| --- | --- |
| `keys.ts` | `MasterKey` (env or ephemeral) → `TenantKey` via HKDF-SHA256, plus the opaque `key_id` |
| `store.ts` | AES-256-GCM envelope: write, read, parse. `FILE_MODE` 0600 |
| `persist.ts` | `persistSessionState` / `restoreSessionState` — the pair a caller uses |
| `types.ts` | The `storageState()` shape, declared locally so this package needs no browser |

**The guarantee is a type, not a check.** `writeEncryptedStorageState` takes a `TenantKey` as a
required parameter; `TenantKey` has a private constructor and private key material, so it cannot
be produced by an object literal and cannot be forged structurally. An unencrypted write is a
**compile error**, and `tests/unit/session-store.test.ts` pins that with `@ts-expect-error`
cases — which fail the build if those calls ever start compiling. A runtime check would be a
thing somebody in a hurry can skip.

**Envelope layout** (binary, deliberately not JSON):

```text
magic "PGSS" | version u8 | key_id 8B | salt 16B | iv 12B | tag 16B | ciphertext
```

- **Binary**, so the canary's "`JSON.parse` fails" assertion means something. A JSON wrapper
  around a base64 blob would parse, and a file shaped like the thing it protects invites someone
  to treat it as that thing.
- **`key_id`, never the tenant id.** An opaque HMAC label. It is enough to tell "wrong key" from
  "corrupt file", and it keeps a customer identifier out of a file that may later be attached to
  a bug report (CONTRIBUTING rule 1).
- **`key_id` is bound in as AES-GCM AAD**, so relabelling a file for another key fails the tag.
- **Fresh random salt and IV per write**, so encrypting the same session twice produces
  different bytes — a stable ciphertext would make the file a fingerprint of the session even to
  someone who cannot read it.

**Key derivation.** `HKDF-SHA256(master, salt, "paragent/session-state/v1/tenant=<id>")`. The
tenant id is in `info`, so two tenants cannot land on the same key and neither can reach the
master. `key_id = HMAC-SHA256(master, "…/key-id/tenant=<id>")` truncated to 8 bytes — stable per
tenant across files (it has to identify), while the key material is not (it must not).

**This derivation is what v1 shipped, and [ADR-0016](../decisions/ADR-0016-session-key-custody.md)
decides to change it before there is a first caller.** Erasing one tenant cryptographically
requires per-tenant *secret* material to destroy, and every input above except the master is
public or reconstructible — so the ADR adds a per-tenant erasure secret as a second secret input
to HKDF. It is decided now rather than later precisely because changing derivation after real
files exist means re-encrypting all of them, which is the same reason #98 refused to defer
per-tenant derivation itself. Nothing in this module implements it yet.

**Key material never prints.** `toJSON`, `toString` and the Node inspect hook on both key classes
render `[redacted]`, so a key caught in a log line, an error dump or a `JSON.stringify` of an
enclosing object shows a label. SC-03 says session material never reaches logs; a key is that.

## The canary, and why it has a counter-case

`tests/canary/session-plaintext.test.ts` writes synthetic state through the real path into a
temp directory and greps the **bytes on disk** — not the return value — for every canary string,
for the structural keys of a dump (`cookies`, `localStorage`, `httpOnly`, `sameSite`, `value`),
and for the tenant id. It also asserts `JSON.parse` fails, the mode is 0600, a wrong tenant key
and a wrong master key both throw, a tampered byte throws, and two writes differ.

Every one of those is a "NOT present" assertion, and assertions of that shape pass for free if
the write did nothing, if the markers were never in the input, or if the grep is looking in the
wrong place. So the suite also writes the **same** state through
`plaintextWriteForContrast` — a plain `JSON.stringify` to disk, the mistake this module
prevents — and asserts every marker **is** found and the file **does** parse. If the encrypted
assertions ever go vacuous, that case fails. This is the same discipline the pool canary uses to
prove its taint rule is load-bearing by mutation.

Merge-blocking: it runs in `npm run test:canary`, which CI requires.

**No real session material anywhere.** Synthetic values only, each under 16 characters so the
fixture cannot itself look like a dump to `npm run secret-scan` — a fixture that trips the
secret scanner is a fixture that should not be in the repo.

## What v1 defers, explicitly

**The first three rows below are no longer just deferred — they are decided.**
[ADR-0016](../decisions/ADR-0016-session-key-custody.md) (issue #146) resolves master-key
custody, rotation semantics, and the erasure story; what remains deferred is *implementing* that
decision, not deciding it. The table is left in place because it is still the accurate record of
what v1 shipped without, and the "What must happen before prod" column now points at the ADR
instead of restating the open question.

| Deferred | Why it is safe to defer | What must happen before prod |
| --- | --- | --- |
| **Key custody** — master key comes from `PARAGENT_SESSION_MASTER_KEY`, an env var | Nothing persists session material yet, and no real tenant exists | Decided in [ADR-0016](../decisions/ADR-0016-session-key-custody.md): a KMS-wrapped master. Not yet implemented, and no vendor is picked |
| **Rotation** | No stored artifact to rotate | Decided in [ADR-0016](../decisions/ADR-0016-session-key-custody.md): a **global** `key_epoch` field beside `version` naming the master generation, retired by a batch **re-encryption** job (not a cheap re-wrap — the tenant key is derived, so every file is rewritten), never by lazy-on-read alone |
| **Deletion / tenant offboarding** | No stored artifact | Decided in [ADR-0016](../decisions/ADR-0016-session-key-custody.md): "destroy the tenant's key" is the erasure story, and making that true requires **per-tenant secret material** — a per-tenant erasure secret held only in a KMS-custodied registry and mixed into HKDF, so destroying it makes that tenant's files underivable. Not file deletion, and **not** a non-secret counter: a marker that is readable from the envelope destroys nothing. Strength is bounded by how completely that secret can be destroyed, backups included — an open question in the ADR |
| **An index of what is stored** | One file per call, path chosen by the caller | [ADR-0016](../decisions/ADR-0016-session-key-custody.md) answers the offboarding half with the per-tenant registry above; a full file-path index stays out of scope until a real caller exists to populate one |
| **Memory hygiene beyond the obvious** | Plaintext buffers are zeroed after use, but Node strings are not controllable | Anything stronger needs a different runtime, and is out of proportion to the current threat model. Not addressed by ADR-0016 |

A generated fallback master key is **refused**, not defaulted: it would encrypt successfully and
be unrecoverable on the next process start — a write that looks like it worked over data that is
gone. `MasterKey.generateEphemeral()` exists for tests and local development and is named so it
cannot be mistaken for key management.

## Open questions / what I could not verify

- **Untested against a real `storageState()`.** The shape in `types.ts` is Playwright's as
  documented, but nothing in this repo has produced one, so the round trip has only ever run over
  synthetic fixtures. The first real caller should confirm nothing in the real shape (large
  localStorage blobs, unusual `sameSite` values) breaks the assumption that it is plain JSON.
- **Per-tenant means per `tenant_id` string, and no tenant model exists yet.** If tenancy later
  becomes hierarchical (org → workspace → user), "per-tenant key" needs re-deciding, and the
  `info` string is the place it is pinned — as, now, is the granularity of ADR-0016's per-tenant
  erasure secret, since "erase this tenant" and "erase this workspace" would want rows at
  different levels.
- **The threat model has not been reviewed by anyone outside this repo.** It is written to be
  argued with, and counsel sizing (#36) may change what "at rest" has to mean contractually.
- Whether the envelope should carry an authenticated creation timestamp for staleness checks. It
  does not today; a session's expiry lives inside the encrypted payload, which means answering
  "is this stale?" costs a decryption.
