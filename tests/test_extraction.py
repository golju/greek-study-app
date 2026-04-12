from greek_study.services.extraction import split_blocks


def test_split_blocks_by_blank_lines() -> None:
    text = "α\n\nβ\n\n\nγ"
    parts = split_blocks(text)
    assert parts == ["α", "β", "γ"]


def test_split_blocks_single_chunk() -> None:
    assert split_blocks("μόνο ένα") == ["μόνο ένα"]
