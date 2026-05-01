import { $, el } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { makeFormsTable } from '../../ui/tables.js';

function buildHaystack(word) {
  const parts = [word.id, word.verb, word.translation];
  for (const f of word.forms) parts.push(f.past, f.present, f.future);
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function renderList() {
  const ul = $('#list');
  ul.replaceChildren();
  const q = state.list.query.trim().toLowerCase();
  const filtered = q
    ? state.words.filter((w) => buildHaystack(w).includes(q))
    : state.words;

  $('#list-counter').textContent = `${filtered.length} / ${state.words.length}`;

  const frag = document.createDocumentFragment();
  for (const w of filtered) {
    const li = el('li', { class: 'list__item' });
    const details = el('details');
    const summary = el('summary', {},
      el('span', { class: 'list__verb', text: w.verb }),
      el('span', { class: 'list__translation', text: ` — ${w.translation}` }),
    );
    details.appendChild(summary);
    details.appendChild(makeFormsTable(w.forms));
    li.appendChild(details);
    frag.appendChild(li);
  }
  ul.appendChild(frag);
}
