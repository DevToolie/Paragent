/**
 * Session-establishment consent gate (SC-05, PRD §7, issue #102).
 *
 * PRD §7 commits to Fork A: the agent rides the user's own authenticated
 * session. The moment that session belongs to a real account, the product is
 * automating something a human owns, and PRD §7 requires "explicit customer
 * consent language ('you are authorizing automation of your own account')"
 * before that happens. [ADR-0018](../../docs/decisions/ADR-0018-session-consent-gate.md)
 * decides where that consent moment lives — a stored consent record, checked
 * before every session-establishing run — and this module is the checkable
 * form of that decision.
 *
 * ## The shape of the guarantee
 *
 * `SessionAuthorization` has a **private constructor**, exactly like
 * `TenantKey` (`src/session/keys.ts`): it cannot be produced by an object
 * literal, only by {@link SessionAuthorization.authorize}, which is where the
 * refusal lives. `establishSession` (`src/recorder/preamble.ts`) takes one of
 * these as a required parameter instead of a raw `baseUrl` string, so a
 * caller cannot reach the login flow without first passing through the
 * check — the same move `writeEncryptedStorageState` makes for SC-01.
 *
 * **Where this lands on the enforcement ladder
 * (`docs/privacy/session-custody.md`'s three-value scale):** enforced by
 * construction for "did this session establishment go through the check at
 * all" — there is no second door into `establishSession`. The *decision* the
 * check makes for a non-local target — consent present vs. absent — is still
 * a runtime predicate over a value (`ConsentAcknowledgment | undefined`) that
 * TypeScript cannot evaluate at compile time, so refusing a real non-local,
 * non-consented run is enforced-by-construction-that-you-cannot-skip-the-gate
 * plus a runtime check *inside* the gate, backed by
 * `tests/unit/session-consent.test.ts`. That composite is stated here
 * honestly rather than rounded up to a single word.
 *
 * ## What this module does not do
 *
 * It does not read or write a consent record from disk, and it does not show
 * anyone the copy in `docs/privacy/session-consent-copy.md`. Those are the
 * persistence and UI halves of ADR-0018's decision — "a stored consent
 * record" needs a store, and nothing in this repo establishes a session
 * against a non-local target yet (`docs/privacy/session-custody.md`,
 * Track-1 relevance section), so there is no caller to build that store for.
 * `ConsentAcknowledgment.record()` is the seam a future CLI banner or
 * onboarding step calls into once one exists; this module is the gate that
 * makes skipping it a refusal instead of a silent gap.
 *
 * **The sharpest limitation of what ships here:** `record()` takes no
 * required arguments, so what this gate proves today is *"a caller asserted
 * consent,"* not *"a human was shown the copy and agreed."* Nothing stops a
 * future caller from calling `record()` without ever having displayed
 * anything. That gap is harmless while nothing calls it against a real
 * target, but it is exactly what persistence + UI landing together has to
 * close — tracked as
 * [#163](https://github.com/DevToolie/Paragent/issues/163).
 */

/** Copy version acknowledged by {@link ConsentAcknowledgment.record}. See `docs/privacy/session-consent-copy.md`. */
export const CONSENT_COPY_VERSION = "sc05-v1" as const;

/**
 * True when `hostname` needs no consent to establish a session against: the
 * whole IPv4 loopback block (RFC 5735, 127.0.0.0/8 — not just 127.0.0.1),
 * `localhost`, and IPv6 loopback (`::1`, with or without the `[...]` a URL's
 * `.hostname` keeps around it). This is deliberately a superset of the one
 * address the test-bed actually binds
 * (`DEFAULT_HOST_PORT` in `src/testbed/constants.ts`, always `127.0.0.1`),
 * because "local" is a property of the network, not a pinned literal — a
 * narrower match would be a trap for the next port or interface choice, and
 * a real customer account is never reachable on loopback in the first place.
 */
/** A single 0-255 octet — used instead of `\d{1,3}` so `127.999.999.999` (no such host resolves, but is not a loopback address either) does not match. */
const OCTET = "(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)";
const LOOPBACK_V4 = new RegExp(`^127(?:\\.${OCTET}){3}$`);

export function isLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost") return true;
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
  if (LOOPBACK_V4.test(h)) return true;
  return false;
}

/**
 * True when `baseUrl` needs no consent — see {@link isLocalHostname}.
 * An unparseable URL is **not** treated as local: `establishSession` will
 * fail it with a clear navigation error of its own, and this guard does not
 * paper over a bad URL by guessing at its safety.
 */
export function isLocalTarget(baseUrl: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(baseUrl).hostname;
  } catch {
    return false;
  }
  return isLocalHostname(hostname);
}

/**
 * Refusing a non-local, non-consented session establishment. Named so it is
 * distinguishable from {@link LoginFailedError} (`src/recorder/preamble.ts`)
 * in a catch block or a log line — this is a policy refusal, not a login
 * failure, and the two must never be reported as the same kind of event.
 */
export class ConsentRequiredError extends Error {
  readonly code = "CONSENT_REQUIRED" as const;
  constructor(readonly baseUrl: string) {
    super(
      `refusing to establish a session against a non-local target (${baseUrl}) ` +
        "without a recorded consent acknowledgment (SC-05, PRD §7). Local " +
        "targets (localhost, 127.0.0.0/8, ::1) do not need one — see " +
        "docs/decisions/ADR-0018-session-consent-gate.md. Obtain a " +
        "ConsentAcknowledgment via ConsentAcknowledgment.record(...) and pass " +
        "it to SessionAuthorization.authorize(baseUrl, consent) before calling " +
        "establishSession.",
    );
    this.name = "ConsentRequiredError";
  }
}

/**
 * A recorded acknowledgment that the SC-05 consent copy
 * (`docs/privacy/session-consent-copy.md`, version {@link CONSENT_COPY_VERSION})
 * was shown and agreed to.
 *
 * Deliberately tiny: a copy version and a timestamp, nothing else. No
 * credential, cookie, or session material is ever a field on this class —
 * CONTRIBUTING rule 1 applies to consent records exactly as it does to
 * everything else this repo persists. Private constructor, mirroring
 * `TenantKey`: an object literal cannot forge one, so a caller cannot
 * satisfy `SessionAuthorization.authorize` by typing `{ copy_version: "...",
 * acknowledged_at: "..." }` — it must come from `record()`, which is the one
 * place a future persistence layer (reading a stored record back) or a
 * future CLI banner (writing one after the user agrees) would call into.
 */
export class ConsentAcknowledgment {
  readonly copy_version: string;
  readonly acknowledged_at: string;
  /**
   * Nominal brand only — carries no material. A `#private` field, like
   * `TenantKey`'s `#material`, is what makes TypeScript refuse a
   * structurally identical object literal in place of a real instance;
   * without one, a `{ copy_version, acknowledged_at }` literal would
   * type-check even though `record()` is the only place this class can
   * actually be constructed from.
   */
  readonly #brand = "ConsentAcknowledgment" as const;

  private constructor(copyVersion: string, acknowledgedAt: string) {
    this.copy_version = copyVersion;
    this.acknowledged_at = acknowledgedAt;
  }

  /**
   * Record that `copyVersion` was acknowledged now.
   *
   * `now` is injectable for tests; defaults to the real clock. Throws on an
   * empty `copyVersion` rather than silently recording an unattributable
   * acknowledgment — an ack that cannot say *what* was agreed to is not one.
   */
  static record(
    copyVersion: string = CONSENT_COPY_VERSION,
    now: () => Date = () => new Date(),
  ): ConsentAcknowledgment {
    if (!copyVersion.trim()) {
      throw new Error("ConsentAcknowledgment.record: copy_version must not be empty");
    }
    return new ConsentAcknowledgment(copyVersion, now().toISOString());
  }

  /** `#brand` earns its keep here too: a readable form for a log line or an assertion failure. */
  toString(): string {
    return `${this.#brand}(copy_version=${this.copy_version}, acknowledged_at=${this.acknowledged_at})`;
  }
}

/**
 * Proof that a session establishment against `baseUrl` is authorized.
 *
 * The only way to obtain one is {@link SessionAuthorization.authorize}, and
 * that is the only place `ConsentRequiredError` is thrown from. Because
 * `establishSession` requires a `SessionAuthorization` — not a raw
 * `baseUrl` — instead of a raw string, there is no path into the login flow
 * that has not gone through this check first.
 */
export class SessionAuthorization {
  /** Normalized (no trailing slash) — the exact string `establishSession` navigates to. */
  readonly baseUrl: string;
  readonly local: boolean;
  readonly consent: ConsentAcknowledgment | null;
  /** Nominal brand only — see {@link ConsentAcknowledgment.#brand}'s doc for why this exists. */
  readonly #brand = "SessionAuthorization" as const;

  private constructor(baseUrl: string, local: boolean, consent: ConsentAcknowledgment | null) {
    this.baseUrl = baseUrl;
    this.local = local;
    this.consent = consent;
  }

  /**
   * Authorize a session establishment against `baseUrl`.
   *
   * A local target (see {@link isLocalTarget}) is always authorized — the
   * test-bed authenticates fixture credentials the project itself owns
   * (`FIXTURE_ADMIN_USER`/`FIXTURE_ADMIN_PASS`, `src/testbed/constants.ts`)
   * against a container it also owns, so there is no account holder to
   * consent on behalf of (`docs/privacy/session-custody.md`, "Track-1
   * relevance"). A non-local target requires `consent`, and its absence is
   * {@link ConsentRequiredError}, not a silent pass-through.
   */
  static authorize(baseUrl: string, consent?: ConsentAcknowledgment): SessionAuthorization {
    const normalized = baseUrl.replace(/\/$/, "");
    const local = isLocalTarget(normalized);
    if (!local && !consent) {
      throw new ConsentRequiredError(normalized);
    }
    return new SessionAuthorization(normalized, local, consent ?? null);
  }

  /** `#brand` earns its keep here too: a readable form for a log line or an assertion failure. */
  toString(): string {
    return `${this.#brand}(baseUrl=${this.baseUrl}, local=${this.local}, consent=${
      this.consent ? this.consent.copy_version : "none"
    })`;
  }
}
