import { RULES_URL } from '../core/constants.js';

export async function loadRules() {
  const res = await fetch(RULES_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Ожидался массив правил');
  return data;
}
