import { CARDS_URL } from '../core/constants.js';

export async function loadRuleCards() {
  const res = await fetch(CARDS_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Ожидался массив карточек');
  return data;
}
