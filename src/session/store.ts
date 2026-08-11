/**
 * Encrypted-at-rest persistence for browser session state (SC-01, #98).
 *
 * There is exactly one write function, it requires a `TenantKey`, and there is
 * no unencrypted sibling. That is the whole design: the guarantee is that a
 * plaintext write is **not expressible**, rather than that nobody has performed
 * one yet.
 *
 * ## The envelope
 *
 * A binary file, not JSON:
 *
 * ```text
 * magic "PGSS" | version u8 | key_id 8B | salt 16B | iv 12B | tag 16B | ciphertext
 * ```
 *
 * Binary because the canary greps the bytes on disk and asserts `JSON.parse`
 * **fails**. A JSON envelope wrapping a base64 blob would parse, and a check
 * that a file is unreadable is worth more when the file is not shaped like the
 * thing it is protecting.
 *
 * `key_id` is an opaque HMAC label, never the tenant id: the file must not name
 * a customer (CONTRIBUTING rule 1). It is bound in as AES-GCM additional
 * authenticated data, so a file cannot be relabelled for another key without
 * failing the tag.
 *
 * ## What this deliberately does not do
 *
 * No key custody (KMS, rotation, escrow), no compaction, no index of what is
 * stored. Deferred and written down in
 * `docs/privacy/session-state-encryption.md`; what could not be deferred is the
 * per-tenant derivation, because retrofitting that means re-encrypting
 * everything already written.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { KEY_ID_BYTES, keyIdsMatch, type TenantKey } from "./keys.js";
import type { StorageState } from "./types.js";

/** "Paragent Session Storage State". Present so a stray file is identifiable. */
export const ENVELOPE_MAGIC = "PGSS";
export const ENVELOPE_VERSION = 1;

const ALGORITHM = "aes-256-gcm";
export const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;

const MAGIC_BYTES = Buffer.from(ENVELOPE_MAGIC, "ascii");
const HEADER_BYTES =
  MAGIC_BYTES.length + 1 + KEY_ID_BYTES + SALT_BYTES + IV_BYTES + TAG_BYTES;

/**
 * Owner read/write only.
 *
 * "At rest" on a developer laptop or a CI runner means the filesystem, and the
 * first control there is who else on the box can open the file. It is not a
 * substitute for the encryption — it is the part that still applies while the
 * process holds the key in memory.
 */
export const FILE_MODE = 0o600;

/** A file that is not ours, or is ours and has been tampered with. */
export class SessionEnvelopeError extends Error {
  readonly code = "SESSION_ENVELOPE" as const;
  constructor(message: string) {
    super(message);
    this.name = "SessionEnvelopeError";
  }
}

/**
 * Decryption failed: wrong key, or the ciphertext/tag was modified.
 *
 * One error for both on purpose. Distinguishing them tells a caller which half
 * of an unsuccessful attempt was wrong, and the message never carries any of
 * the plaintext it failed to produce.
 */
export class SessionDecryptionError extends Error {
  readonly code = "SESSION_DECRYPTION" as const;
  constructor(message: string) {
    super(message);
    this.name = "SessionDecryptionError";
  }
}

/** What a write reports back. Contains nothing secret, so it is safe to log. */
export interface EnvelopeInfo {
  path: string;
  key_id: string;
  bytes: number;
  version: number;
}

function additionalData(keyId: string): Buffer {
  return Buffer.from(`${ENVELOPE_MAGIC}/${ENVELOPE_VERSION}/${keyId}`, "utf8");
}

/**
 * Encrypt `state` under `key` and write it to `filePath`.
 *
 * The `key` parameter is required and `TenantKey` cannot be constructed outside
 * `keys.ts`, so there is no way to reach this function without having derived
 * one — which is the compile-time half of SC-01.
 *
 * The salt the key was derived with is the caller's to supply (it is in the
 * envelope so a reader can re-derive), which is why `deriveAndWrite` below
 * exists: it keeps the two from drifting apart at the one place they must agree.
 */
export async function writeEncryptedStorageState(
  filePath: string,
  state: StorageState,
  key: TenantKey,
  salt: Buffer,
): Promise<EnvelopeInfo> {
  if (salt.length !== SALT_BYTES) {
    throw new SessionEnvelopeError(
      `salt must be ${SALT_BYTES} bytes, got ${salt.length}`,
    );
  }
  const keyIdBytes = Buffer.from(key.key_id, "hex");
  if (keyIdBytes.length !== KEY_ID_BYTES) {
    throw new SessionEnvelopeError(
      `key_id must be ${KEY_ID_BYTES} bytes, got ${keyIdBytes.length}`,
    );
  }

  const iv = randomBytes(IV_BYTES);
  const plaintext = Buffer.from(JSON.stringify(state), "utf8");
  const { ciphertext, tag } = key.use((material) => {
    const cipher = createCipheriv(ALGORITHM, material, iv);
    cipher.setAAD(additionalData(key.key_id));
    const out = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { ciphertext: out, tag: cipher.getAuthTag() };
  });
  // Zeroed rather than left for the GC: the plaintext is the session material,
  // and its lifetime should not outlast the write that consumed it.
  plaintext.fill(0);

  const envelope = Buffer.concat([
    MAGIC_BYTES,
    Buffer.from([ENVELOPE_VERSION]),
    keyIdBytes,
    salt,
    iv,
    tag,
    ciphertext,
  ]);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, envelope, { mode: FILE_MODE });
  // Explicit, because `writeFile`'s mode is ignored when the file already
  // exists — a re-write of a file created with a looser umask would otherwise
  // keep the looser mode.
  await chmod(filePath, FILE_MODE);

  return {
    path: filePath,
    key_id: key.key_id,
    bytes: envelope.length,
    version: ENVELOPE_VERSION,
  };
}

/** The salt a file was written with, so its key can be re-derived. */
export async function readEnvelopeSalt(filePath: string): Promise<Buffer> {
  const raw = await readFile(filePath);
  return parseEnvelope(raw).salt;
}

interface ParsedEnvelope {
  keyId: string;
  salt: Buffer;
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
}

function parseEnvelope(raw: Buffer): ParsedEnvelope {
  if (raw.length < HEADER_BYTES) {
    throw new SessionEnvelopeError(
      `file is ${raw.length} bytes, shorter than the ${HEADER_BYTES}-byte envelope header`,
    );
  }
  if (!raw.subarray(0, MAGIC_BYTES.length).equals(MAGIC_BYTES)) {
    throw new SessionEnvelopeError(
      `not a ${ENVELOPE_MAGIC} envelope — refusing to guess at its format`,
    );
  }
  let at = MAGIC_BYTES.length;
  const version = raw[at++]!;
  if (version !== ENVELOPE_VERSION) {
    throw new SessionEnvelopeError(
      `envelope version ${version} is not supported (this build writes ${ENVELOPE_VERSION})`,
    );
  }
  const keyId = raw.subarray(at, at + KEY_ID_BYTES).toString("hex");
  at += KEY_ID_BYTES;
  const salt = raw.subarray(at, at + SALT_BYTES);
  at += SALT_BYTES;
  const iv = raw.subarray(at, at + IV_BYTES);
  at += IV_BYTES;
  const tag = raw.subarray(at, at + TAG_BYTES);
  at += TAG_BYTES;
  return { keyId, salt, iv, tag, ciphertext: raw.subarray(at) };
}

/**
 * Read and decrypt. Throws rather than returning anything partial.
 *
 * A wrong key is refused by `key_id` before any decryption is attempted, and by
 * the GCM tag if the label was forged — the outbound direction of the same
 * boundary the cache canaries guard inbound: one tenant's key must never yield
 * another tenant's session.
 */
export async function readEncryptedStorageState(
  filePath: string,
  key: TenantKey,
): Promise<StorageState> {
  const raw = await readFile(filePath);
  const envelope = parseEnvelope(raw);

  if (!keyIdsMatch(envelope.keyId, key.key_id)) {
    throw new SessionDecryptionError(
      `this file was written for key_id ${envelope.keyId}, not ${key.key_id} — ` +
        "a session written for one tenant is not readable with another's key",
    );
  }

  let plaintext: Buffer;
  try {
    plaintext = key.use((material) => {
      const decipher = createDecipheriv(ALGORITHM, material, envelope.iv);
      decipher.setAAD(additionalData(envelope.keyId));
      decipher.setAuthTag(envelope.tag);
      return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]);
    });
  } catch {
    // The underlying error carries no plaintext, but it does carry an OpenSSL
    // string that reads like an internal detail; this says the useful thing.
    throw new SessionDecryptionError(
      "authentication failed — the key is wrong, or the file has been modified",
    );
  }

  try {
    return JSON.parse(plaintext.toString("utf8")) as StorageState;
  } finally {
    plaintext.fill(0);
  }
}
