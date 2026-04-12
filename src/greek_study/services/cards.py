from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from greek_study.db.models import BlockKind, Card, CardType, Deck, ExtractedBlock, PageImage, ReviewSchedule
def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_default_deck(session: Session, name: str = "Default") -> Deck:
    return get_or_create_deck(session, name)


def get_or_create_deck(session: Session, name: str) -> Deck:
    clean = (name or "").strip() or "Default"
    deck = session.query(Deck).filter(Deck.name == clean).one_or_none()
    if deck:
        return deck
    deck = Deck(name=clean)
    session.add(deck)
    session.flush()
    return deck


def create_review_for_card(card: Card) -> ReviewSchedule:
    # New cards are due immediately; maturity 0 until first successful review.
    return ReviewSchedule(
        card=card,
        maturity=0,
        next_review_at=utcnow(),
        last_reviewed_at=None,
        last_grade=None,
    )


def save_page_with_blocks(
    session: Session,
    *,
    original_name: str,
    rel_path: str,
    width: int | None,
    height: int | None,
    blocks: list[tuple[str, BlockKind, bool]],
) -> PageImage:
    page = PageImage(original_name=original_name, rel_path=rel_path, width=width, height=height)
    session.add(page)
    session.flush()
    for idx, (text, kind, include) in enumerate(blocks):
        session.add(
            ExtractedBlock(
                page_image_id=page.id,
                kind=kind,
                text=text,
                include=include,
                sort_order=idx,
            )
        )
    session.flush()
    return page


def materialize_cards_from_blocks(
    session: Session,
    deck: Deck,
    page: PageImage,
    *,
    default_tags: str = "",
) -> int:
    """Create flashcards from included blocks (front=text, back empty for user to fill)."""
    created = 0
    blocks = (
        session.query(ExtractedBlock)
        .filter(ExtractedBlock.page_image_id == page.id)
        .order_by(ExtractedBlock.sort_order)
        .all()
    )
    for block in blocks:
        if not block.include:
            continue
        card = Card(
            deck_id=deck.id,
            front=block.text,
            back="",
            explanation=None,
            card_type=CardType.flashcard,
            tags=default_tags,
            source_block_id=block.id,
        )
        session.add(card)
        session.flush()
        session.add(create_review_for_card(card))
        created += 1
    return created


def reschedule_after_review(schedule: ReviewSchedule, maturity: int, next_at: datetime) -> None:
    schedule.maturity = maturity
    schedule.next_review_at = next_at
