#!/usr/bin/env node
/**
 * Fail the build on content that looks like cookies, tokens, API keys, or .env material.
 * Allowlist: .env.example with commented placeholders only; LICENSE; package-lock.
 */
import { open, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".venv",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  "archive",
]);

const SKIP_FILES = new Set(["package-lock.json", ".coverage"]);

/**
 * A cookie/localStorage entry whose value is actual material rather than an
 * elided example.
 *
 * This is the whole discriminator for the storage-state patterns below. The
 * shape alone is not enough: `docs/privacy/session-custody.md` quotes a real
 * `storageState()` layout verbatim to document the very gap this closes, and
 * `docs/gate/recorder.md` discusses the same fields in prose. Those examples
 * elide their values (`"value":"..."`); a genuine dump cannot, because the
 * value *is* the secret.
 *
 * 16 characters clears every placeholder in the tree ("...", "REDACTED",
 * "<omitted>") while sitting far below a real session cookie — Grafana's is 32
 * hex characters, a JWT is hundreds.
 *
 * No closing quote is required. `[^"]` cannot cross one, so sixteen matched
 * characters are already sixteen characters of one value; demanding the
 * terminator only adds a way to miss a dump truncated mid-write.
 */
const SUBSTANTIAL_VALUE = /"value"\s*:\s*"[^"]{16,}/i;

/**
 * Longest span the co-occurrence check will read from one anchor, and the most
 * anchors it will follow in one file (#115).
 *
 * Both exist so the scan stays linear on a hostile input rather than because a
 * real dump needs the room: Grafana's whole `storageState()` is a few hundred
 * bytes. A file that manages to exceed either bound has already been read into
 * memory by the 1.5MB gate above, so these only bound the *scanning*.
 */
const MAX_SPAN = 100_000;
const MAX_ANCHORS = 32;

/**
 * The JSON value opening at `openIndex`, up to its matching bracket.
 *
 * A single forward pass with a depth counter, string-aware so a `]` inside a
 * cookie value cannot close the array early, and escape-aware so a `\"` inside
 * that value cannot end the string early. No regex, so no backtracking — which
 * is the concern that made the original co-occurrence check two whole-file
 * scans in the first place.
 *
 * An unterminated value (a truncated file, or a `[` that was prose rather than
 * JSON) returns what it read up to the bound. That is the fail-closed
 * direction: the check still runs, over more text rather than less.
 */
function jsonSpan(body, openIndex) {
  const end = Math.min(body.length, openIndex + MAX_SPAN);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = openIndex; i < end; i++) {
    const ch = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return body.slice(openIndex, i + 1);
    }
  }
  return body.slice(openIndex, end);
}

/**
 * Co-occurrence, scoped to one array rather than to the whole file (#115).
 *
 * The first version of this tested each condition with an independent
 * `.test(body)`, so three unrelated things anywhere in a document combined into
 * a hit: a `"cookies"` feature-flag array, a field named `httpOnly` somewhere
 * else, and any 16-character `"value"` somewhere else again — a hash, a UUID, a
 * cache key. None of that is a session dump, and a false positive here breaks
 * CI on a PR that has nothing to do with secrets.
 *
 * Scoping by *structure* rather than by a character window is what makes the
 * distinction exact: the companion key and the substantial value must sit inside
 * the same array the anchor opened. A window would still have to guess a
 * distance, and a JWT is long enough to push the two apart by more than any
 * number that also excludes unrelated neighbours.
 *
 * The anchor deliberately requires an array **of objects** (`[` then `{`). A
 * dump has one; `"cookies": ["analytics", "functional"]` does not, so the check
 * never even opens a span on it.
 */
function coOccursInArray(body, anchor, companion) {
  let seen = 0;
  for (const m of body.matchAll(anchor)) {
    if (++seen > MAX_ANCHORS) break;
    // The anchor ends at the `[` it matched, so the span starts there — the
    // `{` it also matched is inside the array and is found again by the scan.
    const open = body.indexOf("[", m.index);
    if (open === -1) continue;
    const span = jsonSpan(body, open);
    if (companion.test(span) && SUBSTANTIAL_VALUE.test(span)) return true;
  }
  return false;
}

/**
 * Patterns may be a regex (`re`) or a predicate (`test`).
 *
 * The storage-state entries are predicates on purpose: they need *co-occurrence*
 * of two independent shapes, and expressing that as one regex means a lazy
 * `[\s\S]{0,N}?` bridge between them — which is both unreadable and a
 * backtracking risk on a large file. A bounded structural span and an `&&` are
 * neither.
 */
const PATTERNS = [
  { name: "env-assignment", re: /^(?!#).*?(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|COOKIE)\s*=\s*.+/im },
  { name: "bearer-token", re: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/ },
  { name: "aws-access-key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "github-pat", re: /ghp_[A-Za-z0-9]{36}/ },
  { name: "slack-token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "cookie-header", re: new RegExp("Set-" + "Cookie:\\s*[^=]+=[^;]+", "i") },
  { name: "session-json", re: /"session(?:id|token|key)"\s*:\s*"[^"]{8,}"/i },
  // Playwright's context.storageState() shape — the one CONTRIBUTING rule 1
  // claims is blocked and, before #100, was not. Its keys are
  // name/value/domain/httpOnly/sameSite: there is no response header of the
  // kind `cookie-header` looks for, and no key spelled `sessionid`, so neither
  // of those could ever fire on it. Verified: 0 of the 8 prior patterns matched.
  // (This comment avoids spelling the header literal for the same reason the
  //  pattern above builds it by concatenation — the file scans itself.)
  {
    name: "storage-state-cookies",
    test: (body) =>
      coOccursInArray(body, /"cookies"\s*:\s*\[\s*\{/gi, /"(?:httpOnly|sameSite)"\s*:/i),
  },
  {
    name: "storage-state-origins",
    test: (body) =>
      coOccursInArray(body, /"origins"\s*:\s*\[\s*\{/gi, /"localStorage"\s*:\s*\[/i),
  },
];

/**
 * The first pattern `body` matches, or null.
 *
 * Exported so tests can assert both directions cheaply — that a synthetic
 * storage-state fixture is caught, and that every doc discussing cookies in
 * prose is not. A false positive here breaks CI for unrelated PRs, so the
 * negative direction matters as much as the positive one.
 */
export function scanText(body) {
  for (const p of PATTERNS) {
    const hit = p.test ? p.test(body) : p.re.test(body);
    if (hit) return p.name;
  }
  return null;
}

export { PATTERNS };

/** @param {string} dir */
async function walk(dir) {
  /** @type {string[]} */
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (ent.isFile()) {
      if (SKIP_FILES.has(ent.name)) continue;
      if (ent.name === ".env" || /^\.env\.[^.]+$/.test(ent.name)) {
        // .env.example allowed; real .env never
        if (ent.name !== ".env.example") {
          out.push(full);
        }
        continue;
      }
      out.push(full);
    }
  }
  return out;
}

const textExt = /\.(md|ts|tsx|js|mjs|cjs|json|yml|yaml|toml|txt|env|example|sh|ps1|Dockerfile)$/i;

async function main() {
  // Explicit paths scan exactly what they name, extension filter and all —
  // naming a file is a deliberate act, and it is how the test proves the
  // storage-state patterns fire end to end without committing a fixture the
  // repo-wide walk would then trip over forever.
  const explicit = process.argv.slice(2);
  const files = explicit.length > 0
    ? explicit.map((f) => path.resolve(ROOT, f))
    : await walk(ROOT);
  /** @type {{ file: string, pattern: string }[]} */
  const hits = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    if (rel === ".env" || rel.startsWith(".env.") && rel !== ".env.example") {
      hits.push({ file: rel, pattern: "dotenv-file" });
      continue;
    }
    if (explicit.length === 0 && !textExt.test(file) && !file.endsWith("Dockerfile")) continue;
    // Size-check and read through one handle. Stat-then-read by path is a
    // time-of-check/time-of-use race: the file measured need not be the file
    // then read. It matters more here than in most places — this is the check
    // that is supposed to stop session material reaching the tree.
    const fh = await open(file, "r");
    /** @type {string} */
    let body;
    try {
      if ((await fh.stat()).size > 1_500_000) continue;
      body = await fh.readFile("utf8");
    } finally {
      await fh.close();
    }
    // Allow .env.example placeholder comments only
    if (path.basename(file) === ".env.example") continue;
    const hit = scanText(body);
    if (hit) hits.push({ file: rel, pattern: hit });
  }

  if (hits.length) {
    console.error("SECRET SCAN FAILED:");
    for (const h of hits) {
      console.error(`  - ${h.file} (${h.pattern})`);
    }
    process.exit(1);
  }
  console.log("secret-scan: clean");
}

/**
 * Only run when invoked as a CLI. Importing this module — which the tests do,
 * to exercise `scanText` in both directions — must not kick off a repo walk.
 */
const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
