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
 */
const SUBSTANTIAL_VALUE = /"value"\s*:\s*"[^"]{16,}"/i;

/**
 * How far to keep scanning for an array's closing bracket before giving up.
 *
 * Only reached by an *unterminated* array — a truncated dump, or prose quoting
 * an opening bracket it never closes. A real `storageState()` file is valid
 * JSON and closes long before this.
 */
const MAX_ARRAY_SCAN = 100_000;

/**
 * The text of the JSON array that opens at `openIndex`, bracket-matched.
 *
 * This is what scopes the storage-state predicates below (#115). Testing each
 * condition against the whole file let three *unrelated* fragments combine into
 * a hit: a `"cookies"` feature-flag array in one place, a field named
 * `httpOnly` in another, and any 16-char `"value"` in a third. Scoping to the
 * array means the companion key and the substantial value have to sit inside
 * the same `"cookies"`/`"origins"` array that raised the suspicion — which is
 * exactly where a real dump puts them, and where unrelated content cannot be.
 *
 * A single linear pass with string/escape awareness, so a `"["` inside a value
 * does not throw off the depth count. No regex bridge, and therefore none of
 * the catastrophic-backtracking risk one would carry.
 *
 * When the array never closes within `MAX_ARRAY_SCAN`, the capped slice is
 * returned rather than nothing: a truncated dump is still worth scanning, and
 * this check must fail toward detection.
 */
function jsonArrayAt(body, openIndex) {
  const end = Math.min(body.length, openIndex + MAX_ARRAY_SCAN);
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
      depth -= 1;
      if (depth === 0) return body.slice(openIndex, i + 1);
    }
  }
  return body.slice(openIndex, end);
}

/**
 * True when every `companion` matches inside some array introduced by `anchor`.
 *
 * `anchor` must be a sticky-safe global regex ending at the array's `[`; every
 * occurrence is tried, because a file may hold more than one such array and
 * only one of them need be a dump.
 */
function coOccursInArray(body, anchor, companions) {
  const re = new RegExp(anchor.source, `${anchor.flags.replace("g", "")}g`);
  for (let m = re.exec(body); m !== null; m = re.exec(body)) {
    const slice = jsonArrayAt(body, m.index + m[0].length - 1);
    if (companions.every((c) => c.test(slice))) return true;
  }
  return false;
}

/**
 * Patterns may be a regex (`re`) or a predicate (`test`).
 *
 * The storage-state entries are predicates on purpose: they need *co-occurrence*
 * of two independent shapes, and expressing that as one regex means a lazy
 * `[\s\S]{0,N}?` bridge between them — which is both unreadable and a
 * backtracking risk on a large file. A bracket-matched slice plus two linear
 * scans is neither, and it scopes the co-occurrence instead of merely bounding
 * the distance.
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
  //
  // Both conditions are checked *inside the array itself* rather than anywhere
  // in the file (#115) — see `coOccursInArray`. A dump keeps its keys and its
  // values in the same array; a document that merely mentions cookies does not.
  {
    name: "storage-state-cookies",
    test: (body) =>
      coOccursInArray(body, /"cookies"\s*:\s*\[/i, [
        /"(?:httpOnly|sameSite)"\s*:/i,
        SUBSTANTIAL_VALUE,
      ]),
  },
  {
    name: "storage-state-origins",
    // `localStorage` nests inside the origins array, and its entries carry the
    // values, so the whole shape lives within this one slice.
    test: (body) =>
      coOccursInArray(body, /"origins"\s*:\s*\[/i, [
        /"localStorage"\s*:\s*\[/i,
        SUBSTANTIAL_VALUE,
      ]),
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
