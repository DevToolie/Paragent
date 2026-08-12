#!/usr/bin/env node
/**
 * The `paragent` binary (#134).
 *
 * Before this there was no way to try Paragent short of cloning the repo:
 * `package.json` was `private: true` with no `bin`, and the three CLIs ran
 * through `node --import tsx <path>` behind npm scripts. That is fine for a
 * contributor and a real barrier for someone evaluating the project in two
 * minutes, which is most people.
 *
 * ## One binary, three subcommands
 *
 * `paragent record|compile|testbed` rather than three top-level binaries. It
 * matches how the README already describes the pipeline (record → compile →
 * replay), and it keeps one name to install and one `--help` to read. Three
 * binaries would also mean three chances to collide with something already on a
 * user's PATH.
 *
 * ## Dispatch is argv splicing, not a re-parse
 *
 * Each subcommand module reads `process.argv.slice(2)` and parses its own flags.
 * This removes the subcommand token and hands the rest over untouched, so the
 * per-command flag surfaces stay owned by the modules that document them —
 * re-parsing here would create a second place for every flag to drift, and the
 * flags are the part most likely to change.
 *
 * The modules run their `main()` on import (they are scripts, not libraries with
 * a direct-run guard), so a dynamic `import()` *is* the invocation. That is
 * deliberate: it keeps this file a router and nothing else.
 */

const COMMANDS = {
  record: {
    module: "./recorder/cli.js",
    blurb: "Drive a browser and capture a trajectory (try --fixture first)",
  },
  compile: {
    module: "./compiler/cli.js",
    blurb: "Turn a trajectory into a compiled program bundle",
  },
  testbed: {
    module: "./testbed/cli.js",
    blurb: "Boot and seed a pinned Grafana OSS container (needs Docker)",
  },
} as const;

type Command = keyof typeof COMMANDS;

function isCommand(value: string): value is Command {
  return Object.prototype.hasOwnProperty.call(COMMANDS, value);
}

function usage(): string {
  const rows = (Object.keys(COMMANDS) as Command[])
    .map((name) => `  ${name.padEnd(9)}${COMMANDS[name].blurb}`)
    .join("\n");
  return `paragent — record a browser task once, replay it as a compiled program.

Usage: paragent <command> [options]

Commands:
${rows}

Run \`paragent <command> --help\` for a command's own options.

Try it with no setup and no site of your own:
  npx paragent record --fixture

Live browsing needs a browser binary Playwright downloads separately:
  npx playwright install chromium

Docs: https://github.com/DevToolie/Paragent
`;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (command === undefined || command === "--help" || command === "-h") {
    process.stdout.write(usage());
    // `--help` is a successful outcome of asking for help, not a usage error.
    // A bare invocation is the same thing: someone typed the name to find out
    // what it does.
    return;
  }

  if (command === "--version" || command === "-v") {
    // Read from the manifest rather than a constant duplicated here — a version
    // string that disagrees with the package is worse than none.
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const here = path.dirname(fileURLToPath(import.meta.url));
    // dist/src/cli.js → the package root is two levels up.
    const manifest = path.resolve(here, "..", "..", "package.json");
    const pkg = JSON.parse(await readFile(manifest, "utf8")) as { version?: string };
    process.stdout.write(`${pkg.version ?? "unknown"}\n`);
    return;
  }

  if (!isCommand(command)) {
    process.stderr.write(`paragent: unknown command "${command}"\n\n${usage()}`);
    process.exit(2);
    return;
  }

  // Hand the remaining argv to the subcommand exactly as it would have received
  // it when invoked directly, so its own parser and its own --help are the ones
  // the user meets.
  process.argv = [process.argv[0]!, process.argv[1]!, ...rest];
  await import(COMMANDS[command].module);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
