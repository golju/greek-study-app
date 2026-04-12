from __future__ import annotations

import re

from greek_study.db.models import BlockKind


def split_blocks(ocr_text: str) -> list[str]:
    parts = re.split(r"\n{2,}", ocr_text)
    blocks: list[str] = []
    for p in parts:
        cleaned = p.strip()
        if cleaned:
            blocks.append(cleaned)
    if not blocks and ocr_text.strip():
        return [ocr_text.strip()]
    return blocks


def guess_kind(text: str) -> BlockKind:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return BlockKind.other
    first = lines[0]
    if "\t" in first or first.count("|") >= 2:
        return BlockKind.table
    if len(lines) == 1 and len(first) <= 120 and not first.endswith("."):
        return BlockKind.heading
    if re.search(r"^[•\-–—]\s", first, re.MULTILINE) or re.match(r"^\d+[\).]", first):
        return BlockKind.vocabulary
    if any(";" in ln for ln in lines[:3]) and len(lines) <= 6:
        return BlockKind.example
    return BlockKind.other
