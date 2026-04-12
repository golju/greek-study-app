from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from PIL import Image


def store_image_file(src: Path, images_dir: Path) -> tuple[str, int, int]:
    """
    Copy an image into the user data folder.

    Returns (relative path from data dir, width, height).
    """
    images_dir.mkdir(parents=True, exist_ok=True)
    ext = src.suffix.lower() or ".png"
    dest_name = f"{uuid.uuid4().hex}{ext}"
    dest = images_dir / dest_name
    shutil.copy2(src, dest)
    with Image.open(dest) as im:
        w, h = im.size
    rel = Path("images") / dest_name
    return str(rel).replace("\\", "/"), w, h


def resolve_stored_path(data_dir: Path, rel_path: str) -> Path:
    return (data_dir / rel_path).resolve()
