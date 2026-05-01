import { $ } from '../../core/dom.js';
import { state } from '../../core/state.js';
import {
  changeRulesSubmode,
  restartRules,
  changeCategory,
  toggleTag,
} from './rulesActions.js';
import { startTraining, stopTraining, restartTraining } from './rulesTraining.js';
import { renderRules } from './rulesRender.js';

export function bindRulesEvents() {
  $('#rules-submode').addEventListener('change', (e) => changeRulesSubmode(e.target.value));
  $('#rules-restart').addEventListener('click', restartRules);

  $('#rules-search').addEventListener('input', (e) => {
    state.rules.list.query = e.target.value;
    renderRules();
  });

  $('#rules-category').addEventListener('change', (e) => changeCategory(e.target.value));

  $('#rules-tags').addEventListener('click', (e) => {
    const chip = e.target.closest('.tag-chip');
    if (!chip) return;
    toggleTag(chip.dataset.tag);
  });

  $('#rules-content').addEventListener('click', (e) => {
    const trainEl = e.target.closest('[data-action="train"]');
    if (trainEl) {
      e.preventDefault();
      startTraining(trainEl.dataset.ruleId);
      return;
    }
    const exitEl = e.target.closest('[data-action="exit-training"]');
    if (exitEl) {
      e.preventDefault();
      stopTraining();
      return;
    }
    const restartEl = e.target.closest('[data-action="restart-training"]');
    if (restartEl) {
      e.preventDefault();
      restartTraining();
      return;
    }
  });
}
