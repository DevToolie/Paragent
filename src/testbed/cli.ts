/**
 * Placeholder CLI for B1. Real implementation: `npm run testbed -- --version <X>`
 */
export const PACKAGE = "testbed-cli" as const;

const args = process.argv.slice(2);
if (args.includes("--help") || args.length === 0) {
  console.log(`paragent testbed (stub — B1 replaces this)

Usage: npm run testbed -- --version <X>

Brings up a seeded instance of the chosen console version from the matrix.`);
  process.exit(0);
}

console.error(
  "testbed stub: not implemented. See docs/gate/testbed.md (B1) and ADR-0003.",
);
process.exit(2);
