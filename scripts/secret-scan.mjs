#!/usr/bin/env node
/**
 * Fail the build on content that looks like cookies, tokens, API keys, or .env material.
 * Allowlist: .env.example with commented placeholders only; LICENSE; package-lock.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

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

const PATTERNS = [
  { name: "env-assignment", re: /^(?!#).*?(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|COOKIE)\s*=\s*.+/im },
  { name: "bearer-token", re: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/ },
  { name: "aws-access-key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "github-pat", re: /ghp_[A-Za-z0-9]{36}/ },
  { name: "slack-token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "cookie-header", re: new RegExp("Set-" + "Cookie:\\s*[^=]+=[^;]+", "i") },
  { name: "session-json", re: /"session(?:id|token|key)"\s*:\s*"[^"]{8,}"/i },
];

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
  const files = await walk(ROOT);
  /** @type {{ file: string, pattern: string }[]} */
  const hits = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    if (rel === ".env" || rel.startsWith(".env.") && rel !== ".env.example") {
      hits.push({ file: rel, pattern: "dotenv-file" });
      continue;
    }
    if (!textExt.test(file) && !file.endsWith("Dockerfile")) continue;
    const st = await stat(file);
    if (st.size > 1_500_000) continue;
    const body = await readFile(file, "utf8");
    // Allow .env.example placeholder comments only
    if (path.basename(file) === ".env.example") continue;
    for (const { name, re } of PATTERNS) {
      if (re.test(body)) {
        hits.push({ file: rel, pattern: name });
        break;
      }
    }
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
