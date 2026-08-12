---
title: "ADR-0016 — Session-key custody: master-key custody, rotation, and erasure"
doc_type: adr
status: accepted
owner: B5
created: 2026-08-12
updated: 2026-08-12
confidence: MED
supersedes: null
sources_verified: true
---

# ADR-0016 — Session-key custody: master-key custody, rotation, and erasure

## Status

accepted

## Context

**Triggered by:** issue #146. This is a decision document, not a code change — it decides a
shape; it does not implement one.

[#98](https://github.com/DevToolie/Paragent/issues/98) (merged in #143) closed SC-01's
*mechanism* half: `src/session/` derives a per-tenant `TenantKey` from one master key via
HKDF-SHA256 (`keys.ts`), writes it as an AES-256-GCM envelope with an opaque `key_id` instead of
the tenant id (`store.ts`), and the pair callers actually use (`persist.ts`) never lets an
unencrypted write compile — `writeEncryptedStorageState` requires a `TenantKey`, and `TenantKey`
has a private constructor and private material, so an object literal cannot forge one. What #98
deliberately deferred is **custody**, recorded in
[`docs/privacy/session-state-encryption.md`](../privacy/session-state-encryption.md)'s "What v1
defers" table:

| Deferred | Current state |
| --- | --- |
| Master-key custody | `PARAGENT_SESSION_MASTER_KEY`, an env var |
| Rotation | `version` byte and nothing else |
| Tenant offboarding / erasure | Nothing — one file per call, path chosen by the caller |
| An index of what is stored | None |

**Re-verified at the time of writing, not assumed:** `grep -rn "persistSessionState\|restoreSessionState"` across `src/` and `experiments/` returns
nothing outside `src/session/` itself, and a repo-wide search for `storageState()`,
`context.cookies()`, `context.addCookies()` or `launchPersistentContext()` still returns nothing
outside `src/session/`'s own tests. Exposure is still genuinely zero. That is what makes this a
decision made ahead of need rather than under incident pressure — the same ordering #98 used for
per-tenant derivation, because retrofitting derivation after real files exist means re-encrypting
every one of them. Custody has the same property: retrofitting an erasure story after real tenant
files exist means an offboarding request has nothing to point at.

**No cloud vendor is decided anywhere in this repo.** Checked `docs/pitch/`, `docs/decisions/`,
`docs/prd/`, and `docs/privacy/` for any prior AWS/GCP/Azure/Vault commitment — grep for
`aws|kms|gcp|azure|vault|hashicorp` across those trees returns only this custody question being
named as deferred, never a vendor being picked. This ADR does not pick one either, and says why
under Decision 1.

**No live KMS, HSM, or cloud account is available in this environment.** Nothing here was tested
against a real custody backend. What follows is a decision about shape, argued from the code that
exists and from KMS envelope-encryption patterns generically (AWS KMS and GCP Cloud KMS both
support the primitives this decision needs: wrap/unwrap a value, retain more than one key version
for decrypt, and revoke a specific wrapped value without affecting others); it is not a build, and
building it against a real vendor is explicitly out of scope here.

## What this ADR must resolve

Four questions, per issue #146, each with a specific answer below:

1. Where the master key lives in prod.
2. What rotation means for an existing envelope.
3. Whether "delete the key" is the erasure story.
4. What local dev keeps.

## Decision 1 — Master-key custody: a KMS-wrapped master, HKDF derivation unchanged

**A cloud KMS holds one CMK per deployment environment, used to wrap and unwrap the same 32-byte
master secret `src/session/keys.ts` already reads from `PARAGENT_SESSION_MASTER_KEY`.** The CMK
itself never leaves the KMS boundary. At process start, the app calls the KMS `Decrypt`
(or equivalent) operation once against a small ciphertext blob — the wrapped master — and holds
the resulting 32 bytes in memory for the process lifetime, exactly as it holds the env-var-sourced
bytes today. **The vendor is left unpicked deliberately** (see Context) — AWS KMS, GCP Cloud KMS,
or an equivalent are all shaped to do this; picking one is an infra decision this repo has not
made anywhere else, and inventing one here would be exactly the kind of speculation issue #146
rules out. What is decided is the *shape* the vendor must satisfy: wrap/unwrap one secret, retain
more than one key version for decrypt (Decision 2), and support revoking a specific wrapped value
without touching another (Decision 3).

**The per-tenant HKDF derivation in `keys.ts` — `tenantKey(tenantId, salt)` — does not change.**
The issue is explicit that this is a custody question, not a cryptography one, and the code
backs that framing: `TenantKey` is never itself stored. It is a deterministic function of
`(master, tenantId, salt)`, re-derived on every read (`persist.ts`'s `restoreSessionState` calls
`master.tenantKey(tenantId, salt)` fresh, it never loads a saved key). Moving custody of the
*master* into a KMS changes where those 32 bytes originate; it does not touch the function that
turns them into a tenant's key.

### Rejected: an independently-generated, individually-wrapped DEK per tenant

The classic KMS envelope pattern — call `GenerateDataKey` once per tenant, store the wrapped
result, unwrap it on each access — was considered because it is the shape issue #146 itself
names as "the obvious shape." Rejected as the *confidentiality* mechanism, kept as a partial
answer under Decision 3.

**Why not, here:** it throws away the property that makes today's design simple. A per-tenant
HKDF derivation needs no stored state at all — the tenant's key is a function of a master
everyone with prod access already needs, plus a tenant id, plus a salt that already lives in the
file. Reintroducing a per-tenant wrapped DEK means the custody layer must now durably store and
index N ciphertexts, one per tenant, and keep that index consistent with the tenant set — real
new state, for a confidentiality guarantee HKDF already provides. That trade is worth taking for
the narrower problem Decision 3 actually has (revoking one tenant without touching another), not
for confidentiality in general.

### Rejected: a self-hosted HSM or secrets manager (e.g. Vault)

Considered because it removes a cloud-vendor dependency entirely. Rejected because it substitutes
an operational burden (running and patching an HSM/Vault cluster, its own access-control and
audit story, its own on-call) for a managed one, with no offsetting benefit named anywhere in this
repo — there is no stated preference for self-hosted infrastructure over managed cloud services
outside the test-bed, and the test-bed's reason (ADR-0003: "no partner or third-party SaaS ToS")
does not apply to infrastructure the product itself operates.

### Rejected: an age-style offline asymmetric key

Considered for its simplicity (a keypair, the public half encrypts, the private half — held
offline — decrypts). Rejected for a live decrypting service specifically: every read needs the
private half available to decrypt, so "held offline" either means an operator is in the loop on
every session-state read (unworkable for anything that runs unattended) or the private key ends
up loaded into the same process as today, which is a KMS with extra steps and none of a managed
KMS's audit trail or version retention. It stays a reasonable shape for a one-off backup or an
air-gapped export, which is not the problem this ADR is solving.

## Decision 2 — Rotation: an epoch beside the version byte, retired by a batch job

**The envelope gains a `key_epoch` field beside `version`** (the field, not necessarily its exact
byte width — that is an implementation detail for whoever lands this). `version` keeps meaning
"how this envelope is laid out"; `key_epoch` means "which generation of the master produced this."
A rotation event mints a new epoch; new writes carry it. KMS retains the ability to decrypt the
*previous* epoch's wrapped master for a bounded grace window — how long is an implementation
decision for the follow-up issue, sized to how long the batch job below takes, not fixed here.

**The primary rotation mechanism is a batch re-wrap job, not lazy re-wrap on read.** Lazy re-wrap
— re-encrypt a file under the new epoch the next time something happens to read it — was
considered because it touches only files that are actually accessed, which is cheap. It is
rejected as the *sole* mechanism because it depends on reads happening, and this repo's own
re-verified fact above is that nothing reads these files today. A rotation strategy whose
completion depends on organic reads is a rotation strategy that may never finish, which is the
opposite of what "rotate after a suspected exposure" needs. A batch job that walks the (Decision
3) tenant registry and re-wraps everything under the new epoch is the mechanism that can be
declared complete. Lazy re-wrap-on-read may still run alongside it as an accelerant — every read
during the grace window shrinks what the batch job has left to do — but it is never trusted alone.

**A reader given an epoch it cannot resolve fails closed.** If `key_epoch` on a file is older than
what custody currently retains, the reader throws a new, distinct error — provisionally
`SessionKeyRetiredError`, parallel to today's `SessionDecryptionError` — rather than falling back
to the current epoch or guessing. This is the same posture ADR-0013 took for a partial cache hit:
a boundary the code cannot resolve is reported as failure, not silently reconciled. It is also
what makes retirement double as the erasure primitive in Decision 3 — a retired epoch has to
actually stop working, not "stop working unless someone forgot to check."

## Decision 3 — Erasure: "destroy the key" is the story, and it needs one new piece of state

**Yes — key destruction is the offboarding mechanism, not finding and deleting files**, for
exactly the reason the issue gives: verifying that N files were found and removed is strictly
harder than verifying that a key no longer exists, and the second is what a tenant erasure
commitment actually needs to be answerable under audit.

**But this does not fall out of the current design for free, and the ADR should say so rather
than claim otherwise.** `TenantKey` is not independently held material — `keys.ts` shows it is a
pure function of `(master, tenantId, salt)`. As long as the master exists and the tenant id is
known, that function can always be recomputed; there is nothing at the tenant granularity to
destroy. Destroying the *master* would erase every tenant at once, which is not an offboarding
mechanism, it is an outage.

**Decision: a durable, KMS-custodied per-tenant epoch registry** — `tenant_id → current_epoch`,
plus retired epochs kept only long enough to satisfy Decision 2's rotation grace window — is the
one piece of new state this needs. `tenantKey()`'s derivation is scoped by the tenant's *live*
epoch from this registry, not by a value the caller supplies unchecked. Offboarding a tenant is
retiring that tenant's registry row and never advancing it again: every envelope written under
that tenant's retired epoch becomes permanently underivable, without touching the master or any
other tenant's row.

**This is not the per-tenant DEK-per-resource pattern rejected in Decision 1.** The registry holds
one small row per tenant — an epoch counter and a retirement marker — not a wrapped key blob per
tenant. It exists because Decision 2 already needs *a* place to track live vs. retired epochs;
Decision 3 is the observation that offboarding is a special case of that same mechanism (retire
one tenant's epoch and stop), not a second system. Rotation therefore gets exercised, and proven
to actually retire access, by ordinary key hygiene long before it is ever called on for something
as high-stakes as an erasure commitment — the same reason the canary in
`tests/canary/session-plaintext.test.ts` runs a plaintext counter-case rather than trusting the
encrypted assertions alone.

**Carried forward as a constraint on the eventual implementation, not decided here:** the
compile-time guarantee in `store.ts` — an unencrypted write cannot be expressed, only refused at
compile time — has to survive this change. Whoever lands the registry should make epoch resolution
a required part of constructing a `TenantKey`, the same way `TenantKey.create` and `MasterKey`'s
private constructors already make key material unconstructable by object literal, so a caller
cannot bypass the registry check the way a runtime `if` could be skipped.

## Decision 4 — What local dev and CI keep: exactly what they have today

**`MasterKey.generateEphemeral()` and `PARAGENT_SESSION_MASTER_KEY` stay, unmodified, and stay the
only path dev and CI ever need.** Neither environment holds real tenant material (dev: a
developer's own fixtures; CI: synthetic canary values only, per
`docs/privacy/session-state-encryption.md`'s threat-model table), so neither needs rotation,
offboarding, or the epoch registry Decision 3 adds — those exist to answer questions ("has this
tenant been erased," "has this key been rotated since a suspected exposure") that presuppose a
real tenant, which local dev and CI do not have. **This is decided explicitly so it cannot drift
later**: nobody should "upgrade" the fixture or test path to depend on a KMS credential, because
that would make `npm run test:canary` and local development require infrastructure that does not
exist yet and has no reason to. The registry and the epoch field are prod-only concepts; a
`MasterKey.generateEphemeral()` process can stay exactly as ignorant of both as it is today —
epoch `0`, no registry lookup, because there is no tenant to offboard from a process that exits
when the test does.

## Consequences

**Nothing in `src/session/` changes today.** This ADR decides a shape — a KMS-wrapped master
(Decision 1), a `key_epoch` field and a batch-driven rotation mechanism (Decision 2), a per-tenant
epoch registry that makes "destroy the key" real (Decision 3), and an explicit floor under what
dev/CI must never need (Decision 4) — implementing any of it is new issues, filed against this
ADR, not this PR.

**The envelope format gains a field.** `key_epoch` beside `version` is a binary-layout change,
which means `ENVELOPE_VERSION` bumps when it lands. Files written under the current version 1
carry no epoch; the implementation issue needs to decide how a reader treats an absent epoch on an
old file (the natural answer is "epoch 0, always resolvable," since nothing has shipped a registry
yet to retire it from — but that is an implementation decision, not fixed here).

**The "index of what is stored" question splits, and only half of it is answered here.** The
issue names an index as a prerequisite for offboarding. This ADR's position is that the
prerequisite is the *tenant epoch registry* (Decision 3), which is small — one row per tenant —
and is already required by rotation regardless of offboarding. A full index of *file paths* is
explicitly left out of scope: `persist.ts`'s `filePath` is caller-supplied, nothing calls it yet,
so there is no caller to own populating a path index and nothing to populate it with. The first
real caller of `persistSessionState` inherits that open question, not this ADR — noted again
below.

**This does not become buildable until there is a caller and a chosen deployment target.** Both
are named prerequisites, not commitments made here: PRD phase 1's persisted-profile caller (which
is the event this ADR is timed ahead of, per Context) and a cloud target this repo has not picked
anywhere yet (Decision 1).

## Reversal cost

**Low for the decision itself, medium once implemented.** Nothing here has shipped, so reversing
the decision costs nothing today. Once the epoch field and registry exist, reversing Decision 2/3
specifically would mean either accepting that already-rotated files carry an epoch nothing reads
anymore, or running a second migration to strip it — the same one-way-door shape ADR-0013 flagged
for its own schema addition. Decision 1 (KMS vs. env var) is the cheapest to reverse in isolation,
since it only changes where 32 bytes come from and nothing about the derivation or envelope format
downstream of it.

## Open questions / what I could not verify

- **Nothing here was tested against a real KMS, HSM, or secrets manager.** No account or
  credentials for one are available in this environment, per the scoping for this issue. The
  shape argued for — wrap/unwrap a value, retain more than one key version, revoke one wrapped
  value independently — is a real primitive on both AWS KMS and GCP Cloud KMS as documented by
  each vendor, but this ADR does not verify that against either vendor's actual API, and does not
  pick one.
- **The exact rotation grace-window duration is not decided.** It needs to be long enough for the
  batch job in Decision 2 to complete against however much session material exists at rotation
  time — a number that does not exist yet because nothing is stored yet. Sizing it is the
  implementation issue's job, informed by real file counts once there is a caller.
- **Whether the per-tenant epoch registry itself needs its own durability/backup story beyond
  "whatever the KMS or the datastore holding it already provides."** It is small (one row per
  tenant) but it is now load-bearing for erasure — losing a registry row without the corresponding
  retirement having actually happened would silently make a tenant's files unreadable for the
  wrong reason (registry loss, not a deliberate offboarding), which is a distinct failure mode from
  anything this ADR analyzes.
- **The file-path index is explicitly not designed here**, per Consequences above. Whether it
  should exist at all — versus the epoch registry being sufficient for every real question
  ("has this tenant's material been erased," not "list every file") — is a decision for whoever
  builds the first real caller, informed by what the caller's own operational needs turn out to
  be.
- **This ADR has not been reviewed by anyone outside this repo**, the same caveat
  `session-state-encryption.md` carries for the threat model it is built on. Counsel sizing (#36)
  may change what an erasure commitment has to mean contractually, which could change how much
  the grace window in Decision 2 is allowed to be.
- **Whether `storageState()`'s real shape breaks anything this custody model assumes.** Unrelated
  to custody specifically, but worth restating rather than letting it quietly drop: per
  `session-state-encryption.md`, the round trip has only ever run over synthetic fixtures, and
  this ADR does not change that — it is explicitly out of scope here, per issue #146, until a real
  caller exists.
