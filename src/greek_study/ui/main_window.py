from __future__ import annotations

from pathlib import Path

from PySide6.QtGui import QAction
from PySide6.QtWidgets import QCheckBox, QDialog, QDialogButtonBox, QLabel, QMainWindow, QMessageBox, QTabWidget, QVBoxLayout

from greek_study.config import AppSettings
from greek_study.ui.import_tab import ImportTab
from greek_study.ui.library_tab import LibraryTab
from greek_study.ui.train_tab import TrainTab


class MainWindow(QMainWindow):
    def __init__(self, *, data_dir: Path, settings: AppSettings, session_factory) -> None:
        super().__init__()
        self.data_dir = data_dir
        self.settings = settings
        self.session_factory = session_factory

        self.setWindowTitle("Greek Study — современный греческий (офлайн)")

        tabs = QTabWidget()
        self.train_tab = TrainTab(session_factory)
        self.library_tab = LibraryTab(
            session_factory,
            on_data_changed=self.train_tab.refresh_decks,
        )
        self.import_tab = ImportTab(data_dir, settings, session_factory)

        tabs.addTab(self.import_tab, "Импорт")
        tabs.addTab(self.train_tab, "Тренировка")
        tabs.addTab(self.library_tab, "Словарь / правила")

        self.setCentralWidget(tabs)
        self._build_menu()

    def _build_menu(self) -> None:
        menu = self.menuBar().addMenu("Настройки")
        privacy = QAction("Приватность…", self)
        privacy.triggered.connect(self._privacy_dialog)
        menu.addAction(privacy)

    def _privacy_dialog(self) -> None:
        dlg = QDialog(self)
        dlg.setWindowTitle("Приватность")
        layout = QVBoxLayout(dlg)
        layout.addWidget(
            QLabel(
                "По умолчанию приложение работает полностью офлайн. OCR использует "
                "локальный Tesseract. Внешние API в этой версии не вызываются."
            )
        )
        cb = QCheckBox("Разрешить внешние API (экспериментально; в текущей версии не используется)")
        cb.setChecked(self.settings.allow_external_api)
        layout.addWidget(cb)
        buttons = QDialogButtonBox(QDialogButtonBox.Save | QDialogButtonBox.Cancel)
        layout.addWidget(buttons)
        buttons.accepted.connect(dlg.accept)
        buttons.rejected.connect(dlg.reject)

        if dlg.exec() != QDialog.Accepted:
            return

        if cb.isChecked() and not self.settings.allow_external_api:
            res = QMessageBox.warning(
                self,
                "Внимание",
                "Включение внешних API может отправлять ваши данные на удалённые серверы. "
                "В этой сборке сетевые вызовы всё равно отключены, но флаг сохранён для будущих версий.",
                QMessageBox.StandardButton.Ok | QMessageBox.StandardButton.Cancel,
                QMessageBox.StandardButton.Cancel,
            )
            if res != QMessageBox.StandardButton.Ok:
                return

        self.settings.allow_external_api = cb.isChecked()
        self.settings.save(self.data_dir)

    def closeEvent(self, event) -> None:  # type: ignore[override]
        self.settings.save(self.data_dir)
        super().closeEvent(event)
