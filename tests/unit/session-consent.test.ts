/**
 * SC-05 unit tests (#102): the session-consent gate.
 *
 * The refusal path is the load-bearing case — `docs/decisions/ADR-0018-session-consent-gate.md`
 * only closes SC-05 if a non-local, non-consented session establishment is
 * actually rejected, not merely documented as should-be-rejected. The
 * `@ts-expect-error` cases mirror `tests/unit/session-store.test.ts`'s
 * treatment of `TenantKey`: they are checked by `npm run typecheck`, and fail
 * the build if the call they mark ever starts compiling.
 */

import { describe, expect, it } from "vitest";

import {
  CONSENT_COPY_VERSION,
  ConsentAcknowledgment,
  ConsentRequiredError,
  SessionAuthorization,
  isLocalHostname,
  isLocalTarget,
} from "../../src/session/consent.js";
import { establishSession, type EstablishSessionOptions } from "../../src/recorder/preamble.js";

describe("isLocalHostname / isLocalTarget (SC-05)", () => {
  it("treats the whole IPv4 loopback block, not just 127.0.0.1, as local", () => {
    expect(isLocalHostname("127.0.0.1")).toBe(true);
    expect(isLocalHostname("127.0.0.2")).toBe(true);
    expect(isLocalHostname("127.255.255.255")).toBe(true);
  });

  it("treats localhost and IPv6 loopback as local, case-insensitively and bracketed", () => {
    expect(isLocalHostname("localhost")).toBe(true);
    expect(isLocalHostname("LOCALHOST")).toBe(true);
    expect(isLocalHostname("::1")).toBe(true);
    expect(isLocalHostname("[::1]")).toBe(true);
  });

  it("does not treat a real hostname or a public/private-but-non-loopback IP as local", () => {
    expect(isLocalHostname("grafana.example.com")).toBe(false);
    expect(isLocalHostname("8.8.8.8")).toBe(false);
    // A private LAN address is not the loopback interface — a real device on
    // the network can be a real account, so this must not be waved through.
    expect(isLocalHostname("192.168.1.5")).toBe(false);
    expect(isLocalHostname("10.0.0.1")).toBe(false);
  });

  it("does not treat an out-of-range octet as local — no such host resolves, but it is not loopback either", () => {
    expect(isLocalHostname("127.999.999.999")).toBe(false);
    expect(isLocalHostname("127.256.0.1")).toBe(false);
  });

  it("derives from the URL's hostname, ignoring port/path/query", () => {
    expect(isLocalTarget("http://127.0.0.1:3000/login?orgId=1")).toBe(true);
    expect(isLocalTarget("https://grafana.example.com:3000/login")).toBe(false);
  });

  it("treats an unparseable URL as non-local rather than guessing", () => {
    expect(isLocalTarget("not a url")).toBe(false);
  });
});

describe("ConsentAcknowledgment.record (SC-05)", () => {
  it("records the copy version and a timestamp", () => {
    const ack = ConsentAcknowledgment.record(CONSENT_COPY_VERSION, () => new Date("2026-08-14T00:00:00.000Z"));
    expect(ack.copy_version).toBe(CONSENT_COPY_VERSION);
    expect(ack.acknowledged_at).toBe("2026-08-14T00:00:00.000Z");
  });

  it("defaults to the current CONSENT_COPY_VERSION", () => {
    const ack = ConsentAcknowledgment.record();
    expect(ack.copy_version).toBe(CONSENT_COPY_VERSION);
  });

  it("refuses an empty copy_version rather than recording an unattributable ack", () => {
    expect(() => ConsentAcknowledgment.record("")).toThrow(/copy_version/);
    expect(() => ConsentAcknowledgment.record("   ")).toThrow(/copy_version/);
  });

  it("carries no credential- or session-shaped field — SC-05 must not become an SC-01/02 hole", () => {
    const ack = ConsentAcknowledgment.record();
    const keys = Object.keys(ack);
    expect(keys).toEqual(["copy_version", "acknowledged_at"]);
    expect(JSON.stringify(ack)).not.toMatch(/cookie|password|token|session/i);
  });

  it("cannot be constructed by an object literal — record() is the only door", () => {
    // @ts-expect-error — private constructor; a structurally identical
    // literal is not assignable, exactly as TenantKey's is not
    // (tests/unit/session-store.test.ts).
    const forged: ConsentAcknowledgment = {
      copy_version: CONSENT_COPY_VERSION,
      acknowledged_at: new Date().toISOString(),
    };
    expect(forged.copy_version).toBe(CONSENT_COPY_VERSION);
  });
});

describe("SessionAuthorization.authorize — the refusal path (SC-05)", () => {
  it("authorizes a local target with no consent argument at all", () => {
    const auth = SessionAuthorization.authorize("http://127.0.0.1:3000");
    expect(auth.local).toBe(true);
    expect(auth.consent).toBeNull();
    expect(auth.baseUrl).toBe("http://127.0.0.1:3000");
  });

  it("normalizes a trailing slash the same way establishSession used to itself", () => {
    const auth = SessionAuthorization.authorize("http://127.0.0.1:3000/");
    expect(auth.baseUrl).toBe("http://127.0.0.1:3000");
  });

  it("REFUSES a non-local target with no consent acknowledgment", () => {
    expect(() => SessionAuthorization.authorize("https://real-customer.example.com")).toThrow(
      ConsentRequiredError,
    );
  });

  it("the refusal names the target and points at the resolution", () => {
    let caught: unknown;
    try {
      SessionAuthorization.authorize("https://real-customer.example.com");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ConsentRequiredError);
    const err = caught as ConsentRequiredError;
    expect(err.code).toBe("CONSENT_REQUIRED");
    expect(err.baseUrl).toBe("https://real-customer.example.com");
    expect(err.message).toContain("real-customer.example.com");
    expect(err.message).toContain("SC-05");
  });

  it("does not refuse a local target even with an absurd path — locality is host-only", () => {
    expect(() =>
      SessionAuthorization.authorize("http://localhost:3000/anything/at/all?x=1"),
    ).not.toThrow();
  });

  it("authorizes a non-local target once a consent acknowledgment is supplied", () => {
    const consent = ConsentAcknowledgment.record();
    const auth = SessionAuthorization.authorize("https://real-customer.example.com", consent);
    expect(auth.local).toBe(false);
    expect(auth.consent).toBe(consent);
  });

  it("cannot be constructed by an object literal — authorize() is the only door", () => {
    // @ts-expect-error — private constructor, same shape as TenantKey. A
    // caller cannot skip the refusal by typing the result of authorize().
    const forged: SessionAuthorization = {
      baseUrl: "https://real-customer.example.com",
      local: false,
      consent: null,
    };
    expect(forged.baseUrl).toBe("https://real-customer.example.com");
  });
});

describe("the gate is load-bearing on establishSession's actual signature", () => {
  it("EstablishSessionOptions has no baseUrl field a caller could pass instead of target", () => {
    // `baseUrl` is not a key of EstablishSessionOptions; only
    // `target: SessionAuthorization` is. This is what makes bypassing
    // SessionAuthorization.authorize a compile error rather than a runtime
    // check a caller could accidentally skip. `target` is supplied correctly
    // here so the only diagnostic is the excess `baseUrl` property.
    const target = SessionAuthorization.authorize("http://127.0.0.1:3000");
    const opts: EstablishSessionOptions = {
      target,
      // @ts-expect-error — excess/unknown property; there is no baseUrl field to assign.
      baseUrl: "https://real-customer.example.com",
      username: "u",
      password: "p",
    };
    expect(opts.target).toBe(target);
  });

  it("establishSession itself is only reachable with an authorized target (type-level)", () => {
    // No network call is made — this asserts the *type* rejects a raw
    // string, which `tsc --noEmit` enforces via the @ts-expect-error below.
    // A real refusal-at-runtime is covered by the SessionAuthorization.authorize
    // suite above, which is what a non-local caller actually hits.
    void ((page: import("playwright").Page) =>
      establishSession(page, {
        // @ts-expect-error — target must be a SessionAuthorization, not a string.
        target: "https://real-customer.example.com",
        username: "u",
        password: "p",
      }));
  });
});
