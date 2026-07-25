import { DEFAULT_HOST_PORT } from "./constants.js";

export interface CliArgs {
  version?: string;
  down: boolean;
  list: boolean;
  dryRun: boolean;
  port: number;
  skipSeed: boolean;
  help: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    down: false,
    list: false,
    dryRun: false,
    port: DEFAULT_HOST_PORT,
    skipSeed: false,
    help: false,
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
  npm run testbed -- --list
  npm run testbed -- --help

Options:
  --version <X>   Matrix version id (required unless --list/--help)
  --port <n>      Host port (default ${DEFAULT_HOST_PORT})
  --down          Tear down the compose project for --version
  --list          Print matrix versions
  --dry-run       Prepare overlay + print compose plan; do not call Docker daemon
  --skip-seed     Skip HTTP seed after up
  --help          Show this help
`;
}
