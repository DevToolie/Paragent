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

**Re-verified at the time of writing, not assumed:**
`grep -rn "persistSessionState\|restoreSessionState"` across `src/` and `experiments/` returns
nothing outside `src/session/` itself. A repo-wide search for `storageState()`,
`context.cookies()`, `context.addCookies()` or `launchPersistentContext()` returns hits only in
`src/session/` and in tests: `tests/unit/session-material-tripwire.test.ts` calls
`page.context().addCookies(...)` deliberately, to give the SC-04 tripwire a real cookie to fail
on. **No production code path persists or restores session material.** That is what makes this a
decision made ahead of need rather than under incident pressure — the same ordering #98 used for
per-tenant derivation, because retrofitting derivation after real files exist means re-encrypting
every one of them. Custody has the same property, and Decision 3 below turns out to depend on it
sharply: retrofitting an erasure story after real tenant files exist means either an offboarding
request has nothing to point at, or every existing file has to be re-encrypted to give it one.

**No cloud vendor is decided anywhere in this repo.** Checked `docs/pitch/`, `docs/decisions/`,
`docs/prd/`, and `docs/privacy/` for any prior AWS/GCP/Azure/Vault commitment — grep for
`aws|kms|gcp|azure|vault|hashicorp` across those trees returns only this custody question being
named as deferred, never a vendor being picked. This ADR does not pick one either, and says why
under Decision 1.

**No live KMS, HSM, or cloud account is available in this environment.** Nothing here was tested
against a real custody backend. What follows is a decision about shape, argued from the code that
exists and from each vendor's published documentation of the primitives it offers — cited inline
below, with access dates, rather than asserted. The primitives are read from the docs; they are
not exercised against an account.

## What this ADR must resolve

Four questions, per issue #146, each with a specific answer below:

1. Where the master key lives in prod.
2. What rotation means for an existing envelope.
3. Whether "delete the key" is the erasure story.
4. What local dev keeps.

## What a KMS actually offers, since three of the four answers lean on it

Stated once, up front, because an earlier draft of this ADR assumed a primitive that does not
exist and built Decision 3 on it. Verified against both vendors' current documentation:

| Primitive | AWS KMS | GCP Cloud KMS |
| --- | --- | --- |
| Wrap/unwrap one secret under a key that never leaves the boundary | Yes — `Encrypt`/`Decrypt` against a customer managed key | Yes — `encrypt`/`decrypt` against a key |
| Retain more than one key generation for decrypt after rotation | Yes — rotation keeps prior key material for decrypt | Yes: "Rotating keys creates new active key versions, but doesn't re-encrypt your data and doesn't disable or delete previous key versions" |
| Destroy key material, on a mandatory delay, so what it protected becomes unrecoverable | Yes — scheduled deletion, 7–30 day waiting period (default 30) | Yes — destroy a key version, default 30-day scheduled-for-destruction window, restorable until it elapses |
| **Revoke one individual ciphertext without affecting others** | **No** | **No** |

The last row is the correction. Destruction granularity is the **key or key version, not the
ciphertext**. AWS is explicit: "After a KMS key is deleted, you can no longer decrypt the data
that was encrypted under that KMS key, which means that data becomes unrecoverable", and "If you
delete a symmetric encryption KMS key, all remaining ciphertexts encrypted by that key are
unrecoverable"
([Delete an AWS KMS key](https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys.html)
— access_date: 2026-08-12). GCP is the same shape at key-version granularity: "Destroying a key
version means that the key material is permanently deleted", and data encrypted under a destroyed
version "is considered *crypto-shredded*"
([Destroy and restore key versions](https://docs.cloud.google.com/kms/docs/destroy-restore) —
access_date: 2026-08-12). Version retention across rotation is documented at
[Key rotation](https://docs.cloud.google.com/kms/docs/key-rotation) — access_date: 2026-08-12.

**The consequence that shapes Decision 3:** if erasure granularity equals key-material
granularity, then per-tenant erasure requires per-tenant *secret material*. There is no vendor
primitive that erases one tenant out of a shared key. AWS's own published multi-tenant pattern
takes exactly that route — "a strategy that uses a single customer managed key (symmetric) per
tenant across services", at "$1 monthly" per key
([Simplify multi-tenant encryption with a cost-conscious AWS KMS key strategy](https://aws.amazon.com/blogs/architecture/simplify-multi-tenant-encryption-with-a-cost-conscious-aws-kms-key-strategy/)
— access_date: 2026-08-12). **Read that citation narrowly:** that post argues per-tenant keys for
tenant isolation and cost, and does not discuss erasure or crypto-shredding at all. It is
evidence that per-tenant key material is the normal multi-tenant shape, not evidence that AWS
recommends it as an erasure mechanism.

## Decision 1 — Master-key custody: a KMS-wrapped master

**A cloud KMS holds one CMK per deployment environment, used to wrap and unwrap the same 32-byte
master secret `src/session/keys.ts` already reads from `PARAGENT_SESSION_MASTER_KEY`.** The CMK
itself never leaves the KMS boundary. At process start, the app calls the KMS `Decrypt`
(or equivalent) operation once against a small ciphertext blob — the wrapped master — and holds
the resulting 32 bytes in memory for the process lifetime, exactly as it holds the env-var-sourced
bytes today. **The vendor is left unpicked deliberately** (see Context) — AWS KMS, GCP Cloud KMS,
or an equivalent are all shaped to do this; picking one is an infra decision this repo has not
made anywhere else, and inventing one here would be exactly the kind of speculation issue #146
rules out. What is decided is the *shape* the vendor must satisfy, and it is now the shape the
table above verifies rather than one assumed: wrap/unwrap one secret, retain more than one key
generation for decrypt (Decision 2), and destroy key material on a bounded schedule. It is
explicitly **not** "revoke one wrapped value independently" — no vendor offers that, which is why
Decision 3 does not ask for it.

**What this decision does and does not do to derivation.** It changes where the master's 32 bytes
originate and nothing else: `TenantKey` is still never stored, still re-derived on every read
(`persist.ts`'s `restoreSessionState` calls `master.tenantKey(tenantId, salt)` fresh, it never
loads a saved key), and the master is still the root input. **Decision 3 does change the
derivation** — it adds a second secret input — and argues for that separately. Decision 1 on its
own is a custody move, not a cryptography change; the two are kept apart here because an earlier
draft claimed derivation was untouched while Decision 3 quietly changed it.

### Rejected as the confidentiality mechanism: an independently-wrapped DEK per tenant

The classic KMS envelope pattern — call `GenerateDataKey` once per tenant, store the wrapped
result, unwrap it on each access — was considered because it is the shape issue #146 itself
names as "the obvious shape."

**Why not, for confidentiality:** it throws away the property that makes today's design simple. A
per-tenant HKDF derivation needs no stored state at all — the tenant's key is a function of a
master everyone with prod access already needs, plus a tenant id, plus a salt that already lives
in the file. Reintroducing a per-tenant wrapped DEK means the custody layer must durably store
and index N ciphertexts, one per tenant, and keep that index consistent with the tenant set —
real new state, for a confidentiality guarantee HKDF already provides.

**That rejection holds for confidentiality and does not hold for erasure, and Decision 3 says so
out loud.** The argument above is "HKDF gives you the same confidentiality with no per-tenant
state." It is not "no per-tenant state is ever needed," and the erasure requirement turns out to
need some: see Decision 3, which reverses the *stored-state* half of this rejection on purpose,
adopts a narrower shape than a full wrapped DEK, and gives a security reason for preferring that
narrower shape rather than treating it as a lesser evil.

### Rejected: a self-hosted HSM or secrets manager (e.g. Vault)

Considered because it removes a cloud-vendor dependency entirely. Rejected because it substitutes
an operational burden (running and patching an HSM/Vault cluster, its own access-control and
audit story, its own on-call) for a managed one, with no offsetting benefit named anywhere in this
repo — there is no stated preference for self-hosted infrastructure over managed cloud services
outside the test-bed, and the test-bed's reason (ADR-0003 wants to measure churn survival without
a design partner or third-party SaaS ToS) does not apply to infrastructure the product itself
operates.

### Rejected: an age-style offline asymmetric key

Considered for its simplicity (a keypair, the public half encrypts, the private half — held
offline — decrypts). Rejected for a live decrypting service specifically: every read needs the
private half available to decrypt, so "held offline" either means an operator is in the loop on
every session-state read (unworkable for anything that runs unattended) or the private key ends
up loaded into the same process as today, which is a KMS with extra steps and none of a managed
KMS's audit trail or version retention. It stays a reasonable shape for a one-off backup or an
air-gapped export, which is not the problem this ADR is solving.

## Decision 2 — Rotation: a global master epoch beside the version byte, retired by a batch job

**The envelope gains a `key_epoch` field beside `version`** (the field, not necessarily its exact
byte width — that is an implementation detail for whoever lands this). `version` keeps meaning
"how this envelope is laid out"; `key_epoch` means "which generation of the **master** produced
this."

**`key_epoch` is global, not per-tenant.** Pinned explicitly, because an earlier draft used the
word "epoch" for both a master generation and a per-tenant erasure marker and left the envelope
byte ambiguous between them. One deployment has one live master generation at a time; every
tenant's files written in that window carry the same `key_epoch`. A master rotation bumps it once,
globally, and does not touch anything per-tenant. The per-tenant erasure mechanism in Decision 3
is a **separate** piece of state with a separate name, is **not** an epoch, and is deliberately
**not** carried in the envelope — which is the whole reason it can be secret. Two concerns, two
names, no overloading:

| Concern | Name | Scope | Secret? | In the envelope? |
| --- | --- | --- | --- | --- |
| Which master generation wrote this file | `key_epoch` | Global, per deployment | No — it is a selector | Yes, it has to be readable |
| Whether this tenant's material still exists | tenant erasure secret (Decision 3) | Per tenant | **Yes** | **No, never** |

**The primary rotation mechanism is a batch re-encrypt job, not lazy re-encryption on read.**
Lazy re-encryption — rewrite a file under the new epoch the next time something happens to read
it — was considered because it touches only files that are actually accessed, which is cheap. It
is rejected as the *sole* mechanism because it depends on reads happening, and this repo's own
re-verified fact above is that nothing reads these files today. A rotation strategy whose
completion depends on organic reads is a rotation strategy that may never finish, which is the
opposite of what "rotate after a suspected exposure" needs. A batch job that walks stored files
and rewrites them under the new epoch is the mechanism that can be declared complete. Lazy
re-encryption on read may still run alongside it as an accelerant — every read during the grace
window shrinks what the batch job has left to do — but it is never trusted alone.

**It is re-encryption, not re-wrapping, and that matters for sizing.** Because the tenant key is
derived from the master (Decision 1) rather than stored, a master rotation changes every tenant
key, so every file must be decrypted and re-encrypted under a newly derived key. It is not the
cheap case of rewrapping one small master ciphertext while the data keys stay put. Whoever sizes
the grace window is sizing a full read-modify-write pass over all stored session material, and
this ADR uses "re-encrypt" throughout to stop that being read as the cheaper operation.

**The grace window is what the KMS retains.** Both vendors keep prior key material available for
decrypt after rotation unless it is explicitly destroyed (see the table above), so the grace
window is a policy choice about when to destroy the prior generation, not a race against
automatic expiry.

**A reader given an epoch it cannot resolve fails closed.** If `key_epoch` on a file is older than
what custody currently retains, the reader throws a new, distinct error — provisionally
`SessionKeyRetiredError`, parallel to today's `SessionDecryptionError` — rather than falling back
to the current epoch or guessing. This is the same posture ADR-0013 took for a partial cache hit:
a boundary the code cannot resolve is reported as failure, not silently reconciled.

**Destroying a master epoch is real cryptographic erasure, at global granularity, and is not an
offboarding mechanism.** It is worth stating because it is the one erasure this rotation
mechanism does buy: destroying the prior generation's key material in the KMS makes every file
still carrying that epoch permanently unreadable, for every tenant at once. That is an incident
response ("the previous master may have leaked"), or an end-of-deployment wipe. It is an outage,
not an offboarding, so Decision 3 does not use it for single-tenant erasure.

## Decision 3 — Erasure: per-tenant erasure needs per-tenant secret material, so add exactly one

**Yes — key destruction is the offboarding mechanism, not finding and deleting files**, for
exactly the reason the issue gives: verifying that N files were found and removed is strictly
harder than verifying that a key no longer exists, and the second is what a tenant erasure
commitment actually needs to be answerable under audit.

**But a non-secret marker cannot destroy a derived key, and this ADR previously claimed it
could.** Recorded here rather than quietly fixed, because the failure mode is instructive.
`keys.ts` makes `TenantKey` a deterministic function of `(master, tenantId, salt)`. Adding a
per-tenant counter makes it a function of `(master, tenantId, salt, counter)` — and every one of
those inputs survives any "retirement" that only writes a row in a table: the master is untouched
by construction, the tenant id is known to whoever is asking, the salt is in the envelope header
so a reader can re-derive, and the counter would have to be in the envelope header too, for the
same reason. Nothing has been destroyed; a database row now says not to. That is a runtime policy
check, and this module's founding principle is that a runtime check is a thing somebody in a hurry
can skip. It is also the exact failure `keys.ts` already refuses in the master case — a generated
fallback master "would encrypt successfully and then be unrecoverable on the next process start —
the write would look like it worked and the data would be gone." A deletion that looks like it
worked and did not is the same lie pointed the other way.

**The vendor evidence lands in the same place** (see the primitives table above): destruction
granularity is the key or key version, never the individual ciphertext. There is no primitive
anywhere that erases one tenant out of material shared with other tenants. So the requirement is
not a mechanism choice, it is an identity: **per-tenant cryptographic erasure requires per-tenant
secret material that can be destroyed.**

### Decision: one per-tenant erasure secret, held only in a KMS-custodied registry

**A durable registry holds one row per tenant: `tenant_id → (erasure_secret, state)`**, where
`erasure_secret` is 32 random bytes minted at tenant onboarding, stored wrapped under the same CMK
as the master (Decision 1), and `state` is live or erased. The secret is **not derivable from
`(master, tenantId)`** — that is the entire point, and it is what distinguishes it from today's
HKDF `info` string, which is just the tenant id in a prefix and is therefore reconstructible by
anyone holding the master.

**Derivation becomes HKDF over both secrets.** Today `tenantKey()` extracts from the master alone;
under this decision it extracts from the master **concatenated with the tenant's erasure secret**,
keeping the existing per-file `salt` and the existing `info` domain separation exactly as they
are. The tenant's key is then a function of two independent secrets, and destroying either makes
it unrecoverable. `info` keeps doing domain separation, `salt` keeps making repeat writes differ,
and neither is asked to be secret — which is right, since both are public.

**Offboarding is destroying that tenant's erasure secret**, and only that: every envelope ever
written for that tenant becomes underivable, the master is untouched, and no other tenant's row is
read or written. This is the erasure the previous draft promised and did not deliver, and it costs
one secret column per tenant.

### Why this shape and not the two neighbours

**Not a per-tenant wrapped DEK** (Decision 1's rejected shape, in its full form). Both shapes cost
the same per-tenant state, so "extra state" is not the discriminator — the discriminator is what a
single compromise yields. A wrapped DEK *is* the tenant's key: whoever can unwrap it can decrypt
that tenant's files, and the master is irrelevant. An erasure secret is only half the input:
someone who exfiltrates the entire registry still has nothing without the KMS-custodied master,
and someone who has the master still has nothing for a tenant whose row is gone. Requiring both
is strictly stronger than requiring either, for the same storage cost. It also composes with the
derivation that already exists rather than replacing it — HKDF, the per-file salt, the `info`
domain separation, `key_id`, and the envelope all keep working as designed, with one new secret
input.

**Not one KMS key per tenant** (the AWS blog shape cited above). It is the most rigorous option —
destruction lives inside the KMS boundary, with a documented mandatory waiting period and an audit
trail, rather than depending on this repo deleting a row properly. It is rejected *for now* on
three grounds: it requires the vendor decision this ADR deliberately does not make, since key
quotas, per-key cost and the deletion API differ enough between vendors to matter; it puts a
recurring per-tenant infrastructure cost and a per-region key quota in the path of onboarding a
tenant, which is a product constraint this repo has no basis to accept before it has a single
tenant; and it is not foreclosed by this decision. **The registry row is the seam:** if the
per-tenant secret later becomes a reference to a per-tenant KMS key instead of wrapped bytes, the
derivation contract above ("resolve the tenant's secret material or refuse") does not change, and
no stored file has to be re-encrypted. This ADR picks the shape that keeps that upgrade cheap.

### What this actually buys, stated exactly

This is cryptographic erasure **to the extent the erasure secret is genuinely destroyed
everywhere it exists**, and no further. Specifically:

- **The registry is a secret store, not a metadata table.** It holds material as security-critical
  as the master, so it inherits the master's handling: wrapped at rest under the CMK, never
  logged, never in a bug report. The previous draft described "one small row per tenant, an epoch
  counter and a retirement marker" as a cheap addition. It is not cheap in the way that implied.
- **The datastore must support real destruction, not just a `DELETE`.** Backups, replicas,
  write-ahead logs, and snapshots taken while the tenant was live all potentially contain the
  secret, and a row deleted from the primary is not erased from those. Choosing a datastore that
  cannot destroy a secret across its own backup set would silently reduce this back to a policy
  promise. This is a hard requirement on that choice, and it is called out again under Open
  questions because it is now the load-bearing uncertainty in this decision.
- **Erasure is forward-looking.** Anyone who captured the master *and* that tenant's secret while
  the tenant was live can still decrypt files they also captured. That is true of every
  crypto-shredding scheme including KMS key deletion, and it is not a reason to prefer something
  weaker — but an erasure commitment should not be worded as though it reaches backwards.
- **A retired tenant's files stay identifiable, and only stop being readable.** `key_id` is
  `HMAC(master, "…/key-id/tenant=<id>")` and does not take the erasure secret as an input, on
  purpose: it must keep labelling files across the tenant's lifetime so a sweep job can find them
  after erasure. So "erased" means undecryptable, not unfindable, and `key_id` remains
  recomputable by whoever holds the master. That leaks nothing about the tenant beyond what an
  HMAC under a secret master already conceals — it is not the tenant id — but the claim to make is
  "the bytes cannot be read", not "the file cannot be attributed".

**Carried forward as a constraint on the eventual implementation, not decided here:** the
compile-time guarantee in `store.ts` — an unencrypted write cannot be expressed, only refused at
compile time — has to survive this change. Whoever lands the registry should make resolution of
the tenant's secret a required step in constructing a `TenantKey`, the same way `TenantKey.create`
and `MasterKey`'s private constructors already make key material unconstructable by object
literal. The resolver should be a type that either returns the tenant's live material or throws,
so an erased tenant is a value that cannot be produced rather than a check a caller can forget.

## Decision 4 — What local dev and CI keep: exactly what they have today

**`MasterKey.generateEphemeral()` and `PARAGENT_SESSION_MASTER_KEY` stay, and stay the only path
dev and CI ever need.** Neither environment holds real tenant material (dev: a developer's own
fixtures; CI: synthetic canary values only, per
`docs/privacy/session-state-encryption.md`'s threat-model table), so neither needs rotation,
offboarding, a KMS credential, or the registry Decision 3 adds — those exist to answer questions
("has this tenant been erased," "has this key been rotated since a suspected exposure") that
presuppose a real tenant, which local dev and CI do not have. **This is decided explicitly so it
cannot drift later**: nobody should "upgrade" the fixture or test path to depend on a KMS
credential, because that would make `npm run test:canary` and local development require
infrastructure that does not exist yet and has no reason to.

**The one thing Decision 3 does change here**: since derivation now takes a second secret input,
the ephemeral path has to supply one. It mints a random per-process erasure secret alongside the
ephemeral master and has no registry and no concept of retirement — a process that exits when the
test does has no tenant to offboard. Crucially, it satisfies the **same** resolver type the prod
path does, so dev is not a second, laxer way to construct a `TenantKey`; it is the same door with
a different, process-local source behind it. `key_epoch` stays `0` in dev for the same reason:
there is nothing to rotate away from.

## Consequences

**Nothing in `src/session/` changes today.** This ADR decides a shape — a KMS-wrapped master
(Decision 1), a global `key_epoch` field and a batch-driven re-encryption mechanism (Decision 2),
a per-tenant erasure secret that makes "destroy the key" true rather than promised (Decision 3),
and an explicit floor under what dev/CI must never need (Decision 4) — implementing any of it is
new issues, filed against this ADR, not this PR.

**The envelope format change is more expensive than "bump the constant."** Adding `key_epoch`
beside `version` means `ENVELOPE_VERSION` bumps, and two things in `store.ts` make an old file
unreadable to a new build even in principle: `parseEnvelope` throws `SessionEnvelopeError` on any
version that is not exactly `ENVELOPE_VERSION`, and `additionalData()` binds the **module
constant** `ENVELOPE_VERSION` into the GCM AAD. So relaxing the parser alone is not enough — a v2
build reading a v1 file would compute AAD over `2` where the file was sealed under `1`, and fail
the tag. Reading old files requires `additionalData()` to use the *parsed* version, which is a
deliberate change to what the AAD commits to, not a default. That cost is real but currently
zero-impact: nothing has written a v1 file outside tests, which is the argument for landing the
format change before a caller exists rather than after.

**Derivation must be settled before the first caller, not after.** This is the sharpest
consequence. Adding the per-tenant erasure secret to derivation once real files exist means
re-encrypting all of them — the exact retrofit #98 restructured SC-01 to avoid for per-tenant
derivation. Deciding erasure at the same time as custody is what keeps that door cheap.

**The registry is a new security-critical store**, not a bookkeeping table (Decision 3). Whoever
lands it inherits a secret store's handling requirements and a destruction requirement its
datastore must actually be able to meet.

**`key_id` is master-scoped, so a master rotation changes it.** `keyId()` is an HMAC under the
master, so the same tenant's `key_id` differs across epochs. The batch job in Decision 2 must
therefore resolve the master by the file's `key_epoch` *before* comparing `key_id`, and a file's
label changes when it is re-encrypted under a new epoch. That is consistent, but it is a
sequencing constraint the implementation cannot discover late.

**The "index of what is stored" question splits, and only half of it is answered here.** The
issue names an index as a prerequisite for offboarding. This ADR's position is that offboarding
needs the *per-tenant registry* (Decision 3) and not a file index, because erasure is answered by
"the secret is gone", not by "here is every file". A full index of *file paths* is explicitly left
out of scope: `persist.ts`'s `filePath` is caller-supplied, nothing calls it yet, so there is no
caller to own populating a path index and nothing to populate it with. The first real caller of
`persistSessionState` inherits that open question, not this ADR — noted again below.

**This does not become buildable until there is a caller and a chosen deployment target.** Both
are named prerequisites, not commitments made here: PRD phase 1's persisted-profile caller (which
is the event this ADR is timed ahead of, per Context) and a cloud target this repo has not picked
anywhere yet (Decision 1).

## Reversal cost

**Low for the decision itself, high for Decision 3 once implemented.** Nothing here has shipped,
so reversing today costs nothing. Once real files exist the three decisions separate sharply:

- **Decision 1 (KMS vs. env var) is cheapest.** It only changes where 32 bytes come from, and
  nothing about the derivation or envelope format downstream of it.
- **Decision 2 (the epoch field) is medium.** Reversing means either accepting that files carry an
  epoch nothing reads anymore, or running a migration to strip it — the same one-way-door shape
  ADR-0013 flagged for its own schema addition.
- **Decision 3 (the erasure secret) is a genuine one-way door**, and this is the honest cost of
  choosing it. It is an input to key derivation, so both adding it later and removing it later
  require decrypting and re-encrypting every stored file. Choosing it now is choosing to pay that
  cost while the file count is zero. The mitigation is the seam named in Decision 3: *what* backs
  the per-tenant secret (registry bytes vs. a per-tenant KMS key) can change later without
  re-encrypting anything, because only the resolver changes, not the derivation contract.

## Open questions / what I could not verify

- **Whether the registry's datastore can actually destroy a secret, backups included.** This is
  now the load-bearing question for Decision 3, because it is the difference between cryptographic
  erasure and a policy promise dressed as one. A row deleted from a primary is not erased from
  snapshots, replicas, or a write-ahead log, and no datastore has been chosen here to evaluate
  against. Whoever picks it has to answer this before the erasure commitment can be worded as
  cryptographic — and if the answer is no, the honest fallbacks are the per-tenant KMS key shape
  (which moves destruction inside a boundary with a documented waiting period) or wording the
  commitment as policy-enforced. This ADR picks the shape; it does not get to declare the
  guarantee met.
- **Nothing here was exercised against a real KMS, HSM, or secrets manager.** No account or
  credentials for one are available in this environment, per the scoping for this issue. The
  primitives in the table above are cited from each vendor's current documentation with access
  dates, which is a stronger footing than the previous draft's unsourced assertion — but reading a
  doc is not the same as running the API, and neither vendor's behaviour was observed.
- **Rotating a tenant's erasure secret, as opposed to destroying it, is not decided.** Retirement
  is one-way and needs no selector. Rotating a live tenant's secret would need a per-tenant
  generation marker in the envelope so a reader knows which secret a file was written under — a
  second selector beside `key_epoch`, deliberately not added here because no requirement for it
  exists yet. Adding it after files exist is another re-encryption pass, so it belongs on the same
  agenda as the implementation issue rather than being discovered later.
- **The exact rotation grace-window duration is not decided.** It needs to be long enough for the
  batch re-encryption job in Decision 2 to complete against however much session material exists
  at rotation time — a number that does not exist yet because nothing is stored yet. Both vendors'
  own destruction delays (7–30 days AWS, default 30 days GCP, per the citations above) are a floor
  on how quickly a destroyed epoch actually becomes unreadable, not a substitute for sizing this.
- **The file-path index is explicitly not designed here**, per Consequences above. Whether it
  should exist at all — versus the registry being sufficient for every real question ("has this
  tenant's material been erased," not "list every file") — is a decision for whoever builds the
  first real caller, informed by what the caller's own operational needs turn out to be.
- **This ADR has not been reviewed by anyone outside this repo**, the same caveat
  `session-state-encryption.md` carries for the threat model it is built on. Counsel sizing (#36)
  may change what an erasure commitment has to mean contractually — in particular whether
  "forward-looking crypto-shredding" satisfies a deletion obligation, which is a legal question
  this ADR cannot answer and should not assume.
- **Whether `storageState()`'s real shape breaks anything this custody model assumes.** Unrelated
  to custody specifically, but worth restating rather than letting it quietly drop: per
  `session-state-encryption.md`, the round trip has only ever run over synthetic fixtures, and
  this ADR does not change that — it is explicitly out of scope here, per issue #146, until a real
  caller exists.
