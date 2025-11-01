"""Texture override rule editor package."""

from __future__ import annotations

from typing import NoReturn

__all__ = ["main"]


def main() -> NoReturn:
    """Entry-point wrapper to defer heavy imports until needed."""

    from .main import main as _main

    _main()
