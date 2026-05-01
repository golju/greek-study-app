import { $, el } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { actions, actionBtn } from '../../ui/buttons.js';
import { findRuleById, getCardsForRule } from './rulesFilters.js';
import { renderRules } from './rulesRender.js';

export function isTrainingActive() {
  return state.rules.training.ruleId !== null;
}

function rebuildTrainingOrder() {
  const t = state.rules.training;
  const cards = getCardsForRule(t.ruleId);
  const idxs = cards.map((_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  t.order = idxs;
  t.idx = 0;
  t.revealed = false;
}

export function startTraining(ruleId) {
  const cards = getCardsForRule(ruleId);
  if (!cards.length) return;
  state.rules.training.ruleId = ruleId;
  rebuildTrainingOrder();
  renderRules();
}

export function stopTraining() {
  const t = state.rules.training;
  t.ruleId = null;
  t.order = [];
  t.idx = 0;
  t.revealed = false;
  renderRules();
}

export function nextTrainingCard() {
  const t = state.rules.training;
  if (!t.order.length) return;
  t.idx = (t.idx + 1) % t.order.length;
  t.revealed = false;
  renderRules();
}

export function toggleTrainingReveal() {
  state.rules.training.revealed = !state.rules.training.revealed;
  renderRules();
}

export function restartTraining() {
  rebuildTrainingOrder();
  renderRules();
}

export function renderTraining(content) {
  content.replaceChildren();
  const t = state.rules.training;
  const rule = findRuleById(t.ruleId);
  const cards = getCardsForRule(t.ruleId);
  const total = cards.length;

  if (!rule || !total) {
    stopTraining();
    return;
  }

  $('#rules-counter').textContent = `Карточка ${t.idx + 1} / ${total}`;

  const card = cards[t.order[t.idx]];
  const revealed = t.revealed;

  const header = el('div', { class: 'rules-training__header' },
    el('button', {
      type: 'button',
      class: 'btn-text',
      'data-action': 'exit-training',
      text: '← Назад к правилу',
    }),
    el('button', {
      type: 'button',
      class: 'btn-text rules-training__restart',
      'data-action': 'restart-training',
      text: 'Сначала',
    }),
  );
  content.appendChild(header);

  content.appendChild(el('h2', {
    class: 'rules-training__title',
    text: rule.title,
  }));

  const article = el('article', {
    class: 'card card--training' + (revealed ? '' : ' card--clickable'),
    on: { click: (e) => {
      if (e.target.closest('button')) return;
      if (!revealed) toggleTrainingReveal();
    }},
  });

  article.appendChild(el('div', { class: 'card__stimulus', text: card.front }));

  if (revealed) {
    article.appendChild(el('div', { class: 'card__answer', text: card.back }));
    if (card.note) {
      article.appendChild(el('p', { class: 'rules-training__note', text: card.note }));
    }
    if (card.tags?.length) {
      const tagsBox = el('div', { class: 'rules-training__tags' });
      for (const tag of card.tags) {
        tagsBox.appendChild(el('span', { class: 'badge', text: tag }));
      }
      article.appendChild(tagsBox);
    }
  } else {
    article.appendChild(el('div', { class: 'card__answer card__answer--placeholder', text: '?' }));
  }

  article.appendChild(actions(
    actionBtn(revealed ? 'Скрыть' : 'Показать перевод', toggleTrainingReveal, { primary: !revealed }),
    actionBtn('Следующее →', nextTrainingCard),
  ));

  if (!revealed) {
    article.appendChild(el('p', {
      class: 'card__hint',
      text: 'Подсказка: клик по карточке тоже показывает ответ.',
    }));
  }

  content.appendChild(article);
}
