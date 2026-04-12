from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path


def default_data_dir() -> Path:
    override = os.environ.get("GREEK_STUDY_DATA_DIR")
    if override:
        return Path(override).expanduser().resolve()
    return Path.home() / ".greek_study"


@dataclass
class AppSettings:
    """Persisted user settings (privacy-first defaults)."""

    allow_external_api: bool = False
    tesseract_cmd: str | None = None

    @staticmethod
    def path(data_dir: Path) -> Path:
        return data_dir / "settings.json"

    @classmethod
    def load(cls, data_dir: Path) -> "AppSettings":
        p = cls.path(data_dir)
        if not p.exists():
            return cls()
        try:
            raw = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return cls()
        return cls(
            allow_external_api=bool(raw.get("allow_external_api", False)),
            tesseract_cmd=raw.get("tesseract_cmd"),
        )

    def save(self, data_dir: Path) -> None:
        data_dir.mkdir(parents=True, exist_ok=True)
        payload = {
            "allow_external_api": self.allow_external_api,
            "tesseract_cmd": self.tesseract_cmd,
        }
        self.path(data_dir).write_text(json.dumps(payload, indent=2), encoding="utf-8")
