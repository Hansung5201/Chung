"""Command-line entry point for the texture override editor package."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Iterable, List, Sequence

from .rule_engine import Rule, RuleCondition, apply_rules, parse_sections, render_sections


def _load_rules_from_payload(payload: Iterable[object]) -> List[Rule]:
    rules: List[Rule] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        try:
            conditions = [
                RuleCondition(
                    key=str(cond.get("key", "")),
                    match_type=str(cond.get("match_type", "contains")),
                    value=str(cond.get("value", "")),
                )
                for cond in item.get("conditions", [])
                if isinstance(cond, dict) and cond.get("key") and cond.get("value")
            ]
            rule = Rule(
                name=str(item["name"]),
                priority=int(item.get("priority", 0)),
                section_pattern=str(item["section_pattern"]),
                action_key=str(item.get("action_key", "run")),
                action_value=str(item["action_value"]),
                conditions=conditions,
            )
        except (KeyError, ValueError) as exc:
            raise ValueError(f"Invalid rule payload: {exc}") from exc
        rules.append(rule)
    return rules


def _load_rules_from_file(path: Path, encoding: str) -> List[Rule]:
    try:
        payload = json.loads(path.read_text(encoding=encoding))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Failed to parse JSON rule file {path}: {exc}") from exc
    if not isinstance(payload, list):
        raise ValueError("Rule file must contain a JSON array of rules")
    return _load_rules_from_payload(payload)


def _apply_rules_cli(input_path: Path, rules_path: Path, output_path: Path | None, encoding: str) -> int:
    try:
        text = input_path.read_text(encoding=encoding)
    except OSError as exc:
        print(f"Failed to read input file {input_path}: {exc}", file=sys.stderr)
        return 1
    try:
        rules = _load_rules_from_file(rules_path, encoding)
    except (OSError, ValueError) as exc:
        print(exc, file=sys.stderr)
        return 1
    sections = parse_sections(text)
    sections, modifications = apply_rules(sections, rules)
    output_text = render_sections(sections)
    if output_path is None:
        print(output_text)
    else:
        try:
            output_path.write_text(output_text, encoding=encoding)
        except OSError as exc:
            print(f"Failed to write output file {output_path}: {exc}", file=sys.stderr)
            return 1
    if modifications:
        for mod in modifications:
            print(mod.to_log_entry(), file=sys.stderr)
    else:
        print("No modifications applied.", file=sys.stderr)
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Texture override editor. Launch the GUI by default or apply rules from the command line."
        )
    )
    parser.add_argument(
        "--gui",
        action="store_true",
        help="Force launching the PyQt GUI (default behaviour if no other action is requested).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply rules to an input file using the command-line interface.",
    )
    parser.add_argument("--input", type=Path, help="Path to the input configuration file.")
    parser.add_argument("--rules", type=Path, help="Path to the JSON file containing rules.")
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional path to write the transformed configuration. Defaults to stdout.",
    )
    parser.add_argument(
        "--encoding",
        default="utf-8",
        help="Text encoding to use when reading and writing files (default: utf-8).",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    launch_gui = args.gui or not args.apply
    if args.apply:
        if args.input is None or args.rules is None:
            parser.error("--apply requires --input and --rules")
        return _apply_rules_cli(args.input, args.rules, args.output, args.encoding)

    if launch_gui:
        try:
            from . import gui
        except ModuleNotFoundError as exc:  # pragma: no cover - depends on environment
            print(
                "PyQt5 is required to launch the GUI. Install it with 'pip install PyQt5' or run with --apply for CLI mode.",
                file=sys.stderr,
            )
            return 1
        return gui.run()

    parser.print_help()
    return 0


if __name__ == "__main__":  # pragma: no cover - module executable
    raise SystemExit(main())
