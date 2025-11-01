"""Rule engine and parser for texture override configuration files."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Iterable


@dataclass
class SectionLine:
    """Represents a single line inside a section."""

    original: str
    key: Optional[str] = None
    value: Optional[str] = None

    @classmethod
    def from_text(cls, text: str) -> "SectionLine":
        stripped = text.strip()
        if "=" in stripped:
            key, value = stripped.split("=", 1)
            return cls(original=text, key=key.strip(), value=value.strip())
        return cls(original=text)

    def update_value(self, new_value: str) -> None:
        if self.key is None:
            raise ValueError("Cannot update value on non key/value line")
        self.value = new_value
        self.original = f"{self.key} = {new_value}"


@dataclass
class Section:
    """Represents a configuration section (e.g. [TextureOverride...])."""

    name: str
    header: str
    lines: List[SectionLine] = field(default_factory=list)

    def find_lines(self, key: str) -> List[SectionLine]:
        return [line for line in self.lines if line.key == key]

    def append_line(self, key: str, value: str) -> SectionLine:
        line = SectionLine(original=f"{key} = {value}", key=key, value=value)
        self.lines.append(line)
        return line

    def to_text(self) -> str:
        body = "\n".join(line.original for line in self.lines)
        if body:
            return f"{self.header}\n{body}"
        return self.header


@dataclass(order=True)
class RuleCondition:
    """A single condition that must be satisfied to trigger a rule."""

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
    """A transformation rule with priority and matching conditions."""

    priority: int
    name: str
    section_pattern: str
    action_key: str
    action_value: str
    conditions: List[RuleCondition] = field(default_factory=list)

    def matches_section(self, section: Section) -> bool:
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
    """Represents the result of applying a rule to a section."""

    section_name: str
    rule_name: str
    key: str
    previous_value: Optional[str]
    new_value: str

    def to_log_entry(self) -> str:
        previous = self.previous_value if self.previous_value is not None else "<none>"
        return (
            f"[{self.section_name}] {self.rule_name}: {self.key} "
            f"{previous} -> {self.new_value}"
        )


def parse_sections(text: str) -> List[Section]:
    sections: List[Section] = []
    current: Optional[Section] = None
    for raw_line in text.splitlines():
        if raw_line.strip().startswith("[") and raw_line.strip().endswith("]"):
            section_name = raw_line.strip()[1:-1]
            current = Section(name=section_name, header=raw_line)
            sections.append(current)
        elif current is not None:
            current.lines.append(SectionLine.from_text(raw_line))
        else:
            # lines before the first section are kept as a pseudo-section
            pseudo = Section(name="__preamble__", header="", lines=[SectionLine.from_text(raw_line)])
            sections.append(pseudo)
            current = pseudo
    return sections


def render_sections(sections: Iterable[Section]) -> str:
    rendered: List[str] = []
    for section in sections:
        if section.name == "__preamble__":
            rendered.extend(line.original for line in section.lines)
        else:
            rendered.append(section.to_text())
    return "\n".join(rendered)


def apply_rules(sections: List[Section], rules: List[Rule]) -> Tuple[List[Section], List[Modification]]:
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
            previous_value: Optional[str] = None
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
    return sections, modifications
