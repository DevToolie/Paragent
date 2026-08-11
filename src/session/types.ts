/**
 * The shape of what gets persisted — Playwright's `context.storageState()`.
 *
 * Declared here rather than imported from Playwright so this package can be
 * read, tested and reasoned about without a browser, and so the exact surface
 * that reaches disk is written down in one place rather than inferred from a
 * dependency's types.
 *
 * **Nothing in this repo produces one of these yet.** Verified at #98: no call
 * to `context.storageState()`, `context.cookies()`, `context.addCookies()` or
 * `chromium.launchPersistentContext()` exists in `src/`, `experiments/` or
 * `tests/`. This type exists so that the first code that does produce one has
 * only an encrypted path available to it.
 *
 * These names are cookie-shaped on purpose: this is the one package that is
 * *supposed* to know about session material. The SC-04 tripwire
 * (`tests/unit/session-material-tripwire.test.ts`) asserts the compiler's and
 * the repair model's types cannot reach it, and nothing here is imported by
 * either.
 */

export interface SessionCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  /** Seconds since the epoch; -1 for a session cookie. */
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
}

export interface OriginStorageEntry {
  name: string;
  value: string;
}

export interface OriginStorage {
  origin: string;
  localStorage: OriginStorageEntry[];
}

export interface StorageState {
  cookies: SessionCookie[];
  origins: OriginStorage[];
}
