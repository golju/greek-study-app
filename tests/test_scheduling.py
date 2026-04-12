from datetime import datetime, timedelta, timezone

import pytest

from greek_study.domain.scheduling import Grade, apply_grade, days_for_maturity, next_review_utc


def test_days_for_maturity_bounds() -> None:
    assert days_for_maturity(1) == 1
    assert days_for_maturity(4) == 14
    assert days_for_maturity(99) == 14


@pytest.mark.parametrize(
    ("maturity", "grade", "expected_m", "expected_days"),
    [
        (0, Grade.good, 1, 1),
        (0, Grade.easy, 2, 3),
        (3, Grade.good, 4, 14),
        (4, Grade.good, 4, 14),
        (2, Grade.again, 0, 0),
        (2, Grade.hard, 1, 1),
    ],
)
def test_apply_grade_ladder(maturity: int, grade: Grade, expected_m: int, expected_days: int) -> None:
    upd = apply_grade(maturity, grade)
    assert upd.maturity == expected_m
    assert upd.interval_days == expected_days


def test_next_review_utc_adds_interval() -> None:
    now = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    upd = apply_grade(1, Grade.good)
    nxt = next_review_utc(now, upd)
    assert nxt - now == timedelta(days=upd.interval_days)
