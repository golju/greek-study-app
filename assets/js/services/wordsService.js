import { DATA_URL } from '../core/constants.js';

export async function loadWords() {
  const res = await fetch(DATA_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) {
    throw new Error('Пустой или некорректный JSON');
  }
  return data;
}
