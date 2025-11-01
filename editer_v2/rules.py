"""Rule definitions for applying prioritized modifications to sections."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from editer_v2.parser import Section


@dataclass(order=True)
class RuleCondition:
    """Condition that must be satisfied for a rule to trigger."""

    key: str
    value: str
    match_type: str = "contains"

    def matches(self, candidate: str) -> bool:
        candidate = candidate or ""
        if self.match_type == "equals":
            return candidate == self.value
        if self.match_type == "startswith":
            return candidate.startswith(self.value)
        if self.match_type == "endswith":
            return candidate.endswith(self.value)
        return self.value in candidate


@dataclass(order=True)
class Rule:
    """A transformation rule with a priority and optional conditions."""

    priority: int
    name: str
    section_pattern: str
    action_key: str
    action_value: str
    conditions: List[RuleCondition] = field(default_factory=list)

    def matches_section(self, section: Section) -> bool:
        import re

        if not re.search(self.section_pattern, section.name):
            return False
        for condition in self.conditions:
            lines = section.find_lines(condition.key)
            if not lines:
                return False
            if not any(condition.matches(line.value or "") for line in lines):
                return False
        return True


@dataclass
class Modification:
    """Represents a modification performed by the rule engine."""

    section_name: str
    rule_name: str
    key: str
    previous_value: Optional[str]
    new_value: str

    def to_dict(self) -> dict:
        return {
            "section": self.section_name,
            "rule": self.rule_name,
            "key": self.key,
            "previous_value": self.previous_value,
            "new_value": self.new_value,
        }

