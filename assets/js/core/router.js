import { $, $$ } from './dom.js';
import { state } from './state.js';
import { renderCard } from '../features/cards/cardsRender.js';
import { renderList } from '../features/wordsList/wordsListRender.js';
import { renderRules } from '../features/rules/rulesRender.js';
import { ensureRulesLoaded } from '../features/rules/rulesActions.js';

export function setMode(mode) {
  state.mode = mode;
  $$('.mode-btn').forEach((btn) => {
    const active = btn.dataset.mode === mode;
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
    btn.classList.toggle('is-active', active);
  });
  $('#view-cards').hidden = mode !== 'cards';
  $('#view-list').hidden = mode !== 'list';
  $('#view-rules').hidden = mode !== 'rules';
  if (mode === 'cards') renderCard();
  else if (mode === 'list') renderList();
  else if (mode === 'rules') {
    if (!state.rules.loaded && !state.rules.loading) ensureRulesLoaded();
    else renderRules();
  }
}

export function bindModeEvents() {
  $$('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });
}
