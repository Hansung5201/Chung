"""PyQt based editor for managing texture override rules."""
from __future__ import annotations

import json
from pathlib import Path
from typing import List

from PyQt5.QtCore import Qt
from PyQt5.QtWidgets import (
    QApplication,
    QFileDialog,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QPlainTextEdit,
    QSizePolicy,
    QSpinBox,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
    QDialog,
    QDialogButtonBox,
    QComboBox,
)

from .rule_engine import (
    Rule,
    RuleCondition,
    apply_rules,
    parse_sections,
    render_sections,
)


class RuleDialog(QDialog):
    """Dialog to create or edit a rule."""

    def __init__(self, parent: QWidget | None = None, rule: Rule | None = None):
        super().__init__(parent)
        self.setWindowTitle("Rule Editor")
        self.resize(480, 360)

        layout = QVBoxLayout(self)

        form_layout = QVBoxLayout()

        self.name_edit = QLineEdit()
        self.section_pattern_edit = QLineEdit()
        self.action_key_edit = QLineEdit("run")
        self.action_value_edit = QLineEdit()
        self.priority_spin = QSpinBox()
        self.priority_spin.setRange(-9999, 9999)
        self.priority_spin.setValue(0)

        form_layout.addWidget(QLabel("Rule name"))
        form_layout.addWidget(self.name_edit)
        form_layout.addWidget(QLabel("Section name pattern (regex)"))
        form_layout.addWidget(self.section_pattern_edit)
        form_layout.addWidget(QLabel("Action key"))
        form_layout.addWidget(self.action_key_edit)
        form_layout.addWidget(QLabel("Action value"))
        form_layout.addWidget(self.action_value_edit)
        form_layout.addWidget(QLabel("Priority (higher numbers run first)"))
        form_layout.addWidget(self.priority_spin)

        layout.addLayout(form_layout)

        conditions_group = QGroupBox("Conditions")
        conditions_layout = QVBoxLayout(conditions_group)
        self.conditions_table = QTableWidget(0, 3)
        self.conditions_table.setHorizontalHeaderLabels(["Key", "Match type", "Value substring"])
        self.conditions_table.horizontalHeader().setStretchLastSection(True)
        self.conditions_table.verticalHeader().setVisible(False)
        self.conditions_table.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        buttons_layout = QHBoxLayout()
        add_condition_button = QPushButton("Add condition")
        remove_condition_button = QPushButton("Remove selected")
        buttons_layout.addWidget(add_condition_button)
        buttons_layout.addWidget(remove_condition_button)

        add_condition_button.clicked.connect(self.add_condition_row)
        remove_condition_button.clicked.connect(self.remove_selected_condition)

        conditions_layout.addWidget(self.conditions_table)
        conditions_layout.addLayout(buttons_layout)

        layout.addWidget(conditions_group)

        self.button_box = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        self.button_box.accepted.connect(self.accept)
        self.button_box.rejected.connect(self.reject)
        layout.addWidget(self.button_box)

        if rule is not None:
            self.load_rule(rule)

    def add_condition_row(self) -> None:
        row = self.conditions_table.rowCount()
        self.conditions_table.insertRow(row)
        self.conditions_table.setItem(row, 0, QTableWidgetItem())
        combo = QComboBox()
        combo.addItems(["contains", "equals", "startswith", "endswith"])
        self.conditions_table.setCellWidget(row, 1, combo)
        self.conditions_table.setItem(row, 2, QTableWidgetItem())

    def remove_selected_condition(self) -> None:
        row = self.conditions_table.currentRow()
        if row >= 0:
            self.conditions_table.removeRow(row)

    def load_rule(self, rule: Rule) -> None:
        self.name_edit.setText(rule.name)
        self.section_pattern_edit.setText(rule.section_pattern)
        self.action_key_edit.setText(rule.action_key)
        self.action_value_edit.setText(rule.action_value)
        self.priority_spin.setValue(rule.priority)
        for condition in rule.conditions:
            self.add_condition_row()
            row = self.conditions_table.rowCount() - 1
            self.conditions_table.item(row, 0).setText(condition.key)
            combo = self.conditions_table.cellWidget(row, 1)
            assert isinstance(combo, QComboBox)
            index = combo.findText(condition.match_type)
            combo.setCurrentIndex(max(index, 0))
            self.conditions_table.item(row, 2).setText(condition.value)

    def get_rule(self) -> Rule | None:
        name = self.name_edit.text().strip()
        section_pattern = self.section_pattern_edit.text().strip()
        action_key = self.action_key_edit.text().strip() or "run"
        action_value = self.action_value_edit.text().strip()
        if not name or not section_pattern or not action_value:
            QMessageBox.warning(self, "Missing information", "Name, section pattern and action value are required.")
            return None
        conditions: List[RuleCondition] = []
        for row in range(self.conditions_table.rowCount()):
            key_item = self.conditions_table.item(row, 0)
            value_item = self.conditions_table.item(row, 2)
            combo = self.conditions_table.cellWidget(row, 1)
            key = key_item.text().strip() if key_item else ""
            value = value_item.text().strip() if value_item else ""
            match_type = "contains"
            if isinstance(combo, QComboBox):
                match_type = combo.currentText()
            if key and value:
                conditions.append(RuleCondition(key=key, value=value, match_type=match_type))
        return Rule(
            name=name,
            section_pattern=section_pattern,
            action_key=action_key,
            action_value=action_value,
            priority=self.priority_spin.value(),
            conditions=conditions,
        )


class MainWindow(QMainWindow):
    """Main application window."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Texture Override Rule Editor")
        self.resize(1200, 720)

        self.rules: List[Rule] = []

        central_widget = QWidget()
        central_layout = QVBoxLayout(central_widget)
        self.setCentralWidget(central_widget)

        toolbar_layout = QHBoxLayout()
        self.load_button = QPushButton("Load file")
        self.save_button = QPushButton("Save output")
        self.import_rules_button = QPushButton("Import rules")
        self.export_rules_button = QPushButton("Export rules")
        self.apply_button = QPushButton("Apply rules")
        toolbar_layout.addWidget(self.load_button)
        toolbar_layout.addWidget(self.save_button)
        toolbar_layout.addWidget(self.import_rules_button)
        toolbar_layout.addWidget(self.export_rules_button)
        toolbar_layout.addStretch(1)
        toolbar_layout.addWidget(self.apply_button)
        central_layout.addLayout(toolbar_layout)

        splitter = QSplitter(Qt.Horizontal)
        central_layout.addWidget(splitter, 1)

        io_splitter = QSplitter(Qt.Vertical)
        splitter.addWidget(io_splitter)

        input_widget = QWidget()
        input_layout = QVBoxLayout(input_widget)
        input_layout.addWidget(QLabel("Input configuration"))
        self.input_edit = QPlainTextEdit()
        self.input_edit.setPlaceholderText("Paste texture override configuration here...")
        input_layout.addWidget(self.input_edit, 1)
        io_splitter.addWidget(input_widget)

        output_widget = QWidget()
        output_layout = QVBoxLayout(output_widget)
        output_layout.addWidget(QLabel("Output"))
        self.output_edit = QPlainTextEdit()
        self.output_edit.setReadOnly(True)
        output_layout.addWidget(self.output_edit, 1)
        output_widget.setMinimumHeight(200)
        io_splitter.addWidget(output_widget)

        rules_widget = QWidget()
        rules_layout = QVBoxLayout(rules_widget)
        splitter.addWidget(rules_widget)

        rules_layout.addWidget(QLabel("Rules"))
        self.rules_list = QListWidget()
        rules_layout.addWidget(self.rules_list, 1)

        buttons_layout = QHBoxLayout()
        self.add_rule_button = QPushButton("Add")
        self.edit_rule_button = QPushButton("Edit")
        self.delete_rule_button = QPushButton("Delete")
        buttons_layout.addWidget(self.add_rule_button)
        buttons_layout.addWidget(self.edit_rule_button)
        buttons_layout.addWidget(self.delete_rule_button)
        rules_layout.addLayout(buttons_layout)

        rules_layout.addWidget(QLabel("Modifications log"))
        self.log_edit = QPlainTextEdit()
        self.log_edit.setReadOnly(True)
        self.log_edit.setMaximumBlockCount(1000)
        rules_layout.addWidget(self.log_edit, 1)

        self.load_button.clicked.connect(self.load_file)
        self.save_button.clicked.connect(self.save_output)
        self.import_rules_button.clicked.connect(self.import_rules)
        self.export_rules_button.clicked.connect(self.export_rules)
        self.apply_button.clicked.connect(self.apply_rules_to_text)
        self.add_rule_button.clicked.connect(self.add_rule)
        self.edit_rule_button.clicked.connect(self.edit_selected_rule)
        self.delete_rule_button.clicked.connect(self.delete_selected_rule)

        self.update_rule_list()

    # region Rule management
    def add_rule(self) -> None:
        dialog = RuleDialog(self)
        if dialog.exec_() == QDialog.Accepted:
            rule = dialog.get_rule()
            if rule:
                self.rules.append(rule)
                self.update_rule_list()

    def edit_selected_rule(self) -> None:
        current_item = self.rules_list.currentItem()
        if current_item is None:
            return
        rule = current_item.data(Qt.UserRole)
        if rule not in self.rules:
            return
        index = self.rules.index(rule)
        dialog = RuleDialog(self, rule)
        if dialog.exec_() == QDialog.Accepted:
            new_rule = dialog.get_rule()
            if new_rule:
                self.rules[index] = new_rule
                self.update_rule_list()

    def delete_selected_rule(self) -> None:
        current_item = self.rules_list.currentItem()
        if current_item is None:
            return
        rule = current_item.data(Qt.UserRole)
        if rule not in self.rules:
            return
        index = self.rules.index(rule)
        del self.rules[index]
        self.update_rule_list()

    def update_rule_list(self) -> None:
        self.rules_list.clear()
        for rule in sorted(self.rules, key=lambda r: r.priority, reverse=True):
            item = QListWidgetItem(f"{rule.priority}: {rule.name}")
            item.setData(Qt.UserRole, rule)
            self.rules_list.addItem(item)

    # endregion

    def load_file(self) -> None:
        path, _ = QFileDialog.getOpenFileName(self, "Open configuration", str(Path.home()), "Config files (*.ini *.cfg *.txt);;All files (*)")
        if not path:
            return
        try:
            text = Path(path).read_text(encoding="utf-8")
        except OSError as exc:
            QMessageBox.critical(self, "Error", f"Failed to open file:\n{exc}")
            return
        self.input_edit.setPlainText(text)

    def save_output(self) -> None:
        path, _ = QFileDialog.getSaveFileName(self, "Save output", str(Path.home()), "Config files (*.ini *.cfg *.txt);;All files (*)")
        if not path:
            return
        try:
            Path(path).write_text(self.output_edit.toPlainText(), encoding="utf-8")
        except OSError as exc:
            QMessageBox.critical(self, "Error", f"Failed to save file:\n{exc}")

    def apply_rules_to_text(self) -> None:
        text = self.input_edit.toPlainText()
        sections = parse_sections(text)
        _, modifications = apply_rules(sections, self.rules)
        output = render_sections(sections)
        self.output_edit.setPlainText(output)
        if modifications:
            log_entries = "\n".join(mod.to_log_entry() for mod in modifications)
        else:
            log_entries = "No modifications applied."
        self.log_edit.setPlainText(log_entries)

    def closeEvent(self, event):  # type: ignore[override]
        if not self.rules:
            return super().closeEvent(event)
        answer = QMessageBox.question(
            self,
            "Save rules",
            "Do you want to export the current rules before exiting?",
            QMessageBox.Yes | QMessageBox.No | QMessageBox.Cancel,
            QMessageBox.No,
        )
        if answer == QMessageBox.Cancel:
            event.ignore()
            return
        if answer == QMessageBox.Yes:
            if not self.export_rules():
                event.ignore()
                return
        super().closeEvent(event)

    def import_rules(self) -> None:
        path, _ = QFileDialog.getOpenFileName(self, "Import rules", str(Path.home()), "JSON files (*.json);;All files (*)")
        if not path:
            return
        try:
            payload = json.loads(Path(path).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            QMessageBox.critical(self, "Error", f"Failed to load rules:\n{exc}")
            return
        if not isinstance(payload, list):
            QMessageBox.warning(self, "Invalid format", "Expected a list of rules in the JSON file.")
            return
        imported_rules: List[Rule] = []
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
                QMessageBox.warning(self, "Skipped rule", f"Failed to import a rule: {exc}")
                continue
            imported_rules.append(rule)
        if not imported_rules:
            QMessageBox.information(self, "No rules imported", "No valid rules were found in the selected file.")
            return
        self.rules.extend(imported_rules)
        self.update_rule_list()

    def export_rules(self) -> bool:
        path, _ = QFileDialog.getSaveFileName(self, "Export rules", str(Path.home()), "JSON files (*.json);;All files (*)")
        if not path:
            return False
        rules_payload = [
            {
                "name": rule.name,
                "priority": rule.priority,
                "section_pattern": rule.section_pattern,
                "action_key": rule.action_key,
                "action_value": rule.action_value,
                "conditions": [
                    {
                        "key": cond.key,
                        "match_type": cond.match_type,
                        "value": cond.value,
                    }
                    for cond in rule.conditions
                ],
            }
            for rule in self.rules
        ]
        try:
            Path(path).write_text(json.dumps(rules_payload, indent=2, ensure_ascii=False), encoding="utf-8")
        except OSError as exc:
            QMessageBox.critical(self, "Error", f"Failed to export rules:\n{exc}")
            return False
        return True


def main() -> None:
    app = QApplication([])
    window = MainWindow()
    window.show()
    app.exec_()


if __name__ == "__main__":
    main()
