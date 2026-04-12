from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class BlockKind(str, enum.Enum):
    heading = "heading"
    table = "table"
    example = "example"
    vocabulary = "vocabulary"
    other = "other"


class CardType(str, enum.Enum):
    flashcard = "flashcard"
    multiple_choice = "multiple_choice"
    type_in = "type_in"


class ReviewGrade(str, enum.Enum):
    again = "again"
    hard = "hard"
    good = "good"
    easy = "easy"


class Deck(Base):
    __tablename__ = "decks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    cards: Mapped[list["Card"]] = relationship(back_populates="deck")


class PageImage(Base):
    __tablename__ = "page_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    original_name: Mapped[str] = mapped_column(String(512), nullable=False)
    rel_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    blocks: Mapped[list["ExtractedBlock"]] = relationship(
        back_populates="page", cascade="all, delete-orphan"
    )


class ExtractedBlock(Base):
    __tablename__ = "extracted_blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    page_image_id: Mapped[int] = mapped_column(ForeignKey("page_images.id", ondelete="CASCADE"))
    kind: Mapped[BlockKind] = mapped_column(Enum(BlockKind), nullable=False, default=BlockKind.other)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    include: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    page: Mapped["PageImage"] = relationship(back_populates="blocks")


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    deck_id: Mapped[int] = mapped_column(ForeignKey("decks.id", ondelete="CASCADE"))
    front: Mapped[str] = mapped_column(Text, nullable=False)
    back: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    card_type: Mapped[CardType] = mapped_column(Enum(CardType), nullable=False, default=CardType.flashcard)
    tags: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    source_block_id: Mapped[int | None] = mapped_column(
        ForeignKey("extracted_blocks.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    deck: Mapped["Deck"] = relationship(back_populates="cards")
    schedule: Mapped["ReviewSchedule | None"] = relationship(
        back_populates="card", uselist=False, cascade="all, delete-orphan"
    )


class ReviewSchedule(Base):
    __tablename__ = "review_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"), unique=True)
    maturity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_review_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_grade: Mapped[ReviewGrade | None] = mapped_column(Enum(ReviewGrade), nullable=True)

    card: Mapped["Card"] = relationship(back_populates="schedule")
