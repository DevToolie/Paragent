# Paragent

**Agent-first developer tooling** from [DevToolie](https://github.com/DevToolie).

Paragent is the core library for building tools that work well for AI agents *and*
the humans supervising them.

> Status: early / alpha. APIs may change.

## Quick start

```bash
# Clone
git clone https://github.com/DevToolie/Paragent.git
cd Paragent

# Create a virtualenv and install (editable + dev tools)
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate

pip install -e ".[dev]"
```

### CLI

```bash
paragent --help
paragent hello
```

### Library

```python
from paragent import __version__, greet

print(__version__)
print(greet("world"))
```

## Development

```bash
# Lint
ruff check .

# Type-check
mypy

# Tests
pytest

# Coverage
pytest --cov=paragent --cov-report=term-missing
```

## Project layout

```
src/paragent/     # library + CLI
tests/            # pytest suite
.github/workflows # CI
```

## Contributing

See the org [contributing guide](https://github.com/DevToolie/.github/blob/main/CONTRIBUTING.md).
By contributing, you agree to the [Code of Conduct](https://github.com/DevToolie/.github/blob/main/CODE_OF_CONDUCT.md).

## Security

Please report vulnerabilities privately — see [SECURITY.md](https://github.com/DevToolie/.github/blob/main/SECURITY.md).

## License

[MIT](./LICENSE) © DevToolie
