import { $, el } from '../../core/dom.js';
import { state } from '../../core/state.js';
import {
  PERSON_ORDER,
  PERSON_LABEL,
  TENSES,
  TENSE_LABEL,
  REVEAL_SUBMODES,
} from '../../core/constants.js';
import { makeFormsTable, personCell, findForm } from '../../ui/tables.js';
import { actions, actionBtn } from '../../ui/buttons.js';
import {
  toggleReveal,
  nextChallenge,
  answerRecognize,
  toggleConjRow,
  toggleConjAll,
} from './cardsActions.js';

export function renderCard() {
  const card = $('#card');
  card.replaceChildren();
  $('#cards-counter').textContent = `Карточка ${state.cards.counter}`;
  card.classList.toggle('card--clickable', REVEAL_SUBMODES.has(state.cards.submode));

  if (!state.words.length || !state.cards.challenge) return;

  const sm = state.cards.submode;
  if (sm === 'lemma-ru') renderLemmaRu(card);
  else if (sm === 'ru-lemma') renderRuLemma(card);
  else if (sm === 'name-form') renderNameForm(card);
  else if (sm === 'recognize-form') renderRecognizeForm(card);
  else if (sm === 'conjugate-tense') renderConjugateTense(card);

  if (REVEAL_SUBMODES.has(sm)) {
    card.appendChild(el('p', {
      class: 'card__hint',
      text: 'Подсказка: клик по карточке тоже показывает ответ.',
    }));
  }
}

function renderLemmaRu(card) {
  const { word } = state.cards.challenge;
  const revealed = state.cards.revealed;

  card.appendChild(el('div', { class: 'card__stimulus', text: word.verb }));
  if (revealed) {
    card.appendChild(el('div', { class: 'card__answer', text: word.translation }));
    card.appendChild(makeFormsTable(word.forms));
  }
  card.appendChild(actions(
    actionBtn(revealed ? 'Скрыть' : 'Показать перевод', toggleReveal, { primary: !revealed }),
    actionBtn('Следующее →', nextChallenge),
  ));
}

function renderRuLemma(card) {
  const { word } = state.cards.challenge;
  const revealed = state.cards.revealed;

  card.appendChild(el('div', { class: 'card__stimulus card__stimulus--ru', text: word.translation }));
  if (revealed) {
    card.appendChild(el('div', { class: 'card__answer', text: word.verb }));
    card.appendChild(makeFormsTable(word.forms));
  }
  card.appendChild(actions(
    actionBtn(revealed ? 'Скрыть' : 'Показать слово', toggleReveal, { primary: !revealed }),
    actionBtn('Следующее →', nextChallenge),
  ));
}

function renderNameForm(card) {
  const { word, form, tense } = state.cards.challenge;
  const revealed = state.cards.revealed;

  card.appendChild(el('div', { class: 'card__meta', text: `${word.verb} — ${word.translation}` }));
  card.appendChild(el('div', { class: 'card__cue' },
    el('span', { class: 'card__cue-person', text: PERSON_LABEL[form.person] }),
    ' · ',
    el('span', { class: 'card__cue-tense', text: TENSE_LABEL[tense] }),
  ));

  if (revealed) {
    card.appendChild(el('div', { class: 'card__answer', text: form[tense] }));
    card.appendChild(makeFormsTable(word.forms));
  } else {
    card.appendChild(el('div', { class: 'card__answer card__answer--placeholder', text: '?' }));
  }

  card.appendChild(actions(
    actionBtn(revealed ? 'Скрыть' : 'Показать форму', toggleReveal, { primary: !revealed }),
    actionBtn('Следующее →', nextChallenge),
  ));
}

function renderRecognizeForm(card) {
  const c = state.cards;
  const { word, form, tense } = c.challenge;

  card.appendChild(el('div', { class: 'card__cue', text: 'Какое лицо и время?' }));
  card.appendChild(el('div', { class: 'card__stimulus', text: form[tense] }));

  const tbody = el('tbody');
  for (const p of PERSON_ORDER) {
    const row = el('tr', {},
      personCell(p),
      ...TENSES.map((t) => {
        const isCorrect = (p === form.person && t === tense);
        const isPicked = (c.picked && c.picked.person === p && c.picked.tense === t);
        let cls = 'choice-cell';
        if (c.answered) {
          if (isCorrect) cls += ' is-correct';
          else if (isPicked) cls += ' is-wrong';
          else cls += ' is-dim';
        }
        return el('td', { class: 'choice-grid__td' },
          el('button', {
            type: 'button',
            class: cls,
            text: c.answered ? findForm(word, p)[t] : ' ',
            disabled: c.answered,
            on: { click: () => answerRecognize(p, t) },
          }),
        );
      }),
    );
    tbody.appendChild(row);
  }

  const grid = el('table', { class: 'choice-grid' },
    el('thead', {},
      el('tr', {},
        el('th', { text: '' }),
        ...TENSES.map((t) => el('th', { text: TENSE_LABEL[t] })),
      ),
    ),
    tbody,
  );
  card.appendChild(el('div', { class: 'table-wrap' }, grid));

  if (c.answered) {
    const correct = (c.picked.person === form.person && c.picked.tense === tense);
    card.appendChild(el('div', {
      class: 'card__verdict ' + (correct ? 'is-correct' : 'is-wrong'),
      text: correct ? 'Верно' : 'Мимо',
    }));
    card.appendChild(el('div', { class: 'card__answer-meta' },
      el('strong', { text: word.verb }),
      ` — ${word.translation} · `,
      el('span', { text: `${PERSON_LABEL[form.person]}, ${TENSE_LABEL[tense]}` }),
    ));
  }

  card.appendChild(actions(
    actionBtn('Следующее →', nextChallenge, { primary: c.answered }),
  ));
}

function renderConjugateTense(card) {
  const c = state.cards;
  const { word, tense } = c.challenge;
  const allRevealed = c.revealedRows.size === PERSON_ORDER.length;

  card.appendChild(el('div', { class: 'card__meta', text: `${word.verb} — ${word.translation}` }));
  card.appendChild(el('div', { class: 'card__cue' },
    'Спрягать в: ',
    el('strong', { text: TENSE_LABEL[tense] }),
  ));

  const tbody = el('tbody');
  for (const p of PERSON_ORDER) {
    const f = findForm(word, p);
    const isRevealed = c.revealedRows.has(p);
    const tr = el('tr', { class: 'conj-row' + (isRevealed ? ' is-revealed' : '') },
      personCell(p),
      el('td', {
        class: 'conj-row__cell',
        on: { click: () => toggleConjRow(p) },
        text: isRevealed ? f[tense] : '?',
      }),
    );
    tbody.appendChild(tr);
  }

  const table = el('table', { class: 'forms conj-table' },
    el('thead', {},
      el('tr', {},
        el('th', { text: 'Лицо' }),
        el('th', { text: TENSE_LABEL[tense] }),
      ),
    ),
    tbody,
  );
  card.appendChild(el('div', { class: 'table-wrap' }, table));

  card.appendChild(actions(
    actionBtn(allRevealed ? 'Скрыть все' : 'Показать все', toggleConjAll, { primary: !allRevealed }),
    actionBtn('Следующее →', nextChallenge),
  ));

  card.appendChild(el('p', {
    class: 'card__hint',
    text: 'Подсказка: клик по строке показывает только её.',
  }));
}
