"""Texture override rule editor package."""

from __future__ import annotations

import importlib
from typing import NoReturn

__all__ = ["main"]


def main() -> NoReturn:
    """Entry-point wrapper that executes the package's main function."""

    module = importlib.import_module(".main", __name__)
    raise SystemExit(module.main())
