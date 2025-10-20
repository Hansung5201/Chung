from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List

CHO = [
    "ᄀ",
    "ᄁ",
    "ᄂ",
    "ᄃ",
    "ᄄ",
    "ᄅ",
    "ᄆ",
    "ᄇ",
    "ᄈ",
    "ᄉ",
    "ᄊ",
    "ᄋ",
    "ᄌ",
    "ᄍ",
    "ᄎ",
    "ᄏ",
    "ᄐ",
    "ᄑ",
    "ᄒ",
]

JUNG = [
    "ᅡ",
    "ᅢ",
    "ᅣ",
    "ᅤ",
    "ᅥ",
    "ᅦ",
    "ᅧ",
    "ᅨ",
    "ᅩ",
    "ᅪ",
    "ᅫ",
    "ᅬ",
    "ᅭ",
    "ᅮ",
    "ᅯ",
    "ᅰ",
    "ᅱ",
    "ᅲ",
    "ᅳ",
    "ᅴ",
    "ᅵ",
]

JONG = [
    "",
    "ᆨ",
    "ᆩ",
    "ᆪ",
    "ᆫ",
    "ᆬ",
    "ᆭ",
    "ᆮ",
    "ᆯ",
    "ᆰ",
    "ᆱ",
    "ᆲ",
    "ᆳ",
    "ᆴ",
    "ᆵ",
    "ᆶ",
    "ᆷ",
    "ᆸ",
    "ᆹ",
    "ᆺ",
    "ᆻ",
    "ᆼ",
    "ᆽ",
    "ᆾ",
    "ᆿ",
    "ᇀ",
    "ᇁ",
    "ᇂ",
]

HANGUL_BASE = 0xAC00
HANGUL_LAST = 0xD7A3


def decompose_hangul(char: str) -> List[str]:
    """Return the jamo sequence for a Hangul syllable or the char itself."""
    if not char:
        return [""]
    code_point = ord(char)
    if HANGUL_BASE <= code_point <= HANGUL_LAST:
        syllable_index = code_point - HANGUL_BASE
        cho_index = syllable_index // (21 * 28)
        jung_index = (syllable_index % (21 * 28)) // 28
        jong_index = syllable_index % 28
        result = [CHO[cho_index], JUNG[jung_index]]
        jong_char = JONG[jong_index]
        if jong_char:
            result.append(jong_char)
        return result
    return [char]


@dataclass(slots=True)
class Entry:
    index: int
    question: str
    answer: str


class AnswerNavigator:
    """Stateful helper for revealing an answer one unit at a time."""

    def __init__(self, text: str) -> None:
        self._units = [decompose_hangul(char) for char in text]
        self.reset()

    def reset(self) -> None:
        self._next_char = 0
        self._next_jamo = 0
        self._rendered: List[str] = []

    @property
    def rendered_text(self) -> str:
        return "".join(self._rendered)

    def remaining(self) -> int:
        if not self._units:
            return 0
        remaining_units = 0
        if self._next_char < len(self._units):
            current = self._units[self._next_char]
            remaining_units += len(current) - self._next_jamo
            for units in self._units[self._next_char + 1 :]:
                remaining_units += len(units)
        return remaining_units

    def next_unit(self) -> str | None:
        if not self._units:
            return None
        if self._next_char >= len(self._units):
            return None
        current_units = self._units[self._next_char]
        if not current_units:
            self._next_char += 1
            self._next_jamo = 0
            return self.next_unit()
        unit = current_units[self._next_jamo]
        self._rendered.append(unit)
        self._next_jamo += 1
        if self._next_jamo >= len(current_units):
            self._next_char += 1
            self._next_jamo = 0
        return unit


class EntrySet:
    def __init__(self, entries: Iterable[Entry]):
        self._entries = sorted(entries, key=lambda item: item.index)
        self._index_map = {entry.index: entry for entry in self._entries}

    def __iter__(self):
        return iter(self._entries)

    def get(self, index: int) -> Entry | None:
        return self._index_map.get(index)


def load_entries(path: Path) -> EntrySet:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"JSON 파일을 해석할 수 없습니다: {exc}") from exc
    except OSError as exc:
        raise SystemExit(f"JSON 파일을 읽을 수 없습니다: {exc}") from exc

    if not isinstance(payload, list):
        raise SystemExit("JSON 루트는 배열이어야 합니다.")

    entries: List[Entry] = []
    for idx, raw in enumerate(payload, start=1):
        if not isinstance(raw, dict):
            raise SystemExit(f"항목 #{idx}가 객체가 아닙니다: {raw!r}")
        question = raw.get("question")
        answer = raw.get("answer")
        if question is None or answer is None:
            raise SystemExit(f"항목 #{idx}에 question/answer 값이 필요합니다.")
        if not isinstance(question, str) or not isinstance(answer, str):
            raise SystemExit(f"항목 #{idx}의 question/answer는 문자열이어야 합니다.")
        entry_index = raw.get("index")
        if entry_index is None:
            entry_index = idx
        try:
            normalized_index = int(entry_index)
        except (TypeError, ValueError) as exc:
            raise SystemExit(f"항목 #{idx}의 index 값을 정수로 변환할 수 없습니다: {entry_index!r}") from exc
        entries.append(Entry(index=normalized_index, question=question, answer=answer))

    seen = set()
    for entry in entries:
        if entry.index in seen:
            raise SystemExit(f"중복된 index 값이 존재합니다: {entry.index}")
        seen.add(entry.index)

    return EntrySet(entries)


def print_help() -> None:
    print(
        """사용 가능한 명령:
  list                - 모든 항목의 index와 질문을 표시합니다.
  select <index>      - 출력할 항목을 선택합니다.
  question            - 선택한 항목의 질문을 다시 보여줍니다.
  next                - 다음 글자(자모 단위)를 출력합니다.
  answer              - 현재까지 출력된 글자를 보여줍니다.
  restart             - 선택한 항목을 처음부터 다시 출력합니다.
  remaining           - 남은 글자 수를 확인합니다.
  help                - 이 도움말을 다시 확인합니다.
  exit / quit         - 프로그램을 종료합니다.
"""
    )


def interactive_session(entries: EntrySet) -> None:
    print("JSON 입력 도구입니다. 'help' 명령으로 사용법을 확인하세요.")
    current_entry: Entry | None = None
    navigator: AnswerNavigator | None = None

    while True:
        try:
            raw_command = input("명령 입력> ").strip()
        except EOFError:
            print()
            break
        except KeyboardInterrupt:
            print("\n종료합니다.")
            break

        if not raw_command:
            continue

        parts = raw_command.split()
        command = parts[0].lower()

        if command in {"exit", "quit"}:
            break
        if command == "help":
            print_help()
            continue
        if command == "list":
            for entry in entries:
                print(f"#{entry.index}: {entry.question}")
            continue
        if command == "select":
            if len(parts) != 2:
                print("사용법: select <index>")
                continue
            try:
                requested_index = int(parts[1])
            except ValueError:
                print("index 값은 정수여야 합니다.")
                continue
            selected = entries.get(requested_index)
            if selected is None:
                print(f"index {requested_index} 항목을 찾을 수 없습니다.")
                continue
            current_entry = selected
            navigator = AnswerNavigator(selected.answer)
            print(f"#{selected.index}번 항목을 선택했습니다. 질문: {selected.question}")
            if not selected.answer:
                print("이 항목에는 출력할 답변이 없습니다.")
            else:
                print("'next' 명령으로 글자를 순차적으로 출력할 수 있습니다.")
            continue
        if command == "question":
            if current_entry is None:
                print("먼저 항목을 선택해 주세요. (select <index>)")
            else:
                print(f"#{current_entry.index} 질문: {current_entry.question}")
            continue
        if command == "next":
            if navigator is None:
                print("먼저 항목을 선택해 주세요. (select <index>)")
                continue
            unit = navigator.next_unit()
            if unit is None:
                print("모든 글자를 이미 출력했습니다.")
            else:
                print(unit)
            continue
        if command == "answer":
            if navigator is None:
                print("먼저 항목을 선택해 주세요. (select <index>)")
            else:
                print(navigator.rendered_text or "아직 출력된 글자가 없습니다.")
            continue
        if command == "restart":
            if navigator is None:
                print("먼저 항목을 선택해 주세요. (select <index>)")
            else:
                navigator.reset()
                print("출력 상태를 초기화했습니다.")
            continue
        if command == "remaining":
            if navigator is None:
                print("먼저 항목을 선택해 주세요. (select <index>)")
            else:
                print(f"남은 글자 수(자모 단위): {navigator.remaining()}")
            continue

        print(f"알 수 없는 명령입니다: {command}. 'help'를 입력해 보세요.")


def parse_arguments(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="JSON 파일 기반 입력 도구")
    parser.add_argument(
        "json_path",
        nargs="?",
        default=Path(__file__).with_name("qa.json"),
        type=Path,
        help="질문/답변 JSON 파일 경로 (기본값: qa.json)",
    )
    return parser.parse_args(argv)


def main(argv: List[str] | None = None) -> None:
    args = parse_arguments(argv or sys.argv[1:])
    entries = load_entries(args.json_path)
    interactive_session(entries)


if __name__ == "__main__":
    main()
