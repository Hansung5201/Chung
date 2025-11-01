"""Engine that applies rules to parsed sections."""
from __future__ import annotations

from typing import Iterable, List, Tuple

from editer_v2.parser import Section
from editer_v2.rules import Modification, Rule


def apply_rules(sections: Iterable[Section], rules: Iterable[Rule]) -> Tuple[List[Section], List[Modification]]:
    """Apply rules to sections and return modifications.

    Rules are executed in descending priority order.  Only one rule may modify
    a particular key within a section to avoid conflicting updates.
    """

    sorted_rules = sorted(rules, key=lambda rule: rule.priority, reverse=True)
    modifications: List[Modification] = []

    for section in sections:
        if section.name == "__preamble__":
            continue
        modified_keys: set[str] = set()
        for rule in sorted_rules:
            if not rule.matches_section(section):
                continue
            if rule.action_key in modified_keys:
                continue

            existing_lines = section.find_lines(rule.action_key)
            previous_value = None
            if existing_lines:
                previous_value = existing_lines[0].value
                existing_lines[0].update_value(rule.action_value)
            else:
                section.append_line(rule.action_key, rule.action_value)

            modified_keys.add(rule.action_key)
            modifications.append(
                Modification(
                    section_name=section.name,
                    rule_name=rule.name,
                    key=rule.action_key,
                    previous_value=previous_value,
                    new_value=rule.action_value,
                )
            )

    return list(sections), modifications
