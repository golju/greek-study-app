import { state } from '../../core/state.js';
import { loadRules } from '../../services/rulesService.js';
import { loadRuleCards } from '../../services/ruleCardsService.js';
import {
  collectFilterOptions,
  recomputeTagsInCategory,
  rebuildRulesOrder,
  indexRuleCards,
} from './rulesFilters.js';
import { renderRules } from './rulesRender.js';

export async function ensureRulesLoaded() {
  const r = state.rules;
  if (r.loaded || r.loading) return;
  r.loading = true;
  r.error = null;
  renderRules();
  ensureRuleCardsLoaded();
  try {
    const data = await loadRules();
    r.items = data;
    r.loaded = true;
    collectFilterOptions();
    recomputeTagsInCategory();
    rebuildRulesOrder();
  } catch (err) {
    r.error = err.message;
  } finally {
    r.loading = false;
    renderRules();
  }
}

// Загружается «тихо»: ошибка не блокирует UI, просто не будет кнопки тренировки.
export async function ensureRuleCardsLoaded() {
  const rc = state.rules.ruleCards;
  if (rc.loaded || rc.loading) return;
  rc.loading = true;
  rc.error = null;
  try {
    const data = await loadRuleCards();
    rc.items = data;
    rc.byRule = indexRuleCards(data);
    rc.loaded = true;
  } catch (err) {
    rc.error = err.message;
    rc.items = [];
    rc.byRule = new Map();
  } finally {
    rc.loading = false;
    if (state.mode === 'rules') renderRules();
  }
}

export function toggleRulesReveal() {
  state.rules.cards.revealed = !state.rules.cards.revealed;
  renderRules();
}

export function nextRule() {
  const total = state.rules.cards.order.length;
  if (!total) return;
  state.rules.cards.idx = (state.rules.cards.idx + 1) % total;
  state.rules.cards.revealed = false;
  renderRules();
}

export function restartRules() {
  rebuildRulesOrder();
  renderRules();
}

export function changeRulesSubmode(sm) {
  state.rules.submode = sm;
  state.rules.cards.revealed = false;
  renderRules();
}

export function changeCategory(cat) {
  const r = state.rules;
  r.activeCategory = cat;
  r.activeTags.clear();
  recomputeTagsInCategory();
  rebuildRulesOrder();
  renderRules();
}

export function toggleTag(tag) {
  const r = state.rules;
  if (tag === '') {
    r.activeTags.clear();
  } else if (r.activeTags.has(tag)) {
    r.activeTags.delete(tag);
  } else {
    r.activeTags.add(tag);
  }
  rebuildRulesOrder();
  renderRules();
}
