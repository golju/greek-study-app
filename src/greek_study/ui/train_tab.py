from __future__ import annotations

import logging
import random

from PySide6.QtCore import Qt
from PySide6.QtGui import QKeySequence, QShortcut
from PySide6.QtWidgets import (
    QButtonGroup,
    QComboBox,
    QFrame,
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from greek_study.db.models import Card, Deck, ReviewGrade, ReviewSchedule
from greek_study.domain.scheduling import Grade, apply_grade, next_review_utc
from greek_study.services.cards import utcnow

logger = logging.getLogger(__name__)


class TrainTab(QWidget):
    def __init__(self, session_factory, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.session_factory = session_factory
        self.current_card: Card | None = None
        self.current_schedule: ReviewSchedule | None = None
        self.answer_visible = False

        layout = QVBoxLayout(self)
        top = QHBoxLayout()
        self.deck_combo = QComboBox()
        self.mode = QComboBox()
        self.mode.addItem("Флешкарта", "flashcard")
        self.mode.addItem("Выбор ответа", "mcq")
        top.addWidget(QLabel("Колода"))
        top.addWidget(self.deck_combo, 1)
        top.addWidget(QLabel("Режим"))
        top.addWidget(self.mode, 1)
        layout.addLayout(top)

        self.progress = QLabel("—")
        layout.addWidget(self.progress)

        self.question = QTextEdit()
        self.question.setReadOnly(True)
        self.question.setMinimumHeight(120)
        layout.addWidget(self.question)

        self.answer = QTextEdit()
        self.answer.setReadOnly(True)
        self.answer.setPlaceholderText("Ответ скрыт — нажмите Space")
        layout.addWidget(self.answer)

        self.notes = QTextEdit()
        self.notes.setReadOnly(True)
        self.notes.setPlaceholderText("Краткое пояснение (если заполнено в карточке)")
        self.notes.setMaximumHeight(110)
        self.notes.hide()
        layout.addWidget(self.notes)

        self.mcq_frame = QFrame()
        mcq_layout = QVBoxLayout(self.mcq_frame)
        self.mcq_buttons: list[QPushButton] = []
        for _ in range(4):
            btn = QPushButton()
            btn.clicked.connect(self._make_mcq_handler(btn))
            self.mcq_buttons.append(btn)
            mcq_layout.addWidget(btn)
        self.mcq_frame.hide()
        layout.addWidget(self.mcq_frame)

        grades = QHBoxLayout()
        self.btn_show = QPushButton("Показать ответ (Space)")
        self.btn_show.clicked.connect(self._toggle_answer)
        self.btn_again = QPushButton("Снова (W)")
        self.btn_hard = QPushButton("Сложно (H)")
        self.btn_good = QPushButton("Знаю (R)")
        self.btn_easy = QPushButton("Легко (E)")
        self.btn_next = QPushButton("Дальше (N)")
        for b in (self.btn_show, self.btn_again, self.btn_hard, self.btn_good, self.btn_easy, self.btn_next):
            grades.addWidget(b)
        layout.addLayout(grades)

        self.btn_again.clicked.connect(lambda: self._grade(Grade.again))
        self.btn_hard.clicked.connect(lambda: self._grade(Grade.hard))
        self.btn_good.clicked.connect(lambda: self._grade(Grade.good))
        self.btn_easy.clicked.connect(lambda: self._grade(Grade.easy))
        self.btn_next.clicked.connect(self.load_next_card)

        self._shortcuts = [
            QShortcut(QKeySequence(Qt.Key_Space), self, activated=self._toggle_answer),
            QShortcut(QKeySequence(Qt.Key_W), self, activated=lambda: self._grade(Grade.again)),
            QShortcut(QKeySequence(Qt.Key_H), self, activated=lambda: self._grade(Grade.hard)),
            QShortcut(QKeySequence(Qt.Key_R), self, activated=lambda: self._grade(Grade.good)),
            QShortcut(QKeySequence(Qt.Key_E), self, activated=lambda: self._grade(Grade.easy)),
            QShortcut(QKeySequence(Qt.Key_N), self, activated=self.load_next_card),
        ]

        self.deck_combo.currentIndexChanged.connect(lambda _=None: self._refresh_progress())
        self.mode.currentIndexChanged.connect(self._on_mode_changed)

        self.refresh_decks()

    def showEvent(self, event) -> None:  # type: ignore[override]
        super().showEvent(event)
        self.refresh_decks()

    def refresh_decks(self) -> None:
        current = self.deck_combo.currentData()
        self.deck_combo.blockSignals(True)
        self.deck_combo.clear()
        session = self.session_factory()
        try:
            decks = session.scalars(select(Deck).order_by(Deck.name)).all()
            for d in decks:
                self.deck_combo.addItem(d.name, d.id)
        finally:
            session.close()
        self.deck_combo.blockSignals(False)
        if current is not None:
            idx = self.deck_combo.findData(current)
            if idx >= 0:
                self.deck_combo.setCurrentIndex(idx)
        self.load_next_card()

    def _deck_id(self) -> int | None:
        return self.deck_combo.currentData()

    def _pick_next_card(self, session) -> tuple[Card, ReviewSchedule] | None:
        deck_id = self._deck_id()
        if deck_id is None:
            return None
        now = utcnow()
        stmt = (
            select(Card)
            .join(ReviewSchedule, ReviewSchedule.card_id == Card.id)
            .options(joinedload(Card.schedule))
            .where(Card.deck_id == deck_id)
            .where(ReviewSchedule.next_review_at <= now)
            .order_by(ReviewSchedule.next_review_at.asc())
            .limit(1)
        )
        card = session.scalars(stmt).first()
        if not card or not card.schedule:
            return None
        return card, card.schedule

    def load_next_card(self) -> None:
        self.answer_visible = False
        self.answer.clear()
        self.answer.setPlaceholderText("Ответ скрыт — нажмите Space")
        self.notes.clear()
        self.notes.hide()
        self.current_card = None
        self.current_schedule = None

        session = self.session_factory()
        try:
            picked = self._pick_next_card(session)
            self._refresh_progress(session=session)
            if not picked:
                self.question.setPlainText("Нет карточек к повторению. Отличная работа!")
                self.mcq_frame.hide()
                self.answer.show()
                self.btn_show.setEnabled(False)
                return
            card, sched = picked
            session.expunge(card)
            session.expunge(sched)
            self.current_card = card
            self.current_schedule = sched
            self.render_card()
        finally:
            session.close()

    def _on_mode_changed(self) -> None:
        if self.current_card:
            self.answer_visible = False
            self.render_card()

    def render_card(self) -> None:
        card = self.current_card
        if not card:
            return
        if self.mode.currentData() == "mcq":
            self._render_mcq(card)
        else:
            self.mcq_frame.hide()
            self.answer.show()
            self.btn_show.setEnabled(True)
            self.question.setPlainText(card.front)
            self.answer.clear()
            self.answer.setPlaceholderText("Ответ скрыт — нажмите Space")

    def _render_mcq(self, card: Card) -> None:
        session = self.session_factory()
        try:
            total = session.scalar(
                select(func.count()).select_from(Card).where(Card.deck_id == card.deck_id)
            )
            if (total or 0) < 2:
                self.mode.blockSignals(True)
                self.mode.setCurrentIndex(0)
                self.mode.blockSignals(False)
                self.render_card()
                return

            backs = session.scalars(
                select(Card.back).where(Card.deck_id == card.deck_id).where(Card.id != card.id)
            ).all()
        finally:
            session.close()
        correct = (card.back or "").strip() or (card.front or "").strip()
        distractors = [b for b in backs if b and b.strip() and b.strip() != correct]
        random.shuffle(distractors)
        options = [correct] + distractors[:3]
        while len(options) < 4:
            options.append("—")
        random.shuffle(options)
        self.question.setPlainText(card.front)
        self.answer.hide()
        self.btn_show.setEnabled(False)
        self.mcq_frame.show()
        for idx, btn in enumerate(self.mcq_buttons):
            label = options[idx] if idx < len(options) else "—"
            btn.setText(label[:400])
            btn.setProperty("is_correct", label == correct)

    def _make_mcq_handler(self, btn: QPushButton):
        def handler() -> None:
            if not self.current_card:
                return
            correct = btn.property("is_correct") is True
            if correct:
                self._grade(Grade.good)
            else:
                self._grade(Grade.hard)

        return handler

    def _toggle_answer(self) -> None:
        if self.mode.currentData() == "mcq":
            return
        card = self.current_card
        if not card:
            return
        self.answer_visible = not self.answer_visible
        if self.answer_visible:
            self.answer.setPlainText(card.back or "")
            self.answer.setPlaceholderText("")
            if card.explanation:
                self.notes.setPlainText(card.explanation)
                self.notes.show()
            else:
                self.notes.hide()
        else:
            self.answer.clear()
            self.answer.setPlaceholderText("Ответ скрыт — нажмите Space")
            self.notes.hide()

    def _grade(self, grade: Grade) -> None:
        if not self.current_card or not self.current_schedule:
            return
        if self.mode.currentData() == "flashcard":
            if not self.answer_visible and grade in (Grade.hard, Grade.good, Grade.easy):
                self._toggle_answer()
                return

        session = self.session_factory()
        try:
            sched = session.get(ReviewSchedule, self.current_schedule.id)
            if not sched:
                return
            upd = apply_grade(sched.maturity, grade)
            sched.maturity = upd.maturity
            sched.next_review_at = next_review_utc(utcnow(), upd)
            sched.last_reviewed_at = utcnow()
            sched.last_grade = ReviewGrade(grade.value)
            session.commit()
        except Exception as exc:  # noqa: BLE001
            session.rollback()
            logger.exception("Grade failed")
            QMessageBox.critical(self, "Ошибка", str(exc))
            return
        finally:
            session.close()

        self.load_next_card()

    def _refresh_progress(self, session=None) -> None:
        close = False
        if session is None:
            session = self.session_factory()
            close = True
        try:
            deck_id = self._deck_id()
            if deck_id is None:
                self.progress.setText("—")
                return
            now = utcnow()
            due = session.scalar(
                select(func.count())
                .select_from(ReviewSchedule)
                .join(Card, Card.id == ReviewSchedule.card_id)
                .where(Card.deck_id == deck_id)
                .where(ReviewSchedule.next_review_at <= now)
            )
            total = session.scalar(
                select(func.count()).select_from(Card).where(Card.deck_id == deck_id)
            )
            self.progress.setText(f"К повторению сейчас: {due or 0} / всего {total or 0}")
        finally:
            if close:
                session.close()
