from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from greek_study.db.models import Card, CardType, Deck, ReviewSchedule
from greek_study.services.cards import create_review_for_card


class CardDTO(BaseModel):
    deck: str = Field(min_length=1)
    front: str
    back: str = ""
    tags: str = ""
    card_type: str = "flashcard"
    explanation: str | None = None


class DeckBundleV1(BaseModel):
    version: Literal[1] = 1
    exported_at: datetime
    cards: list[CardDTO]


def export_decks_bundle(session: Session) -> DeckBundleV1:
    rows = session.scalars(select(Card).order_by(Card.id)).all()
    cards: list[CardDTO] = []
    for c in rows:
        deck_name = c.deck.name if c.deck else "Default"
        cards.append(
            CardDTO(
                deck=deck_name,
                front=c.front,
                back=c.back,
                tags=c.tags,
                card_type=c.card_type.value,
                explanation=c.explanation,
            )
        )
    return DeckBundleV1(exported_at=datetime.now(timezone.utc), cards=cards)


def export_json_string(session: Session) -> str:
    bundle = export_decks_bundle(session)
    return bundle.model_dump_json(indent=2)


def import_bundle(session: Session, bundle: DeckBundleV1) -> tuple[int, int]:
    """
    Import cards, creating decks as needed. Avoids name collisions by suffixing new decks.
    Returns (decks_created, cards_created).
    """
    decks_created = 0
    cards_created = 0
    deck_cache: dict[str, Deck] = {}

    def get_deck(name: str) -> Deck:
        if name in deck_cache:
            return deck_cache[name]
        existing = session.scalars(select(Deck).where(Deck.name == name)).first()
        if existing:
            deck_cache[name] = existing
            return existing
        deck = Deck(name=name)
        session.add(deck)
        session.flush()
        deck_cache[name] = deck
        nonlocal decks_created
        decks_created += 1
        return deck

    for dto in bundle.cards:
        deck = get_deck(dto.deck)
        try:
            ctype = CardType(dto.card_type)
        except ValueError:
            ctype = CardType.flashcard
        card = Card(
            deck_id=deck.id,
            front=dto.front,
            back=dto.back,
            explanation=dto.explanation,
            card_type=ctype,
            tags=dto.tags,
            source_block_id=None,
        )
        session.add(card)
        session.flush()
        session.add(create_review_for_card(card))
        cards_created += 1

    return decks_created, cards_created


def parse_bundle_json(raw: str) -> DeckBundleV1:
    return DeckBundleV1.model_validate_json(raw)


def safe_parse_bundle_json(raw: str) -> DeckBundleV1 | None:
    try:
        return parse_bundle_json(raw)
    except (ValidationError, ValueError):
        return None


def unique_deck_name(session: Session, desired: str) -> str:
    base = desired.strip() or "Imported"
    name = base
    idx = 1
    while session.scalars(select(Deck).where(Deck.name == name)).first():
        idx += 1
        name = f"{base} ({idx})"
    return name
