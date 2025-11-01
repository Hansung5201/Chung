"""Command line interface for the rule based editor."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Iterable, List

from editer_v2.engine import apply_rules
from editer_v2.parser import parse_sections, render_sections
from editer_v2.rules import Modification, Rule, RuleCondition


def load_rules_from_file(path: Path) -> List[Rule]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        # Allow wrapping the rule list in a "rules" key.
        rules_data = data.get("rules", [])
    else:
        rules_data = data

    rules: List[Rule] = []
    for entry in rules_data:
        conditions = [
            RuleCondition(
                key=condition["key"],
                value=condition["value"],
                match_type=condition.get("match_type", "contains"),
            )
            for condition in entry.get("conditions", [])
        ]
        rules.append(
            Rule(
                name=entry["name"],
                section_pattern=entry["section_pattern"],
                action_key=entry.get("action_key", "run"),
                action_value=entry["action_value"],
                priority=int(entry.get("priority", 0)),
                conditions=conditions,
            )
        )
    return rules


def load_rules(rule_paths: Iterable[Path]) -> List[Rule]:
    rules: List[Rule] = []
    for path in rule_paths:
        rules.extend(load_rules_from_file(path))
    return rules


def log_modifications(modifications: List[Modification], log_path: Path) -> None:
    payload = [mod.to_dict() for mod in modifications]
    log_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Apply prioritized rules to override files.")
    parser.add_argument("--input", "-i", type=Path, help="Input file path. Reads from stdin when omitted.")
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        help="Output file path. Writes to stdout when omitted.",
    )
    parser.add_argument(
        "--rules",
        "-r",
        type=Path,
        action="append",
        help="Path to a JSON file describing rules. Uses the bundled defaults when omitted.",
    )
    parser.add_argument(
        "--log",
        type=Path,
        help="Optional path to store a JSON log describing every modification that was made.",
    )
    parser.add_argument(
        "--list-rules",
        action="store_true",
        help="List the loaded rules and exit without processing any files.",
    )
    return parser


def read_input(input_path: Path | None) -> str:
    if input_path is None:
        return sys.stdin.read()
    return input_path.read_text(encoding="utf-8")


def write_output(output_path: Path | None, text: str) -> None:
    if output_path is None:
        sys.stdout.write(text)
        if text and not text.endswith("\n"):
            sys.stdout.write("\n")
        return
    output_path.write_text(text, encoding="utf-8")


def main(argv: List[str] | None = None) -> int:
    parser = build_argument_parser()
    args = parser.parse_args(argv)

    if args.rules:
        rule_paths = args.rules
    else:
        rule_paths = [Path(__file__).with_name("rules").joinpath("default_rules.json")]

    rules = load_rules(rule_paths)

    if args.list_rules:
        for rule in sorted(rules, key=lambda r: r.priority, reverse=True):
            sys.stdout.write(f"{rule.priority:>5} | {rule.name} | {rule.section_pattern} -> {rule.action_value}\n")
        return 0

    input_text = read_input(args.input)
    sections = parse_sections(input_text)
    updated_sections, modifications = apply_rules(sections, rules)
    output_text = render_sections(updated_sections)
    write_output(args.output, output_text)

    if args.log:
        log_modifications(modifications, args.log)
    else:
        for modification in modifications:
            sys.stderr.write(
                f"[{modification.section_name}] {modification.rule_name}: {modification.key} "
                f"{modification.previous_value or '<none>'} -> {modification.new_value}\n"
            )

    return 0


__all__ = ["main"]
