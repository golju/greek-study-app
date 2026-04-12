from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum


class Grade(str, Enum):
    again = "again"
    hard = "hard"
    good = "good"
    easy = "easy"


DAYS_BY_MATURITY: dict[int, int] = {
    1: 1,
    2: 3,
    3: 7,
    4: 14,
}


def days_for_maturity(maturity: int) -> int:
    """Return interval in days for a given maturity level (1..4)."""
    m = max(1, min(4, maturity))
    return DAYS_BY_MATURITY[m]


@dataclass(frozen=True)
class ScheduleUpdate:
    maturity: int
    interval_days: int


def apply_grade(maturity: int, grade: Grade) -> ScheduleUpdate:
    """
    Spaced repetition ladder (1/3/7/14 days) with four grades:
    - again: due immediately (0 days), maturity steps down
    - hard: short 1-day delay, maturity steps down
    - good: maturity up by 1 (capped), interval from ladder
    - easy: maturity up by 2 (capped), interval from ladder
    """
    m = max(0, min(4, maturity))

    if grade == Grade.again:
        # Full relearn: back to the beginning of the ladder.
        return ScheduleUpdate(maturity=0, interval_days=0)

    if grade == Grade.hard:
        return ScheduleUpdate(maturity=max(0, m - 1), interval_days=1)

    if grade == Grade.good:
        new_m = min(4, m + 1)
        return ScheduleUpdate(maturity=new_m, interval_days=days_for_maturity(new_m))

    if grade == Grade.easy:
        new_m = min(4, m + 2)
        return ScheduleUpdate(maturity=new_m, interval_days=days_for_maturity(new_m))

    raise ValueError(f"Unknown grade: {grade}")


def next_review_utc(now: datetime, update: ScheduleUpdate) -> datetime:
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return now + timedelta(days=update.interval_days)
