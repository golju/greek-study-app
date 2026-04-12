from __future__ import annotations

import logging
from collections.abc import Callable
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QAbstractItemView,
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QFormLayout,
    QHBoxLayout,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from pydantic import ValidationError

from greek_study.db.models import Card
from greek_study.services.import_export import (
    CardDTO,
    DeckBundleV1,
    export_json_string,
    import_bundle,
    parse_bundle_json,
    unique_deck_name,
)

logger = logging.getLogger(__name__)


class EditCardDialog(QDialog):
    def __init__(self, card: Card, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Редактировать карточку")
        self.card = card
        layout = QFormLayout(self)
        self.front = QTextEdit()
        self.front.setPlainText(card.front)
        self.back = QTextEdit()
        self.back.setPlainText(card.back or "")
        self.tags = QLineEdit(card.tags or "")
        layout.addRow("Лицевая сторона", self.front)
        layout.addRow("Оборот", self.back)
        layout.addRow("Теги", self.tags)
        buttons = QDialogButtonBox(QDialogButtonBox.Save | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addRow(buttons)

    def values(self) -> tuple[str, str, str]:
        return self.front.toPlainText().strip(), self.back.toPlainText().strip(), self.tags.text().strip()


class LibraryTab(QWidget):
    def __init__(
        self,
        session_factory,
        *,
        on_data_changed: Callable[[], None] | None = None,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.session_factory = session_factory
        self.on_data_changed = on_data_changed

        layout = QVBoxLayout(self)
        top = QHBoxLayout()
        self.search = QLineEdit()
        self.search.setPlaceholderText("Поиск по лицу, обороту, тегам…")
        self.search.textChanged.connect(self.reload)
        top.addWidget(self.search, 1)
        self.btn_reload = QPushButton("Обновить")
        self.btn_reload.clicked.connect(self.reload)
        top.addWidget(self.btn_reload)
        layout.addLayout(top)

        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["ID", "Колода", "Лицо", "Оборот", "Теги"])
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        layout.addWidget(self.table)

        actions = QHBoxLayout()
        self.btn_edit = QPushButton("Редактировать…")
        self.btn_edit.clicked.connect(self.edit_selected)
        self.btn_export = QPushButton("Экспорт JSON…")
        self.btn_export.clicked.connect(self.export_file)
        self.btn_import = QPushButton("Импорт JSON…")
        self.btn_import.clicked.connect(self.import_file)
        actions.addWidget(self.btn_edit)
        actions.addStretch(1)
        actions.addWidget(self.btn_export)
        actions.addWidget(self.btn_import)
        layout.addLayout(actions)

        self.reload()

    def showEvent(self, event) -> None:  # type: ignore[override]
        super().showEvent(event)
        self.reload()

    def reload(self) -> None:
        needle = self.search.text().strip().lower()
        session = self.session_factory()
        try:
            stmt = select(Card).options(joinedload(Card.deck)).order_by(Card.id.desc())
            cards = session.scalars(stmt).all()
        finally:
            session.close()

        filtered: list[Card] = []
        for c in cards:
            blob = f"{c.front}\n{c.back}\n{c.tags}".lower()
            if not needle or needle in blob:
                filtered.append(c)

        self.table.setRowCount(0)
        for c in filtered:
            row = self.table.rowCount()
            self.table.insertRow(row)
            self._set_row(row, 0, str(c.id))
            self._set_row(row, 1, c.deck.name if c.deck else "")
            self._set_row(row, 2, c.front)
            self._set_row(row, 3, c.back or "")
            self._set_row(row, 4, c.tags or "")
            for col in range(5):
                item = self.table.item(row, col)
                if item:
                    item.setData(Qt.UserRole, c.id)
        self.table.resizeColumnsToContents()

    def _set_row(self, row: int, col: int, text: str) -> None:
        item = QTableWidgetItem(text.replace("\n", " ")[:500])
        item.setToolTip(text)
        self.table.setItem(row, col, item)

    def _selected_card_id(self) -> int | None:
        items = self.table.selectedItems()
        if not items:
            return None
        item = items[0]
        cid = item.data(Qt.UserRole)
        return int(cid) if cid is not None else None

    def edit_selected(self) -> None:
        cid = self._selected_card_id()
        if cid is None:
            QMessageBox.information(self, "Редактирование", "Выберите строку.")
            return
        session = self.session_factory()
        try:
            card = session.get(Card, cid)
            if not card:
                return
            dlg = EditCardDialog(card, self)
            if dlg.exec() != QDialog.Accepted:
                return
            front, back, tags = dlg.values()
            card.front = front
            card.back = back
            card.tags = tags
            session.commit()
        except Exception as exc:  # noqa: BLE001
            session.rollback()
            logger.exception("Edit failed")
            QMessageBox.critical(self, "Ошибка", str(exc))
            return
        finally:
            session.close()
        self.reload()
        if self.on_data_changed:
            self.on_data_changed()

    def export_file(self) -> None:
        path_str, _ = QFileDialog.getSaveFileName(self, "Экспорт", str(Path.home() / "greek-study-export.json"), "JSON (*.json)")
        if not path_str:
            return
        session = self.session_factory()
        try:
            payload = export_json_string(session)
        finally:
            session.close()
        Path(path_str).write_text(payload, encoding="utf-8")
        QMessageBox.information(self, "Экспорт", "Файл сохранён.")

    def import_file(self) -> None:
        path_str, _ = QFileDialog.getOpenFileName(self, "Импорт", str(Path.home()), "JSON (*.json)")
        if not path_str:
            return
        raw = Path(path_str).read_text(encoding="utf-8")
        try:
            bundle = parse_bundle_json(raw)
        except ValidationError as exc:
            QMessageBox.critical(self, "Импорт", f"Некорректный JSON: {exc}")
            return
        session = self.session_factory()
        try:
            # Avoid accidental name collisions with existing decks by renaming imported deck names if needed.
            renamed: dict[str, str] = {}
            for dto in bundle.cards:
                if dto.deck not in renamed:
                    renamed[dto.deck] = unique_deck_name(session, dto.deck)
            adjusted_cards = []
            for dto in bundle.cards:
                adjusted_cards.append(
                    CardDTO(
                        deck=renamed[dto.deck],
                        front=dto.front,
                        back=dto.back,
                        tags=dto.tags,
                        card_type=dto.card_type,
                        explanation=dto.explanation,
                    )
                )

            fixed = DeckBundleV1(version=1, exported_at=bundle.exported_at, cards=adjusted_cards)
            decks_created, cards_created = import_bundle(session, fixed)
            session.commit()
        except Exception as exc:  # noqa: BLE001
            session.rollback()
            logger.exception("Import failed")
            QMessageBox.critical(self, "Импорт", str(exc))
            return
        finally:
            session.close()
        QMessageBox.information(
            self,
            "Импорт",
            f"Импортировано колод (новых имён): {decks_created}, карточек: {cards_created}.",
        )
        self.reload()
        if self.on_data_changed:
            self.on_data_changed()

