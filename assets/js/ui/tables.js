import { el } from '../core/dom.js';
import { PERSON_ORDER, PERSON_LABEL, PERSON_LABEL_SHORT } from '../core/constants.js';

export function sortForms(forms) {
  return [...forms].sort(
    (a, b) => PERSON_ORDER.indexOf(a.person) - PERSON_ORDER.indexOf(b.person),
  );
}

export function findForm(word, person) {
  return word.forms.find((f) => f.person === person);
}

export function personCell(person, opts = {}) {
  const attrs = { scope: 'row', class: 'person-label' };
  if (opts.class) attrs.class += ' ' + opts.class;
  if (opts.on) attrs.on = opts.on;
  return el('th', attrs,
    el('span', { class: 'person-label__full', text: PERSON_LABEL[person] ?? person }),
    el('span', { class: 'person-label__short', text: PERSON_LABEL_SHORT[person] ?? person }),
  );
}

export function makeFormsTable(forms) {
  const tbody = el('tbody');
  for (const f of sortForms(forms)) {
    tbody.appendChild(
      el('tr', {},
        personCell(f.person),
        el('td', { text: f.past ?? '' }),
        el('td', { text: f.present ?? '' }),
        el('td', { text: f.future ?? '' }),
      ),
    );
  }
  const table = el('table', { class: 'forms' },
    el('thead', {},
      el('tr', {},
        el('th', { text: 'Лицо' }),
        el('th', { text: 'Past' }),
        el('th', { text: 'Present' }),
        el('th', { text: 'Future' }),
      ),
    ),
    tbody,
  );
  return el('div', { class: 'table-wrap' }, table);
}
