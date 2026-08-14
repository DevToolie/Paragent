/**
 * Session-custody package (PRD §7).
 *
 * Two independent guarantees, both gated by a private-constructor capability
 * a caller cannot forge:
 *
 * - **Encryption at rest (SC-01, issue #98).** The only exported write path
 *   requires a `TenantKey`, and `TenantKey` cannot be constructed outside
 *   `keys.ts`. There is no plaintext sibling to reach for. See
 *   `docs/privacy/session-state-encryption.md` for the threat model and what
 *   v1 defers.
 * - **Consent before establishing a non-local session (SC-05, issue #102).**
 *   `establishSession` (`src/recorder/preamble.ts`) requires a
 *   `SessionAuthorization`, obtainable only from `SessionAuthorization.authorize`,
 *   which refuses a non-local target with no `ConsentAcknowledgment`. See
 *   `docs/decisions/ADR-0018-session-consent-gate.md`.
 */

export const PACKAGE = "session" as const;

export {
  CONSENT_COPY_VERSION,
  ConsentAcknowledgment,
  ConsentRequiredError,
  SessionAuthorization,
  isLocalHostname,
  isLocalTarget,
} from "./consent.js";

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
