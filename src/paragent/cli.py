"""Command-line entrypoint for Paragent."""

from __future__ import annotations

import argparse
import sys

from paragent import __version__, greet


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="paragent",
        description="Agent-first developer tooling from DevToolie.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")

    sub = parser.add_subparsers(dest="command")

    hello = sub.add_parser("hello", help="Print a greeting (smoke-test command)")
    hello.add_argument("name", nargs="?", default="agent", help="Name to greet")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        return 0

    if args.command == "hello":
        print(greet(args.name))
        return 0

    parser.error(f"unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    sys.exit(main())
