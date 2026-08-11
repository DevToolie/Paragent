/**
 * Session-custody package — encrypted-at-rest persistence of browser session
 * state (PRD §7 SC-01, issue #98).
 *
 * The only exported write path requires a `TenantKey`, and `TenantKey` cannot
 * be constructed outside `keys.ts`. There is no plaintext sibling to reach for.
 * See `docs/privacy/session-state-encryption.md` for the threat model and what
 * v1 defers.
 */

export const PACKAGE = "session" as const;

export {
  KEY_ID_BYTES,
  MASTER_KEY_BYTES,
  MASTER_KEY_ENV,
  MasterKey,
  MissingMasterKeyError,
  TenantKey,
  keyIdsMatch,
} from "./keys.js";

export {
  ENVELOPE_MAGIC,
  ENVELOPE_VERSION,
  FILE_MODE,
  SALT_BYTES,
  SessionDecryptionError,
  SessionEnvelopeError,
  readEncryptedStorageState,
  readEnvelopeSalt,
  writeEncryptedStorageState,
} from "./store.js";
export type { EnvelopeInfo } from "./store.js";

export { persistSessionState, restoreSessionState } from "./persist.js";

export type {
  OriginStorage,
  OriginStorageEntry,
  SessionCookie,
  StorageState,
} from "./types.js";
