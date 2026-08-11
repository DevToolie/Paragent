/**
 * Per-tenant key derivation for persisted session material (SC-01, #98).
 *
 * PRD §7 commits to Fork A — the agent rides the customer's own authenticated
 * session — so the day anything persists cookies or storage-state, the product
 * is holding customer session material at rest. Nothing in this repo persists
 * any yet. This module exists so that when something does, there is no
 * unencrypted path available to it.
 *
 * ## The shape of the guarantee
 *
 * `TenantKey` has a **private constructor and private material**, so it cannot
 * be produced by an object literal and cannot be forged structurally. The write
 * function takes one as a required parameter, which makes an unencrypted write
 * a compile error rather than a runtime check — a runtime check is a thing
 * somebody can be in a hurry and skip.
 *
 * ## What never leaves this module
 *
 * Key material. `toJSON`, `toString` and Node's inspect hook are all overridden
 * to a redacted form, so a key caught in a `console.log`, an error dump, or a
 * `JSON.stringify` of some enclosing object prints a label instead of bytes —
 * SC-03 says session material never reaches logs, and a key is exactly that.
 *
 * The **tenant id** also never reaches disk. Files carry `key_id`, an opaque
 * HMAC label: it is enough to tell "wrong key" from "corrupt file" without
 * writing a customer identifier into an artifact somebody may later attach to a
 * bug report (CONTRIBUTING rule 1).
 */

import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { inspect } from "node:util";

/** Environment variable the master key is read from. Never a file in the repo. */
export const MASTER_KEY_ENV = "PARAGENT_SESSION_MASTER_KEY";

/** AES-256 needs 32 bytes; a shorter master key is refused rather than padded. */
export const MASTER_KEY_BYTES = 32;

/** Bytes of `key_id` written into each envelope. Opaque, non-reversible. */
export const KEY_ID_BYTES = 8;

const HKDF_HASH = "sha256";

/** Domain separation: a key derived here can never coincide with one derived elsewhere. */
const HKDF_INFO_PREFIX = "paragent/session-state/v1/tenant=";
const KEY_ID_INFO_PREFIX = "paragent/session-state/v1/key-id/tenant=";

const REDACTED = "[redacted]";

/**
 * No master key configured.
 *
 * Deliberately fatal rather than falling back to a generated one. A generated
 * key would encrypt successfully and then be unrecoverable on the next process
 * start — the write would look like it worked and the data would be gone, which
 * is worse than refusing.
 */
export class MissingMasterKeyError extends Error {
  readonly code = "MISSING_MASTER_KEY" as const;
  constructor(detail: string) {
    super(
      `no usable session master key: ${detail}. Set ${MASTER_KEY_ENV} to ` +
        `${MASTER_KEY_BYTES} random bytes, base64-encoded. Session material is ` +
        "never persisted unencrypted, so this is a refusal, not a fallback.",
    );
    this.name = "MissingMasterKeyError";
  }
}

/**
 * A per-tenant encryption key. Cannot be constructed, only derived.
 *
 * Holding one is the capability to read and write that tenant's persisted
 * session state, and nothing else — it carries no tenant id, no master key, and
 * no way back to either.
 */
export class TenantKey {
  /** Opaque label written into the envelope so a wrong key is named, not guessed. */
  readonly key_id: string;
  readonly #material: Buffer;

  private constructor(material: Buffer, keyId: string) {
    this.#material = material;
    this.key_id = keyId;
  }

  /** @internal Constructed only by `MasterKey.tenantKey`. */
  static create(material: Buffer, keyId: string): TenantKey {
    return new TenantKey(material, keyId);
  }

  /**
   * Run `fn` with the raw key material.
   *
   * The only way out of this class, and deliberately a callback rather than a
   * getter: the bytes are borrowed for one operation instead of handed over to
   * be stored somewhere with a longer life than this call.
   */
  use<T>(fn: (material: Buffer) => T): T {
    return fn(this.#material);
  }

  toJSON(): { key_id: string; material: string } {
    return { key_id: this.key_id, material: REDACTED };
  }

  toString(): string {
    return `TenantKey(key_id=${this.key_id}, material=${REDACTED})`;
  }

  [inspect.custom](): string {
    return this.toString();
  }
}

/**
 * The root secret every tenant key is derived from.
 *
 * v1 reads it from the environment. Key **custody** — a KMS, rotation, an
 * envelope-per-tenant DEK — is explicitly deferred and written down in
 * `docs/privacy/session-state-encryption.md`; what is not deferred is that the
 * derivation is per-tenant, because retrofitting that later means re-encrypting
 * every artifact.
 */
export class MasterKey {
  readonly #bytes: Buffer;

  private constructor(bytes: Buffer) {
    this.#bytes = bytes;
  }

  static fromBytes(bytes: Buffer): MasterKey {
    if (bytes.length !== MASTER_KEY_BYTES) {
      throw new MissingMasterKeyError(
        `expected ${MASTER_KEY_BYTES} bytes, got ${bytes.length}`,
      );
    }
    return new MasterKey(Buffer.from(bytes));
  }

  static fromBase64(encoded: string): MasterKey {
    const trimmed = encoded.trim();
    if (trimmed.length === 0) throw new MissingMasterKeyError("empty value");
    return MasterKey.fromBytes(Buffer.from(trimmed, "base64"));
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): MasterKey {
    const raw = env[MASTER_KEY_ENV];
    if (raw === undefined) throw new MissingMasterKeyError(`${MASTER_KEY_ENV} is unset`);
    return MasterKey.fromBase64(raw);
  }

  /**
   * A fresh random master key.
   *
   * For tests and for local development, and named so that neither can be
   * mistaken for key management. It is not written anywhere: a process that
   * generates one can encrypt and read back within its own lifetime and cannot
   * read anything it wrote in a previous one.
   */
  static generateEphemeral(): MasterKey {
    return new MasterKey(randomBytes(MASTER_KEY_BYTES));
  }

  /**
   * Derive the key for one tenant.
   *
   * HKDF-SHA256 with the tenant id in `info`, so two tenants cannot arrive at
   * the same key and neither can arrive at the master. `salt` is per-file and
   * lives in the envelope, so re-encrypting the same state twice produces
   * different bytes.
   */
  tenantKey(tenantId: string, salt: Buffer): TenantKey {
    if (tenantId.length === 0) {
      throw new MissingMasterKeyError("tenant id must not be empty");
    }
    const material = Buffer.from(
      hkdfSync(
        HKDF_HASH,
        this.#bytes,
        salt,
        `${HKDF_INFO_PREFIX}${tenantId}`,
        MASTER_KEY_BYTES,
      ),
    );
    return TenantKey.create(material, this.keyId(tenantId));
  }

  /**
   * Stable opaque label for a tenant. Salt-independent on purpose: it has to
   * identify the same tenant across files, which the key material must not.
   */
  keyId(tenantId: string): string {
    return createHmac(HKDF_HASH, this.#bytes)
      .update(`${KEY_ID_INFO_PREFIX}${tenantId}`)
      .digest("hex")
      .slice(0, KEY_ID_BYTES * 2);
  }

  toJSON(): { master_key: string } {
    return { master_key: REDACTED };
  }

  toString(): string {
    return `MasterKey(${REDACTED})`;
  }

  [inspect.custom](): string {
    return this.toString();
  }
}

/** Constant-time comparison of two key ids, tolerant of length mismatch. */
export function keyIdsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
