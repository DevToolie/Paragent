"""Tests for the Paragent CLI."""

from paragent.cli import main


def test_hello(capsys) -> None:  # type: ignore[no-untyped-def]
    code = main(["hello", "DevToolie"])
    captured = capsys.readouterr()
    assert code == 0
    assert "DevToolie" in captured.out


def test_help_when_no_command(capsys) -> None:  # type: ignore[no-untyped-def]
    code = main([])
    captured = capsys.readouterr()
    assert code == 0
    assert "usage:" in captured.out.lower() or "Agent-first" in captured.out
