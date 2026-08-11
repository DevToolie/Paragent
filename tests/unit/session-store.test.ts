/**
 * SC-01 unit half (#98): key derivation, envelope handling, and the
 * **compile-time** guarantee the canary cannot assert.
 *
 * `tests/canary/session-plaintext.test.ts` proves nothing readable reaches
 * disk. What it cannot show is that an unencrypted write is unavailable in the
 * first place, because that property is erased before the canary runs. The
 * `@ts-expect-error` cases below are checked by `npm run typecheck`: each one
 * fails the build if the call it marks ever starts compiling.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  MASTER_KEY_ENV,
  MasterKey,
  MissingMasterKeyError,
  SessionDecryptionError,
  SessionEnvelopeError,
  persistSessionState,
  readEncryptedStorageState,
  restoreSessionState,
  writeEncryptedStorageState,
  type StorageState,
} from "../../src/session/index.js";

const dirs: string[] = [];

function tempFile(name: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "paragent-session-"));
  dirs.push(dir);
  return path.join(dir, name);
}

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const state: StorageState = {
  cookies: [
    {
      name: "sid",
      value: "FAKE_VALUE",
      domain: "fake.example",
      path: "/",
      expires: -1,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ],
  origins: [],
};

describe("session persistence has no unencrypted path (SC-01)", () => {
  it("cannot be called without a key", async () => {
    const file = tempFile("no-key.pgss");
    // @ts-expect-error — the key and salt are required parameters; a write with
    // no key is the mistake this module exists to make unexpressible.
    await expect(writeEncryptedStorageState(file, state)).rejects.toThrow();
  });

  it("cannot be called with a forged key", () => {
    const forged = { key_id: "0011223344556677", use: (fn: unknown) => fn };
    // @ts-expect-error — TenantKey has private material, so a structurally
    // similar literal is not assignable. Deriving one is the only way to hold one.
    void (() => writeEncryptedStorageState("x", state, forged, Buffer.alloc(16)));
    expect(forged.key_id).toBe("0011223344556677");
  });

  it("refuses to persist when no master key is configured", () => {
    expect(() => MasterKey.fromEnv({})).toThrow(MissingMasterKeyError);
    expect(() => MasterKey.fromEnv({ [MASTER_KEY_ENV]: "" })).toThrow(
      MissingMasterKeyError,
    );
    // Too short: refused rather than padded up to 32 bytes, which would be a
    // weaker key that looks like it worked.
    expect(() =>
      MasterKey.fromEnv({ [MASTER_KEY_ENV]: Buffer.alloc(8).toString("base64") }),
    ).toThrow(MissingMasterKeyError);
  });

  it("reads a well-formed key from the environment", () => {
    const raw = Buffer.alloc(32, 3).toString("base64");
    const master = MasterKey.fromEnv({ [MASTER_KEY_ENV]: raw });
    expect(master.keyId("tenant-a")).toHaveLength(16);
  });
});

describe("per-tenant key derivation", () => {
  it("is deterministic for the same master, tenant and salt", () => {
    const master = MasterKey.fromBytes(Buffer.alloc(32, 9));
    const salt = Buffer.alloc(16, 1);
    const a = master.tenantKey("tenant-a", salt).use((m) => m.toString("hex"));
    const b = master.tenantKey("tenant-a", salt).use((m) => m.toString("hex"));
    expect(a).toBe(b);
  });

  it("separates tenants and salts", () => {
    const master = MasterKey.fromBytes(Buffer.alloc(32, 9));
    const salt = Buffer.alloc(16, 1);
    const a = master.tenantKey("tenant-a", salt).use((m) => m.toString("hex"));
    const otherTenant = master.tenantKey("tenant-b", salt).use((m) => m.toString("hex"));
    const otherSalt = master
      .tenantKey("tenant-a", Buffer.alloc(16, 2))
      .use((m) => m.toString("hex"));
    expect(a).not.toBe(otherTenant);
    expect(a).not.toBe(otherSalt);
  });

  it("gives a tenant one stable key id across salts, and separates tenants", () => {
    const master = MasterKey.fromBytes(Buffer.alloc(32, 9));
    // The id identifies the tenant across files; the key material must not.
    expect(master.tenantKey("tenant-a", Buffer.alloc(16, 1)).key_id).toBe(
      master.tenantKey("tenant-a", Buffer.alloc(16, 2)).key_id,
    );
    expect(master.keyId("tenant-a")).not.toBe(master.keyId("tenant-b"));
  });

  it("derives a different key id under a different master", () => {
    const a = MasterKey.fromBytes(Buffer.alloc(32, 1)).keyId("tenant-a");
    const b = MasterKey.fromBytes(Buffer.alloc(32, 2)).keyId("tenant-a");
    expect(a).not.toBe(b);
  });

  it("refuses an empty tenant id", () => {
    const master = MasterKey.fromBytes(Buffer.alloc(32, 9));
    expect(() => master.tenantKey("", Buffer.alloc(16))).toThrow(
      MissingMasterKeyError,
    );
  });
});

describe("envelope handling", () => {
  it("round-trips through persist/restore", async () => {
    const file = tempFile("round-trip.pgss");
    const master = MasterKey.generateEphemeral();
    const info = await persistSessionState(file, state, master, "tenant-a");
    expect(info.key_id).toBe(master.keyId("tenant-a"));
    expect(info.bytes).toBeGreaterThan(0);
    expect(await restoreSessionState(file, master, "tenant-a")).toEqual(state);
  });

  it("refuses a file that is not one of ours rather than guessing", async () => {
    const file = tempFile("foreign.json");
    writeFileSync(file, JSON.stringify(state), "utf8");
    const master = MasterKey.generateEphemeral();
    await expect(restoreSessionState(file, master, "tenant-a")).rejects.toBeInstanceOf(
      SessionEnvelopeError,
    );
  });

  it("refuses a truncated file", async () => {
    const file = tempFile("truncated.pgss");
    writeFileSync(file, Buffer.from("PGSS"));
    const master = MasterKey.generateEphemeral();
    await expect(restoreSessionState(file, master, "tenant-a")).rejects.toBeInstanceOf(
      SessionEnvelopeError,
    );
  });

  it("names the key mismatch without naming the tenant", async () => {
    const file = tempFile("mismatch.pgss");
    const master = MasterKey.generateEphemeral();
    await persistSessionState(file, state, master, "tenant-a");
    const wrong = master.tenantKey("tenant-b", Buffer.alloc(16, 5));
    await expect(readEncryptedStorageState(file, wrong)).rejects.toBeInstanceOf(
      SessionDecryptionError,
    );
    await expect(readEncryptedStorageState(file, wrong)).rejects.toThrow(
      /was written for key_id/,
    );
    await expect(readEncryptedStorageState(file, wrong)).rejects.not.toThrow(
      /tenant-b/,
    );
  });
});
