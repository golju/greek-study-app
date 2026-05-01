import { state } from '../../core/state.js';

export function collectFilterOptions() {
  const r = state.rules;
  const counts = new Map();
  for (const rule of r.items) {
    if (!rule.category) continue;
    counts.set(rule.category, (counts.get(rule.category) ?? 0) + 1);
  }
  r.allCategories = [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export function recomputeTagsInCategory() {
  const r = state.rules;
  const counts = new Map();
  for (const rule of r.items) {
    if (r.activeCategory && rule.category !== r.activeCategory) continue;
    for (const t of rule.tags || []) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  r.tagsInCategory = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  for (const t of [...r.activeTags]) {
    if (!counts.has(t)) r.activeTags.delete(t);
  }
}

export function ruleMatchesFilters(rule) {
  const r = state.rules;
  if (r.activeCategory && rule.category !== r.activeCategory) return false;
  if (r.activeTags.size > 0) {
    const tags = rule.tags || [];
    if (!tags.some((t) => r.activeTags.has(t))) return false;
  }
  return true;
}

export function getFilteredRules() {
  return state.rules.items.filter(ruleMatchesFilters);
}

export function getFilteredIndices() {
  const out = [];
  state.rules.items.forEach((rule, i) => {
    if (ruleMatchesFilters(rule)) out.push(i);
  });
  return out;
}

export function rebuildRulesOrder() {
  const idxs = getFilteredIndices();
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  state.rules.cards.order = idxs;
  state.rules.cards.idx = 0;
  state.rules.cards.revealed = false;
}

export function indexRuleCards(items) {
  const m = new Map();
  for (const c of items) {
    if (!c || !c.rule_id) continue;
    const arr = m.get(c.rule_id) ?? [];
    arr.push(c);
    m.set(c.rule_id, arr);
  }
  return m;
}

export function getCardsForRule(ruleId) {
  return state.rules.ruleCards.byRule.get(ruleId) ?? [];
}

export function findRuleById(id) {
  return state.rules.items.find((r) => r.id === id) ?? null;
}

export function buildRuleHaystack(r) {
  const parts = [r.id, r.title, r.summary, r.category];
  if (r.tags) parts.push(...r.tags);
  for (const b of r.blocks || []) {
    if (b.type === 'p') parts.push(b.text);
    else if (b.type === 'list') parts.push(...(b.items || []));
    else if (b.type === 'examples') {
      for (const ex of b.items || []) parts.push(ex.gr, ex.ru);
    }
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}
