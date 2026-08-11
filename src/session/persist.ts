/**
 * The pair a caller actually uses: persist a session, restore it later.
 *
 * `writeEncryptedStorageState` takes a key and the salt that key was derived
 * with, because the reader has to re-derive and the salt is what lets it. Those
 * two must agree, and "must agree" is the kind of thing that drifts when it is
 * two calls at a call site. So it is one call here, and the salt is generated
 * fresh per write: the same state encrypted twice produces different bytes,
 * which is what stops a file from being a stable fingerprint of a session.
 */

import { randomBytes } from "node:crypto";
import type { MasterKey } from "./keys.js";
import {
  SALT_BYTES,
  readEncryptedStorageState,
  readEnvelopeSalt,
  writeEncryptedStorageState,
  type EnvelopeInfo,
} from "./store.js";
import type { StorageState } from "./types.js";

/**
 * Encrypt `state` for `tenantId` and write it to `filePath`.
 *
 * Every parameter is required, `MasterKey` cannot be constructed from a literal,
 * and there is no overload that omits it — persisting session material without
 * a key is not a thing this module can express.
 */
export async function persistSessionState(
  filePath: string,
  state: StorageState,
  master: MasterKey,
  tenantId: string,
): Promise<EnvelopeInfo> {
  const salt = randomBytes(SALT_BYTES);
  const key = master.tenantKey(tenantId, salt);
  return writeEncryptedStorageState(filePath, state, key, salt);
}

/**
 * Read back what `persistSessionState` wrote.
 *
 * Throws `SessionDecryptionError` when `tenantId` is not the tenant the file
 * was written for — the outbound half of the privacy boundary. Every existing
 * control in this repo governs what may *enter* the pool; this one governs
 * whose session may come back out.
 */
export async function restoreSessionState(
  filePath: string,
  master: MasterKey,
  tenantId: string,
): Promise<StorageState> {
  const salt = await readEnvelopeSalt(filePath);
  const key = master.tenantKey(tenantId, salt);
  return readEncryptedStorageState(filePath, key);
}
