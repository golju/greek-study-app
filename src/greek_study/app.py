from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtWidgets import QApplication

from greek_study.config import AppSettings, default_data_dir
from greek_study.db.engine import get_session_factory
from greek_study.logging_config import configure_logging
from greek_study.services.ocr import configure_tesseract
from greek_study.ui.main_window import MainWindow


def main() -> None:
    data_dir = default_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    configure_logging(data_dir / "logs")

    settings = AppSettings.load(data_dir)
    configure_tesseract(settings.tesseract_cmd)

    db_path = data_dir / "app.db"
    session_factory = get_session_factory(db_path)

    app = QApplication(sys.argv)
    win = MainWindow(data_dir=data_dir, settings=settings, session_factory=session_factory)
    win.resize(1100, 720)
    win.show()
    raise SystemExit(app.exec())


if __name__ == "__main__":
    main()
