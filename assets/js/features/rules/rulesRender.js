import { $, el } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { RULES_URL, CATEGORY_LABEL } from '../../core/constants.js';
import { actions, actionBtn } from '../../ui/buttons.js';
import { ruleBadges } from '../../ui/badges.js';
import { renderBlocks } from '../../ui/blocks.js';
import {
  getFilteredRules,
  getCardsForRule,
  buildRuleHaystack,
} from './rulesFilters.js';
import { isTrainingActive, renderTraining } from './rulesTraining.js';
import { toggleRulesReveal, nextRule } from './rulesActions.js';

function categoryLabel(cat) {
  return CATEGORY_LABEL[cat] ?? cat;
}

function renderCategorySelect() {
  const sel = $('#rules-category');
  sel.replaceChildren();
  const r = state.rules;
  sel.appendChild(el('option', {
    value: '',
    text: `Все категории (${r.items.length})`,
  }));
  for (const { category, count } of r.allCategories) {
    sel.appendChild(el('option', {
      value: category,
      text: `${categoryLabel(category)} (${count})`,
    }));
  }
  sel.value = r.activeCategory;
}

function renderTagFilter() {
  const box = $('#rules-tags');
  box.replaceChildren();
  const r = state.rules;
  if (!r.activeCategory || !r.tagsInCategory.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.appendChild(el('button', {
    type: 'button',
    class: 'tag-chip' + (r.activeTags.size === 0 ? ' is-active' : ''),
    'data-tag': '',
    text: 'Все',
  }));
  for (const { tag, count } of r.tagsInCategory) {
    box.appendChild(el('button', {
      type: 'button',
      class: 'tag-chip' + (r.activeTags.has(tag) ? ' is-active' : ''),
      'data-tag': tag,
    },
      el('span', { class: 'tag-chip__label', text: tag }),
      el('span', { class: 'tag-chip__count', text: String(count) }),
    ));
  }
}

function hideRulesChrome({ alsoHideSubmode = false } = {}) {
  $('#rules-search').hidden = true;
  $('#rules-restart').hidden = true;
  $('#rules-category-control').hidden = true;
  $('#rules-tags').hidden = true;
  $('#rules-submode-control').hidden = alsoHideSubmode;
}

function trainBtn(rule) {
  const cards = getCardsForRule(rule.id);
  if (!cards.length) return null;
  return el('div', { class: 'rule-train' },
    el('button', {
      type: 'button',
      class: 'card__btn card__btn--primary',
      'data-action': 'train',
      'data-rule-id': rule.id,
      text: `Тренировать карточки (${cards.length})`,
    }),
  );
}

function renderRulesList(content) {
  content.replaceChildren();
  const base = getFilteredRules();
  const q = state.rules.list.query.trim().toLowerCase();
  const filtered = q
    ? base.filter((rule) => buildRuleHaystack(rule).includes(q))
    : base;
  $('#rules-counter').textContent = `${filtered.length} / ${state.rules.items.length}`;

  const ul = el('ul', { class: 'rules-list' });
  for (const rule of filtered) {
    const li = el('li', { class: 'rules-list__item' });
    const details = el('details');
    details.appendChild(el('summary', {},
      el('span', { class: 'rules-list__title', text: rule.title }),
      rule.summary ? el('span', { class: 'rules-list__summary', text: ` — ${rule.summary}` }) : null,
    ));
    const badges = ruleBadges(rule);
    if (badges) details.appendChild(badges);
    details.appendChild(renderBlocks(rule.blocks));
    const train = trainBtn(rule);
    if (train) details.appendChild(train);
    li.appendChild(details);
    ul.appendChild(li);
  }
  content.appendChild(ul);
}

function renderRulesCards(content) {
  content.replaceChildren();
  const r = state.rules;
  const total = r.cards.order.length;
  $('#rules-counter').textContent = total
    ? `Карточка ${r.cards.idx + 1} / ${total}`
    : `0 / ${state.rules.items.length}`;
  if (!total) return;

  const rule = r.items[r.cards.order[r.cards.idx]];
  const revealed = r.cards.revealed;

  const card = el('article', {
    class: 'card card--rule' + (revealed ? '' : ' card--clickable'),
    on: { click: (e) => {
      if (e.target.closest('button')) return;
      if (!revealed) toggleRulesReveal();
    }},
  });

  card.appendChild(el('div', { class: 'card__stimulus card__stimulus--rule', text: rule.title }));
  if (rule.summary) {
    card.appendChild(el('div', { class: 'rule-summary', text: rule.summary }));
  }
  const badges = ruleBadges(rule);
  if (badges) card.appendChild(badges);

  if (revealed) {
    card.appendChild(el('hr', { class: 'rule-divider' }));
    card.appendChild(renderBlocks(rule.blocks));
    const train = trainBtn(rule);
    if (train) card.appendChild(train);
  }

  card.appendChild(actions(
    actionBtn(revealed ? 'Скрыть' : 'Показать правило', toggleRulesReveal, { primary: !revealed }),
    actionBtn('Следующее →', nextRule),
  ));

  if (!revealed) {
    card.appendChild(el('p', {
      class: 'card__hint',
      text: 'Подсказка: клик по карточке тоже показывает правило.',
    }));
  }

  content.appendChild(card);
}

export function renderRules() {
  const status = $('#rules-status');
  const content = $('#rules-content');
  const counter = $('#rules-counter');
  const catControl = $('#rules-category-control');
  const search = $('#rules-search');
  const restart = $('#rules-restart');
  const r = state.rules;

  if (r.loading) {
    status.hidden = false;
    status.textContent = 'Загрузка правил…';
    content.replaceChildren();
    hideRulesChrome();
    counter.textContent = '';
    return;
  }
  if (r.error) {
    status.hidden = false;
    status.textContent =
      `Не удалось загрузить ${RULES_URL}: ${r.error}. ` +
      `Создай файл (формат — в docs/prompt-rules.md) и убедись, ` +
      `что приложение открыто через статический сервер.`;
    content.replaceChildren();
    hideRulesChrome();
    counter.textContent = '';
    return;
  }
  if (!r.items.length) {
    status.hidden = false;
    status.textContent = 'Правил пока нет. Добавь их в docs/greek-rules.json.';
    content.replaceChildren();
    hideRulesChrome();
    counter.textContent = '';
    return;
  }

  if (isTrainingActive()) {
    status.hidden = true;
    hideRulesChrome({ alsoHideSubmode: true });
    renderTraining(content);
    return;
  }

  catControl.hidden = false;
  renderCategorySelect();
  renderTagFilter();

  const filteredCount = getFilteredRules().length;
  if (!filteredCount) {
    status.hidden = false;
    status.textContent = 'По текущему фильтру правил не найдено. Сбросьте категорию или теги.';
    content.replaceChildren();
    search.hidden = r.submode !== 'list';
    restart.hidden = r.submode !== 'cards';
    counter.textContent = `0 / ${r.items.length}`;
    return;
  }

  status.hidden = true;
  if (r.submode === 'list') {
    search.hidden = false;
    restart.hidden = true;
    renderRulesList(content);
  } else {
    search.hidden = true;
    restart.hidden = false;
    renderRulesCards(content);
  }
}
