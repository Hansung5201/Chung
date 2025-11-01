"""Parser utilities for texture override style configuration files."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, List, Optional


@dataclass
class SectionLine:
    """Represents a raw line in a section.

    The parser keeps the original text so that formatting comments are preserved
    when rendering sections back to text.  If a ``key = value`` pair is
    detected, the ``key`` and ``value`` attributes are populated; otherwise
    they remain ``None``.
    """

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
            raise ValueError("Cannot update a value for a non key/value line")
        self.value = new_value
        self.original = f"{self.key} = {new_value}"


@dataclass
class Section:
    """Represents a configuration section marked by ``[SectionName]``."""

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


def parse_sections(text: str) -> List[Section]:
    """Parse a configuration document into ``Section`` objects."""

    sections: List[Section] = []
    current: Optional[Section] = None
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            section_name = stripped[1:-1]
            current = Section(name=section_name, header=raw_line)
            sections.append(current)
        elif current is not None:
            current.lines.append(SectionLine.from_text(raw_line))
        else:
            # Lines before the first section are captured in a pseudo section so
            # they can be rendered back without data loss.
            pseudo = Section(name="__preamble__", header="", lines=[SectionLine.from_text(raw_line)])
            sections.append(pseudo)
            current = pseudo
    return sections


def render_sections(sections: Iterable[Section]) -> str:
    """Render sections back into text preserving original formatting."""

    rendered: List[str] = []
    for section in sections:
        if section.name == "__preamble__":
            rendered.extend(line.original for line in section.lines)
        else:
            rendered.append(section.to_text())
    return "\n".join(rendered)
