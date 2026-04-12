from __future__ import annotations

import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image
from PySide6.QtCore import Qt
from PySide6.QtGui import QClipboard, QDragEnterEvent, QDropEvent, QPixmap
from PySide6.QtWidgets import (
    QAbstractItemView,
    QCheckBox,
    QComboBox,
    QFileDialog,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QMessageBox,
    QPlainTextEdit,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

from greek_study.config import AppSettings
from greek_study.db.models import BlockKind
from greek_study.services.cards import get_or_create_deck, materialize_cards_from_blocks, save_page_with_blocks
from greek_study.services.extraction import guess_kind, split_blocks
from greek_study.services.ocr import OcrError, run_ocr
from greek_study.services.storage import store_image_file

logger = logging.getLogger(__name__)


@dataclass
class PendingFile:
    path: Path


class BlockEditorRow(QWidget):
    def __init__(self, text: str, kind: BlockKind, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.include = True
        layout = QHBoxLayout(self)
        self.check = QCheckBox()
        self.check.setChecked(True)
        self.check.toggled.connect(self._on_toggle)
        self.kind = QComboBox()
        for bk in BlockKind:
            self.kind.addItem(bk.value, bk)
        idx = self.kind.findData(kind)
        self.kind.setCurrentIndex(max(0, idx))
        self.text = QPlainTextEdit()
        self.text.setPlainText(text)
        self.text.setMinimumHeight(90)
        self.text.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)
        layout.addWidget(self.check, 0)
        layout.addWidget(self.kind, 0)
        layout.addWidget(self.text, 1)

    def _on_toggle(self, checked: bool) -> None:
        self.include = checked

    def values(self) -> tuple[str, BlockKind, bool]:
        kind: BlockKind = self.kind.currentData()
        return self.text.toPlainText().strip(), kind, self.include


class ImportTab(QWidget):
    def __init__(self, data_dir: Path, settings: AppSettings, session_factory, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.data_dir = data_dir
        self.settings = settings
        self.session_factory = session_factory
        self.pending: list[PendingFile] = []
        self.current_path: Path | None = None
        self.block_rows: list[BlockEditorRow] = []

        self.setAcceptDrops(True)

        root = QVBoxLayout(self)
        top = QHBoxLayout()
        self.file_list = QListWidget()
        self.file_list.setSelectionMode(QAbstractItemView.SingleSelection)
        self.file_list.currentItemChanged.connect(self._on_file_selected)
        self.preview = QLabel("Перетащите изображения сюда или вставьте из буфера (Ctrl+V)")
        self.preview.setAlignment(Qt.AlignCenter)
        self.preview.setMinimumSize(360, 260)
        self.preview.setStyleSheet("border: 1px solid #888;")
        top.addWidget(self.file_list, 1)
        top.addWidget(self.preview, 2)
        root.addLayout(top)

        actions = QHBoxLayout()
        self.btn_add = QPushButton("Добавить файлы…")
        self.btn_add.clicked.connect(self._pick_files)
        self.btn_ocr = QPushButton("Распознать (OCR)")
        self.btn_ocr.clicked.connect(self._run_ocr)
        self.btn_save = QPushButton("Сохранить страницу и карточки")
        self.btn_save.clicked.connect(self._save_page)
        actions.addWidget(self.btn_add)
        actions.addWidget(self.btn_ocr)
        actions.addWidget(self.btn_save)
        root.addLayout(actions)

        deck_box = QGroupBox("Колода и теги для новых карточек")
        deck_form = QFormLayout(deck_box)
        self.deck_name = QLineEdit("Default")
        self.tags = QLineEdit()
        deck_form.addRow("Имя колоды", self.deck_name)
        deck_form.addRow("Теги (через запятую)", self.tags)
        root.addWidget(deck_box)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        self.blocks_host = QWidget()
        self.blocks_layout = QVBoxLayout(self.blocks_host)
        self.blocks_layout.addStretch(1)
        scroll.setWidget(self.blocks_host)
        root.addWidget(scroll, 1)

    def dragEnterEvent(self, event: QDragEnterEvent) -> None:
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
        else:
            super().dragEnterEvent(event)

    def dropEvent(self, event: QDropEvent) -> None:
        paths: list[Path] = []
        for url in event.mimeData().urls():
            if url.isLocalFile():
                paths.append(Path(url.toLocalFile()))
        self._add_paths(paths)
        event.acceptProposedAction()

    def keyPressEvent(self, event) -> None:  # type: ignore[override]
        if event.key() == Qt.Key_V and event.modifiers() & Qt.ControlModifier:
            self._paste_clipboard()
        else:
            super().keyPressEvent(event)

    def _paste_clipboard(self) -> None:
        clip = QClipboard()
        image = clip.image()
        if image.isNull():
            return
        tmp = Path(tempfile.gettempdir()) / "greek_study_clipboard.png"
        image.save(str(tmp), "PNG")
        self._add_paths([tmp])

    def _pick_files(self) -> None:
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Выберите изображения",
            str(Path.home()),
            "Images (*.png *.jpg *.jpeg *.tif *.tiff *.bmp);;All files (*.*)",
        )
        self._add_paths([Path(f) for f in files])

    def _add_paths(self, paths: list[Path]) -> None:
        for p in paths:
            if not p.exists() or not p.is_file():
                continue
            self.pending.append(PendingFile(path=p))
            self.file_list.addItem(str(p))
        if self.file_list.count() and self.file_list.currentRow() < 0:
            self.file_list.setCurrentRow(0)

    def _on_file_selected(self) -> None:
        item = self.file_list.currentItem()
        if not item:
            return
        path = Path(item.text())
        self.current_path = path
        pix = QPixmap(str(path))
        if pix.isNull():
            self.preview.setText("Не удалось открыть файл")
            return
        self.preview.setPixmap(pix.scaled(self.preview.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation))

    def resizeEvent(self, event) -> None:  # type: ignore[override]
        super().resizeEvent(event)
        if self.current_path:
            self._on_file_selected()

    def _clear_block_rows(self) -> None:
        for row in self.block_rows:
            self.blocks_layout.removeWidget(row)
            row.deleteLater()
        self.block_rows.clear()

    def _run_ocr(self) -> None:
        item = self.file_list.currentItem()
        if not item:
            QMessageBox.information(self, "OCR", "Сначала добавьте и выберите изображение.")
            return
        path = Path(item.text())
        try:
            with Image.open(path) as im:
                text = run_ocr(im)
        except OcrError as exc:
            logger.exception("OCR failed")
            QMessageBox.warning(self, "OCR", str(exc))
            return
        except Exception as exc:  # noqa: BLE001
            logger.exception("Unexpected OCR error")
            QMessageBox.critical(self, "OCR", f"Неожиданная ошибка: {exc}")
            return

        self._clear_block_rows()
        parts = split_blocks(text)
        for chunk in parts:
            row = BlockEditorRow(chunk, guess_kind(chunk))
            self.block_rows.append(row)
            self.blocks_layout.insertWidget(self.blocks_layout.count() - 1, row)

    def _save_page(self) -> None:
        item = self.file_list.currentItem()
        if not item:
            QMessageBox.information(self, "Сохранение", "Нет выбранного файла.")
            return
        path = Path(item.text())
        if not self.block_rows:
            QMessageBox.information(self, "Сохранение", "Сначала выполните OCR или добавьте блоки вручную.")
            return
        try:
            rel, w, h = store_image_file(path, self.data_dir / "images")
        except Exception as exc:  # noqa: BLE001
            logger.exception("Store image failed")
            QMessageBox.critical(self, "Сохранение", f"Не удалось сохранить файл: {exc}")
            return

        blocks: list[tuple[str, BlockKind, bool]] = [row.values() for row in self.block_rows]
        session = self.session_factory()
        try:
            deck = get_or_create_deck(session, self.deck_name.text())
            page = save_page_with_blocks(
                session,
                original_name=path.name,
                rel_path=rel,
                width=w,
                height=h,
                blocks=blocks,
            )
            created = materialize_cards_from_blocks(
                session,
                deck,
                page,
                default_tags=self.tags.text().strip(),
            )
            session.commit()
        except Exception as exc:  # noqa: BLE001
            session.rollback()
            logger.exception("Save page failed")
            QMessageBox.critical(self, "Сохранение", f"Ошибка базы данных: {exc}")
            return
        finally:
            session.close()

        QMessageBox.information(
            self,
            "Готово",
            f"Страница сохранена. Создано карточек: {created}.",
        )
