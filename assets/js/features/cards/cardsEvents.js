import { $ } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { REVEAL_SUBMODES } from '../../core/constants.js';
import { changeSubmode, restart, toggleReveal } from './cardsActions.js';

export function bindCardsEvents() {
  $('#cards-submode').addEventListener('change', (e) => changeSubmode(e.target.value));
  $('#cards-restart').addEventListener('click', restart);

  $('#card').addEventListener('click', (e) => {
    if (e.target.closest('button, .choice-cell, .conj-row__cell, summary')) return;
    if (REVEAL_SUBMODES.has(state.cards.submode)) toggleReveal();
  });
}
