"""Tests for paragent.core."""

from paragent import __version__, greet
from paragent.core import greet as greet_direct


def test_version() -> None:
    assert __version__ == "0.1.0"


def test_greet_defaultish() -> None:
    assert greet("world") == "Hello, world — welcome to Paragent."


def test_greet_strips_and_fallback() -> None:
    assert greet_direct("  ") == "Hello, agent — welcome to Paragent."
    assert greet_direct("") == "Hello, agent — welcome to Paragent."
