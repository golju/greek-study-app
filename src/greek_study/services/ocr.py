from __future__ import annotations

import logging

import pytesseract
from PIL import Image, ImageEnhance, ImageOps

logger = logging.getLogger(__name__)


class OcrError(RuntimeError):
    pass


def configure_tesseract(cmd: str | None) -> None:
    if cmd:
        pytesseract.pytesseract.tesseract_cmd = cmd


def check_tesseract_available() -> bool:
    try:
        _ = pytesseract.get_tesseract_version()
        return True
    except Exception as exc:  # noqa: BLE001 — log once for supportability
        logger.warning("Tesseract not usable: %s", exc)
        return False


def preprocess_for_greek(image: Image.Image, max_width: int = 2200) -> Image.Image:
    """Lightweight cleanup tuned for textbook screenshots."""
    img = ImageOps.exif_transpose(image)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    gray = ImageOps.grayscale(img)
    w, h = gray.size
    if w > max_width:
        scale = max_width / float(w)
        gray = gray.resize((max_width, int(h * scale)), Image.Resampling.LANCZOS)
    gray = ImageEnhance.Contrast(gray).enhance(1.35)
    return gray


def run_ocr(image: Image.Image, lang: str = "ell+eng") -> str:
    if not check_tesseract_available():
        raise OcrError(
            "Tesseract не найден или не запускается. Установите tesseract "
            "(brew install tesseract tesseract-lang) либо укажите путь в настройках."
        )
    prepared = preprocess_for_greek(image)
    try:
        text = pytesseract.image_to_string(prepared, lang=lang)
    except pytesseract.TesseractNotFoundError as exc:
        raise OcrError("Исполняемый файл tesseract не найден.") from exc
    except pytesseract.TesseractError as exc:
        raise OcrError(
            "Ошибка Tesseract. Проверьте, что установлены языковые пакеты ell и eng "
            f"(tesseract --list-langs). Детали: {exc}"
        ) from exc
    return text.strip()
