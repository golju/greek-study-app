import { el } from '../core/dom.js';

export function ruleBadges(rule) {
  if (!rule.category && !rule.tags?.length) return null;
  const meta = el('div', { class: 'rule-badges' });
  if (rule.category) {
    meta.appendChild(el('span', { class: 'badge badge--category', text: rule.category }));
  }
  for (const t of rule.tags || []) {
    meta.appendChild(el('span', { class: 'badge', text: t }));
  }
  return meta;
}
