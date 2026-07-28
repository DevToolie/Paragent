#!/usr/bin/env node
/**
 * Docs linter — enforces the CONTRIBUTING documentation standard and keeps
 * docs/README.md an honest map.
 *
 * CONTRIBUTING mandates YAML frontmatter on every doc and an Open-questions
 * section at the end; docs/README.md says "update this file when you add or
 * supersede a document". Both were enforced by hope, and INTEGRITY-AUDIT
 * E-09/E-10/E-11 logged the drift. For an agent picking this repo up cold,
 * docs/README.md IS the map — a silently stale map is worse than no map.
 *
 * Rules (all fail the build):
 *   frontmatter-missing     no `---` block at the top of the file
 *   frontmatter-missing-key a required key is absent
 *   frontmatter-bad-value   a value is outside its allowed set / date shape
 *   not-in-index            the doc is not linked from docs/README.md
 *   missing-open-questions  no trailing "Open questions / what I could not verify"
 *   broken-link             a relative link points at a path that does not exist
 *
 * Frontmatter here is a flat `key: value` list, so it is hand-parsed. A YAML
 * dependency is not warranted, and the repo takes no new ones for this.
 *
 * Usage: node scripts/lint-docs.mjs
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");
const INDEX = path.join(DOCS, "README.md");

const REQUIRED_KEYS = [
  "title",
  "doc_type",
  "status",
  "owner",
  "created",
  "updated",
  "confidence",
  "supersedes",
  "sources_verified",
];

// CONTRIBUTING is the doc-shape source of truth. `gate-result` is its spelling;
// `gate` is not allowed — see the PR that added this linter.
const ALLOWED = {
  doc_type: ["adr", "research", "spec", "gate-result", "pitch", "brief", "runbook"],
  status: ["draft", "review", "accepted", "superseded", "killed"],
  confidence: ["LOW", "MED", "HIGH"],
  sources_verified: ["true", "false"],
};

const DATE_KEYS = ["created", "updated"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OPEN_QUESTIONS = "## Open questions / what I could not verify";

/** @type {{file: string, line: number|null, rule: string, message: string}[]} */
const problems = [];

function report(file, line, rule, message) {
  problems.push({ file: rel(file), line, rule, message });
}

function rel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join("/");
}

function walkMarkdown(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(full));
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
  }
  return out.sort();
}

/**
 * Parse a leading `---` fenced block of flat `key: value` pairs.
 * Returns null when the file does not open with one.
 */
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;

  /** @type {Record<string, {value: string, line: number}>} */
  const fields = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i] ?? "";
    if (!line.trim()) continue;
    const at = line.indexOf(":");
    if (at === -1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    // Strip one layer of matching quotes — titles containing a colon need them.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    fields[key] = { value, line: i + 1 };
  }
  return { fields, endLine: end + 1 };
}

/** Body lines outside fenced code blocks, so examples cannot trip link checks. */
function proseLines(text) {
  /** @type {{text: string, line: number}[]} */
  const out = [];
  let fenced = false;
  text.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (!fenced) out.push({ text: line, line: i + 1 });
  });
  return out;
}

/** Markdown link targets: `[text](target)`, skipping images' leading `!`. */
function linkTargets(lines) {
  /** @type {{target: string, line: number}[]} */
  const out = [];
  for (const { text, line } of lines) {
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      out.push({ target: m[1], line });
    }
  }
  return out;
}

/** Strip anchor/query and percent-decode. Empty means "same document". */
function linkPath(target) {
  const bare = target.split("#")[0].split("?")[0];
  try {
    return decodeURIComponent(bare);
  } catch {
    return bare;
  }
}

function checkFrontmatter(file, text) {
  const parsed = parseFrontmatter(text);
  if (!parsed) {
    report(
      file,
      1,
      "frontmatter-missing",
      "no YAML frontmatter — every doc opens with a `---` block carrying " +
        `${REQUIRED_KEYS.join(", ")} (see CONTRIBUTING "Documentation standard")`,
    );
    return;
  }

  const { fields, endLine } = parsed;
  for (const key of REQUIRED_KEYS) {
    if (!(key in fields)) {
      report(file, endLine, "frontmatter-missing-key", `missing required key \`${key}\``);
    }
  }

  for (const [key, allowed] of Object.entries(ALLOWED)) {
    const field = fields[key];
    if (!field) continue;
    if (!allowed.includes(field.value)) {
      report(
        file,
        field.line,
        "frontmatter-bad-value",
        `\`${key}: ${field.value}\` is not one of ${allowed.join(" | ")}`,
      );
    }
  }

  for (const key of DATE_KEYS) {
    const field = fields[key];
    if (!field) continue;
    if (!DATE_RE.test(field.value)) {
      report(
        file,
        field.line,
        "frontmatter-bad-value",
        `\`${key}: ${field.value}\` is not a YYYY-MM-DD date`,
      );
    }
  }

  for (const key of ["title", "owner", "supersedes"]) {
    const field = fields[key];
    if (field && field.value === "") {
      report(file, field.line, "frontmatter-bad-value", `\`${key}\` is empty`);
    }
  }
}

function checkOpenQuestions(file, text) {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === OPEN_QUESTIONS);
  if (at === -1) {
    report(
      file,
      lines.length,
      "missing-open-questions",
      `no \`${OPEN_QUESTIONS}\` heading — CONTRIBUTING requires every doc to end with one`,
    );
    return;
  }
  // "Ends with" — nothing but content may follow it.
  const later = lines.findIndex((l, i) => i > at && /^##\s/.test(l));
  if (later !== -1) {
    report(
      file,
      later + 1,
      "missing-open-questions",
      `\`${lines[later].trim()}\` comes after Open questions — that section must be last`,
    );
  }
}

function checkLinks(file, text) {
  const dir = path.dirname(file);
  for (const { target, line } of linkTargets(proseLines(text))) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // http:, mailto:, …
    if (target.startsWith("//")) continue;
    const bare = linkPath(target);
    if (!bare) continue; // pure anchor, same document
    const resolved = path.resolve(dir, bare);
    if (!existsSync(resolved)) {
      report(file, line, "broken-link", `\`${target}\` does not exist`);
    }
  }
}

function checkIndexed(file, indexed) {
  const relative = path.relative(DOCS, file).split(path.sep).join("/");
  if (!indexed.has(relative)) {
    report(
      file,
      null,
      "not-in-index",
      `not linked from docs/README.md — add a row (link target \`${relative}\`)`,
    );
  }
}

/** Every docs-relative path docs/README.md links to. */
function indexTargets() {
  const text = readFileSync(INDEX, "utf8");
  /** @type {Set<string>} */
  const out = new Set();
  for (const { target } of linkTargets(proseLines(text))) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const bare = linkPath(target);
    if (!bare) continue;
    const resolved = path.resolve(DOCS, bare);
    out.add(path.relative(DOCS, resolved).split(path.sep).join("/"));
  }
  return out;
}

function main() {
  if (!existsSync(DOCS) || !statSync(DOCS).isDirectory()) {
    console.error("lint-docs: docs/ not found");
    process.exit(1);
  }
  if (!existsSync(INDEX)) {
    console.error("lint-docs: docs/README.md not found — it is the index");
    process.exit(1);
  }

  const files = walkMarkdown(DOCS);
  const indexed = indexTargets();

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    checkFrontmatter(file, text);
    checkOpenQuestions(file, text);
    checkLinks(file, text);
    // The index cannot list itself.
    if (file !== INDEX) checkIndexed(file, indexed);
  }

  if (problems.length > 0) {
    problems.sort(
      (a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0),
    );
    for (const p of problems) {
      const where = p.line == null ? p.file : `${p.file}:${p.line}`;
      console.error(`${where}  ${p.rule}  ${p.message}`);
    }
    console.error(
      `\nlint-docs: ${problems.length} problem(s) in ${files.length} doc(s). ` +
        "Fix the shape, not the finding — never edit a number or a verdict to silence this.",
    );
    process.exit(1);
  }

  console.log(`lint-docs: clean (${files.length} docs)`);
}

main();
