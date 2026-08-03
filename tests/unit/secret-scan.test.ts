/**
 * `secret-scan.mjs` and the Playwright `storageState()` shape (#100).
 *
 * `CONTRIBUTING.md` rule 1 says: "No credentials, cookies, session/storage
 * dumps... Secret-scanning CI fails the build on matches." Before #100 that was
 * false for the shape that matters most — a real `context.storageState()` dump
 * matched **zero** of the eight patterns, because its keys are
 * `name`/`value`/`domain`/`httpOnly`/`sameSite`: no response header of the kind
 * `cookie-header` wants, no key spelled `sessionid`.
 *
 * A documented guard that does not exist is worse than a known gap: it is why
 * nobody looks twice at a session dump in a diff, and this check is
 * merge-blocking, so it is the one people trust implicitly.
 *
 * **Both directions matter equally.** A pattern that fires on the word
 * "cookies" would break CI on every unrelated PR touching the privacy docs, so
 * the negative half of this suite is not padding — it is the half that keeps
 * the positive half shippable.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// @ts-expect-error -- plain .mjs script, no type declarations
import { scanText, PATTERNS } from "../../scripts/secret-scan.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/fixtures/storage-state.sample");

const scan = scanText as (body: string) => string | null;

/**
 * Values are assembled at runtime, never written as literals.
 *
 * The patterns under test need a value of 16+ characters to fire, so spelling
 * one out here would make this file itself a hit and break `npm run secret-scan`
 * repo-wide — the exact failure the suite's last test guards against. The
 * scanner does the same thing for its own header literal.
 */
const fakeCookieValue = "FAKE" + "0".repeat(28);
const fakeStorageValue = "FAKE-" + "local" + "storage-value-not-real";

describe("storage-state detection (#100)", () => {
  it("catches a synthetic Playwright storageState dump", () => {
    expect(scan(readFileSync(FIXTURE, "utf8"))).toBe("storage-state-cookies");
  });

  it("catches the origins/localStorage half on its own", () => {
    // A dump can arrive with only origins populated.
    const originsOnly = JSON.stringify({
      origins: [
        {
          origin: "http://127.0.0.1:3000",
          localStorage: [{ name: "k", value: fakeStorageValue }],
        },
      ],
    });
    expect(scan(originsOnly)).toBe("storage-state-origins");
  });

  it("was invisible to every pattern that existed before #100", () => {
    // The regression this closes. If someone deletes the new entries, the
    // fixture goes back to scanning clean and this fails.
    const legacy = (PATTERNS as Array<{ name: string; re?: RegExp }>).filter(
      (p) => !p.name.startsWith("storage-state"),
    );
    const body = readFileSync(FIXTURE, "utf8");
    expect(legacy).toHaveLength(8);
    expect(legacy.filter((p) => p.re?.test(body))).toEqual([]);
  });

  it("exits non-zero when the CLI is pointed at the fixture", () => {
    // End to end, not just the predicate: proves the wiring, and proves the
    // fixture is only clean repo-wide because of the extension filter.
    expect(() =>
      execFileSync("node", ["scripts/secret-scan.mjs", "tests/fixtures/storage-state.sample"], {
        cwd: ROOT,
        stdio: "pipe",
      }),
    ).toThrow();
  });
});

describe("no false positive on prose", () => {
  /** Every doc that discusses cookies/storage in words rather than carrying it. */
  const proseDocs = [
    "docs/privacy/session-custody.md",
    "docs/privacy/boundary-spec.md",
    "docs/gate/recorder.md",
    "docs/gate/runner.md",
    "docs/architecture.md",
    "docs/INTEGRITY-AUDIT.md",
    "CONTRIBUTING.md",
    "README.md",
  ];

  it.each(proseDocs)("does not flag %s", (rel) => {
    expect(scan(readFileSync(path.join(ROOT, rel), "utf8"))).toBeNull();
  });

  it("does not flag session-custody.md, which quotes the shape verbatim", () => {
    // The sharpest case: that doc contains a literal `{"cookies":[{...
    // "httpOnly":true,"sameSite":"Lax"}]}` block to document this very gap.
    // Its values are elided (`"value":"..."`), and that is the discriminator —
    // the pattern catches session *material*, not session *discussion*.
    const body = readFileSync(path.join(ROOT, "docs/privacy/session-custody.md"), "utf8");
    expect(body).toContain('"cookies":[');
    expect(body).toContain('"httpOnly":true');
    expect(scan(body)).toBeNull();
  });

  it("an elided example stays clean; the same shape with a real value does not", () => {
    const shape = (value: string) =>
      `{"cookies":[{"name":"s","value":"${value}","httpOnly":true,"sameSite":"Lax"}]}`;
    const elided = shape("...");
    const material = shape(fakeCookieValue);
    expect(scan(elided)).toBeNull();
    expect(scan(material)).toBe("storage-state-cookies");
  });

  it("common redaction placeholders stay under the value threshold", () => {
    for (const placeholder of ["...", "REDACTED", "<omitted>", "xxx", "TODO"]) {
      const body = `{"cookies":[{"name":"s","value":"${placeholder}","httpOnly":true}]}`;
      expect(scan(body), `flagged placeholder ${placeholder}`).toBeNull();
    }
  });
});

describe("the whole repo stays clean", () => {
  it("no tracked text file matches, so this suite cannot pass by breaking CI", () => {
    // Guards the guard. A pattern that flags something already in the tree
    // would make `npm run secret-scan` fail for every unrelated PR, and the
    // tests above would still pass.
    const skipDirs = new Set([".git", "node_modules", "dist", "archive", ".venv"]);
    const textExt = /\.(md|ts|tsx|js|mjs|cjs|json|yml|yaml|toml|txt|sh)$/i;
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (skipDirs.has(ent.name)) continue;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full);
        else if (ent.isFile() && textExt.test(ent.name)) {
          if (ent.name === "package-lock.json") continue;
          if (statSync(full).size > 1_500_000) continue;
          const hit = scan(readFileSync(full, "utf8"));
          if (hit) offenders.push(`${path.relative(ROOT, full)} (${hit})`);
        }
      }
    };
    walk(ROOT);
    expect(offenders).toEqual([]);
  });
});
