"""Core helpers for Paragent."""


def greet(name: str) -> str:
    """Return a short greeting.

    Args:
        name: Who to greet. Empty / whitespace falls back to "agent".

    Returns:
        A greeting string suitable for CLI or smoke tests.
    """
    cleaned = name.strip() or "agent"
    return f"Hello, {cleaned} — welcome to Paragent."
