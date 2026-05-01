import { $ } from './core/dom.js';
import { state } from './core/state.js';
import { DATA_URL } from './core/constants.js';
import { setMode, bindModeEvents } from './core/router.js';
import { loadWords } from './services/wordsService.js';
import { pickChallenge } from './features/cards/cardsActions.js';
import { bindCardsEvents } from './features/cards/cardsEvents.js';
import { bindListEvents } from './features/wordsList/wordsListEvents.js';
import { bindRulesEvents } from './features/rules/rulesEvents.js';

async function init() {
  bindModeEvents();
  bindCardsEvents();
  bindListEvents();
  bindRulesEvents();

  try {
    state.words = await loadWords();
    $('#status').hidden = true;
    pickChallenge();
    setMode('cards');
  } catch (err) {
    $('#status').textContent =
      `Не удалось загрузить ${DATA_URL}: ${err.message}. ` +
      `Запусти статический сервер в корне проекта: ` +
      `python3 -m http.server 8000`;
  }
}

init();
