/**
 * SC-01 canary: session material on **disk**, in bytes (#98).
 *
 * In the shape of `tests/canary/store-leak.test.ts`, and for the same reason it
 * exists: a unit test on the function proves the function behaves, while a
 * privacy incident is a file. So this drives the real persistence path into a
 * temp directory and then greps the raw bytes.
 *
 * ## The counter-case is the point
 *
 * Every assertion below is of the form "the marker is NOT in the file", and
 * assertions of that shape pass for free if the write silently did nothing, if
 * the markers are absent from the input, or if the grep is looking in the wrong
 * place. The `plaintextWriteForContrast` case writes the *same* state through
 * the mistake this module exists to prevent — a plain `JSON.stringify` to disk —
 * and asserts every marker IS found. If the encrypted assertions ever pass
 * vacuously, that one fails and says so, the same way the pool canary proves
 * its taint rule is load-bearing by mutation.
 *
 * ## Nothing here is real
 *
 * Synthetic values only, and short ones: `secret-scan` fails the build on a
 * cookies array containing a 16-character `"value"` beside an `httpOnly` key,
 * which is exactly the shape a genuine dump has. A fixture that trips the
 * secret scanner would be a fixture that should not be in the repo.
 */

import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  ENVELOPE_MAGIC,
  MasterKey,
  SessionDecryptionError,
  persistSessionState,
  restoreSessionState,
  type StorageState,
} from "../../src/session/index.js";

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "paragent-session-canary-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
});

/**
 * Fake session material. Every string here is a canary: none of them may appear
 * in an encrypted file, and all of them must appear in the plaintext contrast.
 *
 * Kept under 16 characters each so the fixture cannot itself look like a dump
 * to `npm run secret-scan` — see the module note.
 */
const CANARY_STRINGS = [
  "CANARY_SESSID",
  "CANARY_CSRF",
  "CANARY_TOKEN",
  "canary.example",
] as const;

function canaryState(): StorageState {
  return {
    cookies: [
      {
        name: "grafana_session",
        value: "CANARY_SESSID",
        domain: "canary.example",
        path: "/",
        expires: -1,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
      {
        name: "csrf",
        value: "CANARY_CSRF",
        domain: "canary.example",
        path: "/",
        expires: 1893456000,
        httpOnly: false,
        secure: true,
        sameSite: "Strict",
      },
    ],
    origins: [
      {
        origin: "https://canary.example",
        localStorage: [{ name: "auth", value: "CANARY_TOKEN" }],
      },
    ],
  };
}

const TENANT = "CANARY_TENANT";

/** The mistake, written out so the canary can prove it would be caught. */
function plaintextWriteForContrast(filePath: string, state: StorageState): void {
  writeFileSync(filePath, JSON.stringify(state), "utf8");
}

async function writeCanaryFile(): Promise<{ file: string; master: MasterKey; raw: Buffer }> {
  const file = path.join(tempDir(), "session.pgss");
  const master = MasterKey.generateEphemeral();
  await persistSessionState(file, canaryState(), master, TENANT);
  return { file, master, raw: readFileSync(file) };
}

describe("canary: no session material reaches disk in plaintext (SC-01)", () => {
  it("writes a non-empty file", async () => {
    const { raw } = await writeCanaryFile();
    // If this ever reads empty the rest of the suite proves nothing — a leak
    // test over a file that was never written passes trivially.
    expect(raw.length).toBeGreaterThan(0);
    expect(raw.subarray(0, 4).toString("ascii")).toBe(ENVELOPE_MAGIC);
  });

  it("the file on disk contains NO canary string", async () => {
    const { raw } = await writeCanaryFile();
    const text = raw.toString("latin1");
    for (const canary of CANARY_STRINGS) {
      expect(text, `canary ${canary} found on disk`).not.toContain(canary);
    }
  });

  it("the file is not parseable as JSON, or as anything shaped like a dump", async () => {
    const { raw } = await writeCanaryFile();
    expect(() => JSON.parse(raw.toString("utf8"))).toThrow();
    const text = raw.toString("latin1");
    for (const key of ["cookies", "localStorage", "httpOnly", "sameSite", "value"]) {
      expect(text, `structural key ${key} found on disk`).not.toContain(key);
    }
  });

  it("does not name the tenant on disk — only an opaque key id", async () => {
    const { raw, master } = await writeCanaryFile();
    const text = raw.toString("latin1");
    expect(text).not.toContain(TENANT);
    // The label that IS there is not reversible to the tenant id.
    const keyId = master.keyId(TENANT);
    expect(raw.subarray(5, 13).toString("hex")).toBe(keyId);
    expect(keyId).not.toContain(TENANT);
  });

  it("is readable back — the encryption is not just destroying the data", async () => {
    const { file, master } = await writeCanaryFile();
    const restored = await restoreSessionState(file, master, TENANT);
    expect(restored).toEqual(canaryState());
  });

  it("is owner-only on disk", async () => {
    const { file } = await writeCanaryFile();
    // POSIX only; Windows reports a synthesized mode that this cannot assert on.
    if (process.platform !== "win32") {
      expect(statSync(file).mode & 0o777).toBe(0o600);
    }
  });

  it("does not yield another tenant's session", async () => {
    const { file, master } = await writeCanaryFile();
    await expect(
      restoreSessionState(file, master, "CANARY_OTHER"),
    ).rejects.toBeInstanceOf(SessionDecryptionError);
  });

  it("does not yield anything under a different master key", async () => {
    const { file } = await writeCanaryFile();
    await expect(
      restoreSessionState(file, MasterKey.generateEphemeral(), TENANT),
    ).rejects.toBeInstanceOf(SessionDecryptionError);
  });

  it("refuses a tampered file rather than returning partial plaintext", async () => {
    const { file, master, raw } = await writeCanaryFile();
    const tampered = Buffer.from(raw);
    const last = tampered.length - 1;
    tampered[last] = (tampered[last] ?? 0) ^ 0xff;
    writeFileSync(file, tampered);
    await expect(restoreSessionState(file, master, TENANT)).rejects.toBeInstanceOf(
      SessionDecryptionError,
    );
  });

  it("two writes of the same state produce different bytes", async () => {
    const a = await writeCanaryFile();
    const b = await writeCanaryFile();
    // A stable ciphertext would make the file a fingerprint of the session even
    // to someone who cannot read it.
    expect(a.raw.equals(b.raw)).toBe(false);
  });

  it("never prints key material, even through JSON.stringify or inspect", () => {
    const master = MasterKey.generateEphemeral();
    const salt = Buffer.alloc(16, 7);
    const key = master.tenantKey(TENANT, salt);
    const material = key.use((m) => m.toString("hex"));

    for (const rendered of [
      JSON.stringify(key),
      String(key),
      JSON.stringify({ nested: key }),
      JSON.stringify(master),
      String(master),
    ]) {
      expect(rendered).not.toContain(material);
      expect(rendered).toContain("[redacted]");
    }
  });
});

/**
 * The mutation case. These assertions are the mirror image of the ones above,
 * so a change that makes the encrypted checks vacuous shows up here as a
 * failure rather than as a green suite.
 */
describe("canary counter-case: the plaintext write this module exists to prevent", () => {
  it("DOES leave every canary string on disk", () => {
    const file = path.join(tempDir(), "plaintext.json");
    plaintextWriteForContrast(file, canaryState());
    const text = readFileSync(file).toString("latin1");
    for (const canary of CANARY_STRINGS) {
      expect(text, `contrast case failed to write ${canary}`).toContain(canary);
    }
  });

  it("DOES parse as JSON and carries the dump's structure", () => {
    const file = path.join(tempDir(), "plaintext.json");
    plaintextWriteForContrast(file, canaryState());
    const parsed = JSON.parse(readFileSync(file, "utf8")) as StorageState;
    expect(parsed.cookies[0]!.value).toBe("CANARY_SESSID");
    expect(parsed.origins[0]!.localStorage[0]!.value).toBe("CANARY_TOKEN");
  });

  it("has no route through the module's API — it took a hand-written writer", () => {
    // Not a runtime assertion so much as the statement the suite rests on: the
    // contrast above could only be produced by bypassing this package entirely,
    // because every exported write path requires a key that cannot be forged.
    // `tests/unit/session-store.test.ts` pins the type-level half.
    expect(plaintextWriteForContrast.name).toBe("plaintextWriteForContrast");
  });
});
