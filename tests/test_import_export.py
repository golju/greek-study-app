from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from greek_study.db.models import Base, Card, CardType, Deck
from greek_study.services.cards import create_review_for_card
from greek_study.services.import_export import (
    DeckBundleV1,
    export_json_string,
    import_bundle,
    parse_bundle_json,
)


def _memory_session() -> Session:
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False, future=True)()


def test_export_import_roundtrip() -> None:
    session = _memory_session()
    try:
        deck = Deck(name="Grammar")
        session.add(deck)
        session.flush()
        card = Card(
            deck_id=deck.id,
            front="γράφω",
            back="пишу",
            explanation=None,
            card_type=CardType.flashcard,
            tags="verb",
            source_block_id=None,
        )
        session.add(card)
        session.flush()
        session.add(create_review_for_card(card))
        session.commit()

        exported = export_json_string(session)
        bundle = parse_bundle_json(exported)
        assert isinstance(bundle, DeckBundleV1)
        assert bundle.cards[0].front == "γράφω"
    finally:
        session.close()

    session2 = _memory_session()
    try:
        decks_created, cards_created = import_bundle(session2, bundle)
        session2.commit()
        assert decks_created == 1
        assert cards_created == 1
        row = session2.scalars(select(Card)).one()
        assert row.front == "γράφω"
        assert row.schedule is not None
    finally:
        session2.close()


def test_parse_bundle_json() -> None:
    raw = """
    {
      "version": 1,
      "exported_at": "2026-04-12T00:00:00Z",
      "cards": [
        {"deck": "A", "front": "1", "back": "2", "tags": "", "card_type": "flashcard", "explanation": null}
      ]
    }
    """
    bundle = parse_bundle_json(raw)
    assert bundle.version == 1
    assert bundle.cards[0].deck == "A"
