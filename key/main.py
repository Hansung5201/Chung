from __future__ import annotations
import json
import sys
from pathlib import Path
from typing import List, Dict, Any

from PyQt5.QtCore import Qt
from PyQt5.QtWidgets import (
    QApplication,
    QDialog,
    QFileDialog,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMenu,
    QMessageBox,
    QPushButton,
    QSpinBox,
    QTableWidget,
    QTableWidgetItem,
    QToolBar,
    QVBoxLayout,
    QWidget,
)


class EntryDialog(QDialog):
    """Dialog for creating or editing a single entry."""

    def __init__(self, parent=None, *, index: int | None = None, question: str = "", answer: str = "") -> None:
        super().__init__(parent)
        self.setWindowTitle("항목 편집")
        self._build_ui(index, question, answer)

    def _build_ui(self, index: int | None, question: str, answer: str) -> None:
        layout = QVBoxLayout(self)

        form_layout = QGridLayout()
        layout.addLayout(form_layout)

        index_label = QLabel("Index")
        self.index_input = QSpinBox()
        self.index_input.setMaximum(10 ** 9)
        if index is not None:
            self.index_input.setValue(index)
        form_layout.addWidget(index_label, 0, 0)
        form_layout.addWidget(self.index_input, 0, 1)

        question_label = QLabel("Question")
        self.question_input = QLineEdit(question)
        form_layout.addWidget(question_label, 1, 0)
        form_layout.addWidget(self.question_input, 1, 1)

        answer_label = QLabel("Answer")
        self.answer_input = QLineEdit(answer)
        form_layout.addWidget(answer_label, 2, 0)
        form_layout.addWidget(self.answer_input, 2, 1)

        button_box = QHBoxLayout()
        layout.addLayout(button_box)

        cancel_button = QPushButton("취소")
        cancel_button.clicked.connect(self.reject)
        button_box.addWidget(cancel_button)

        save_button = QPushButton("저장")
        save_button.clicked.connect(self._on_accept)
        save_button.setDefault(True)
        button_box.addWidget(save_button)

    def _on_accept(self) -> None:
        if not self.question_input.text().strip():
            QMessageBox.warning(self, "입력 오류", "Question 값을 입력해 주세요.")
            return
        if not self.answer_input.text().strip():
            QMessageBox.warning(self, "입력 오류", "Answer 값을 입력해 주세요.")
            return
        self.accept()

    def entry_data(self) -> Dict[str, Any]:
        return {
            "index": self.index_input.value(),
            "question": self.question_input.text().strip(),
            "answer": self.answer_input.text().strip(),
        }


class JsonEditor(QMainWindow):
    FILE_FILTER = "JSON files (*.json)"

    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("JSON 문제 편집기")
        self.resize(720, 480)
        self.entries: List[Dict[str, Any]] = []
        self.current_file: Path | None = None

        self.table = QTableWidget(0, 3)
        self.table.setHorizontalHeaderLabels(["Index", "Question", "Answer"])
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.verticalHeader().setVisible(False)
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)

        main_widget = QWidget()
        main_layout = QVBoxLayout(main_widget)
        main_layout.addWidget(self.table)

        button_bar = QHBoxLayout()
        main_layout.addLayout(button_bar)

        add_button = QPushButton("추가")
        add_button.clicked.connect(self.add_entry)
        button_bar.addWidget(add_button)

        edit_button = QPushButton("수정")
        edit_button.clicked.connect(self.edit_entry)
        button_bar.addWidget(edit_button)

        delete_button = QPushButton("삭제")
        delete_button.clicked.connect(self.delete_entry)
        button_bar.addWidget(delete_button)

        button_bar.addStretch()

        self.setCentralWidget(main_widget)

        self._create_menus()
        self._create_toolbar()

    # Menu and toolbar setup -------------------------------------------------
    def _create_menus(self) -> None:
        menu_bar = self.menuBar()

        file_menu = menu_bar.addMenu("파일")
        self._add_action(file_menu, "새로 만들기", self.new_file, "Ctrl+N")
        self._add_action(file_menu, "열기", self.open_file, "Ctrl+O")
        self._add_action(file_menu, "저장", self.save_file, "Ctrl+S")
        self._add_action(file_menu, "다른 이름으로 저장", self.save_file_as)
        file_menu.addSeparator()
        self._add_action(file_menu, "종료", self.close, "Ctrl+Q")

    def _create_toolbar(self) -> None:
        toolbar = QToolBar("도구")
        toolbar.setMovable(False)
        toolbar.addAction("새로 만들기", self.new_file)
        toolbar.addAction("열기", self.open_file)
        toolbar.addAction("저장", self.save_file)
        toolbar.addSeparator()
        toolbar.addAction("추가", self.add_entry)
        toolbar.addAction("수정", self.edit_entry)
        toolbar.addAction("삭제", self.delete_entry)
        self.addToolBar(Qt.TopToolBarArea, toolbar)

    def _add_action(self, menu: QMenu, title: str, slot, shortcut: str | None = None) -> None:
        action = menu.addAction(title)
        action.triggered.connect(slot)
        if shortcut:
            action.setShortcut(shortcut)

    # Entry handling ---------------------------------------------------------
    def add_entry(self) -> None:
        next_index = self._suggest_index()
        dialog = EntryDialog(self, index=next_index)
        if dialog.exec_() == QDialog.Accepted:
            new_entry = dialog.entry_data()
            if any(entry["index"] == new_entry["index"] for entry in self.entries):
                QMessageBox.warning(self, "중복 Index", "이미 사용 중인 Index 입니다.")
                return
            self.entries.append(new_entry)
            self.entries.sort(key=lambda e: e["index"])
            self._refresh_table()

    def edit_entry(self) -> None:
        row = self.table.currentRow()
        if row < 0:
            QMessageBox.information(self, "선택 필요", "수정할 항목을 선택해 주세요.")
            return
        entry = self.entries[row]
        dialog = EntryDialog(self, index=entry["index"], question=entry["question"], answer=entry["answer"])
        if dialog.exec_() == QDialog.Accepted:
            updated_entry = dialog.entry_data()
            if updated_entry["index"] != entry["index"] and any(
                e["index"] == updated_entry["index"] for e in self.entries
            ):
                QMessageBox.warning(self, "중복 Index", "이미 사용 중인 Index 입니다.")
                return
            self.entries[row] = updated_entry
            self.entries.sort(key=lambda e: e["index"])
            self._refresh_table()

    def delete_entry(self) -> None:
        row = self.table.currentRow()
        if row < 0:
            QMessageBox.information(self, "선택 필요", "삭제할 항목을 선택해 주세요.")
            return
        confirm = QMessageBox.question(self, "삭제 확인", "선택한 항목을 삭제하시겠습니까?")
        if confirm == QMessageBox.Yes:
            self.entries.pop(row)
            self._refresh_table()

    def _suggest_index(self) -> int:
        if not self.entries:
            return 1
        return max(entry["index"] for entry in self.entries) + 1

    # File operations --------------------------------------------------------
    def new_file(self) -> None:
        if self._maybe_save_changes():
            self.entries.clear()
            self.current_file = None
            self._refresh_table()
            self.statusBar().showMessage("새 파일이 준비되었습니다.", 3000)

    def open_file(self) -> None:
        if not self._maybe_save_changes():
            return
        file_path, _ = QFileDialog.getOpenFileName(self, "JSON 파일 열기", "", self.FILE_FILTER)
        if not file_path:
            return
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                data = json.load(file)
            if not isinstance(data, list):
                raise ValueError("JSON 구조가 list가 아닙니다.")
            for item in data:
                if not isinstance(item, dict) or not {"index", "question", "answer"} <= item.keys():
                    raise ValueError("항목 구조가 {index, question, answer} 형식이 아닙니다.")
            self.entries = [
                {"index": int(item["index"]), "question": str(item["question"]), "answer": str(item["answer"])}
                for item in data
            ]
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            QMessageBox.critical(self, "파일 오류", f"파일을 읽는 중 문제가 발생했습니다:\n{exc}")
            return
        self.current_file = Path(file_path)
        self.entries.sort(key=lambda e: e["index"])
        self._refresh_table()
        self.statusBar().showMessage(f"파일을 불러왔습니다: {self.current_file.name}", 3000)

    def save_file(self) -> None:
        if self.current_file is None:
            self.save_file_as()
            return
        self._write_entries(self.current_file)

    def save_file_as(self) -> None:
        file_path, _ = QFileDialog.getSaveFileName(self, "JSON 파일로 저장", "", self.FILE_FILTER)
        if not file_path:
            return
        target_path = Path(file_path)
        if target_path.suffix.lower() != ".json":
            target_path = target_path.with_suffix(".json")
        self._write_entries(target_path)
        self.current_file = target_path

    def _write_entries(self, path: Path) -> None:
        try:
            with open(path, "w", encoding="utf-8") as file:
                json.dump(self.entries, file, ensure_ascii=False, indent=2)
        except OSError as exc:
            QMessageBox.critical(self, "저장 오류", f"파일을 저장할 수 없습니다:\n{exc}")
            return
        self.statusBar().showMessage(f"저장되었습니다: {path.name}", 3000)

    # Utilities --------------------------------------------------------------
    def _refresh_table(self) -> None:
        self.table.setRowCount(len(self.entries))
        for row, entry in enumerate(self.entries):
            self.table.setItem(row, 0, QTableWidgetItem(str(entry["index"])) )
            self.table.setItem(row, 1, QTableWidgetItem(entry["question"]))
            self.table.setItem(row, 2, QTableWidgetItem(entry["answer"]))
        self.table.resizeColumnsToContents()

    def _maybe_save_changes(self) -> bool:
        if not self.entries:
            return True
        reply = QMessageBox.question(
            self,
            "변경 내용 저장",
            "변경 내용을 저장하시겠습니까?",
            QMessageBox.Yes | QMessageBox.No | QMessageBox.Cancel,
            QMessageBox.Yes,
        )
        if reply == QMessageBox.Cancel:
            return False
        if reply == QMessageBox.Yes:
            self.save_file()
        return True

    def closeEvent(self, event) -> None:  # type: ignore[override]
        if self._maybe_save_changes():
            event.accept()
        else:
            event.ignore()


def main() -> None:
    app = QApplication(sys.argv)
    editor = JsonEditor()
    editor.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
