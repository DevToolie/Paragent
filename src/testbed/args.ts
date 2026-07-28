import { DEFAULT_HOST_PORT } from "./constants.js";

export interface CliArgs {
  version?: string;
  down: boolean;
  list: boolean;
  dryRun: boolean;
  port: number;
  skipSeed: boolean;
  help: boolean;
  verify: boolean;
  json: boolean;
  /** Versions to diff. One means "--version <X> vs this"; two means "these two". */
  compare?: string[];
}

/**
 * Trailing version ids after `--compare`. Accepts one or two, so both
 * `--version A --verify --compare B` and `--verify --compare A B` mean
 * "diff A against B".
 */
function takeVersions(argv: string[], at: number): string[] {
  const picked: string[] = [];
  while (picked.length < 2) {
    const next = argv[at + 1 + picked.length];
    if (next === undefined || next.startsWith("-")) break;
    picked.push(next);
  }
  if (picked.length === 0) {
    throw new Error(
      "--compare requires one or two matrix ids (e.g. --compare 11.0.0 12.0.0)",
    );
  }
  return picked;
}

export function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    down: false,
    list: false,
    dryRun: false,
    port: DEFAULT_HOST_PORT,
    skipSeed: false,
    help: false,
    verify: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    switch (a) {
      case "--help":
      case "-h":
        out.help = true;
        break;
      case "--list":
        out.list = true;
        break;
      case "--down":
        out.down = true;
        break;
      case "--dry-run":
        out.dryRun = true;
        break;
      case "--skip-seed":
        out.skipSeed = true;
        break;
      case "--verify":
        out.verify = true;
        break;
      case "--json":
        out.json = true;
        break;
      case "--compare": {
        const picked = takeVersions(argv, i);
        i += picked.length;
        out.compare = picked;
        break;
      }
      case "--version":
      case "-v": {
        const next = argv[++i];
        if (!next || next.startsWith("-")) {
          throw new Error("--version requires a matrix id (e.g. 11.0.0)");
        }
        out.version = next;
        break;
      }
      case "--port": {
        const next = argv[++i];
        if (!next || next.startsWith("-")) {
          throw new Error("--port requires a number");
        }
        const n = Number.parseInt(next, 10);
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(`invalid --port ${next}`);
        }
        out.port = n;
        break;
      }
      default:
        throw new Error(`unknown argument: ${a}`);
    }
  }
  return out;
}

export function usage(): string {
  return `paragent testbed — Grafana OSS Track-1 harness

Usage:
  npm run testbed -- --version <X> [--port 3000] [--dry-run] [--skip-seed]
  npm run testbed -- --version <X> --down
  npm run testbed -- --version <X> --verify [--json]
  npm run testbed -- --verify --compare <A> <B>
  npm run testbed -- --list
  npm run testbed -- --help

Options:
  --version <X>   Matrix version id (required unless --list/--help/--compare)
  --port <n>      Host port (default ${DEFAULT_HOST_PORT})
  --down          Tear down the compose project for --version
  --list          Print matrix versions
  --dry-run       Prepare overlay + print compose plan; do not call Docker daemon
  --skip-seed     Skip HTTP seed after up
  --verify        Read seeded state back and print a version-independent fingerprint
  --json          With --verify, also save the fingerprint under scripts/testbed/.runtime/
  --compare <A> <B>
                  With --verify, diff two saved fingerprints; exits 1 if they differ
  --help          Show this help
`;
}
