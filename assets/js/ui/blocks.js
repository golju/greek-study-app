import { el } from '../core/dom.js';

export function renderBlocks(blocks) {
  const frag = document.createDocumentFragment();
  for (const b of blocks || []) {
    if (b.type === 'p') {
      frag.appendChild(el('p', { class: 'rule-p', text: b.text ?? '' }));
    } else if (b.type === 'list') {
      const ul = el('ul', { class: 'rule-list' });
      for (const item of b.items || []) ul.appendChild(el('li', { text: item }));
      frag.appendChild(ul);
    } else if (b.type === 'examples') {
      const tbody = el('tbody');
      for (const ex of b.items || []) {
        tbody.appendChild(el('tr', {},
          el('td', { class: 'examples__gr', text: ex.gr ?? '' }),
          el('td', { class: 'examples__ru', text: ex.ru ?? '' }),
        ));
      }
      frag.appendChild(el('table', { class: 'examples' }, tbody));
    } else {
      frag.appendChild(el('p', {
        class: 'rule-p',
        text: `[неизвестный тип блока: ${b.type}]`,
      }));
    }
  }
  return frag;
}
