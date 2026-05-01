import { state } from '../../core/state.js';
import { TENSES, PERSON_ORDER } from '../../core/constants.js';
import { renderCard } from './cardsRender.js';

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickChallenge() {
  const c = state.cards;
  const sm = c.submode;
  if (sm === 'lemma-ru' || sm === 'ru-lemma') {
    c.challenge = { word: pickRandom(state.words) };
  } else if (sm === 'name-form' || sm === 'recognize-form') {
    const word = pickRandom(state.words);
    const form = pickRandom(word.forms);
    const tense = pickRandom(TENSES);
    c.challenge = { word, form, tense };
  } else if (sm === 'conjugate-tense') {
    const word = pickRandom(state.words);
    const tense = pickRandom(TENSES);
    c.challenge = { word, tense };
  }
}

function resetSubmodeState() {
  const c = state.cards;
  c.revealed = false;
  c.picked = null;
  c.answered = false;
  c.revealedRows = new Set();
}

export function nextChallenge() {
  state.cards.counter += 1;
  resetSubmodeState();
  pickChallenge();
  renderCard();
}

export function restart() {
  state.cards.counter = 1;
  resetSubmodeState();
  pickChallenge();
  renderCard();
}

export function changeSubmode(sm) {
  state.cards.submode = sm;
  state.cards.counter = 1;
  resetSubmodeState();
  pickChallenge();
  renderCard();
}

export function toggleReveal() {
  state.cards.revealed = !state.cards.revealed;
  renderCard();
}

export function answerRecognize(person, tense) {
  const c = state.cards;
  if (c.answered) return;
  c.picked = { person, tense };
  c.answered = true;
  renderCard();
}

export function toggleConjRow(person) {
  const set = state.cards.revealedRows;
  if (set.has(person)) set.delete(person);
  else set.add(person);
  renderCard();
}

export function toggleConjAll() {
  const set = state.cards.revealedRows;
  if (set.size === PERSON_ORDER.length) {
    state.cards.revealedRows = new Set();
  } else {
    state.cards.revealedRows = new Set(PERSON_ORDER);
  }
  renderCard();
}
