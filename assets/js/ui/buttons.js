import { el } from '../core/dom.js';

export function actionBtn(label, handler, opts = {}) {
  return el('button', {
    type: 'button',
    class: 'card__btn' + (opts.primary ? ' card__btn--primary' : ''),
    text: label,
    on: { click: handler },
  });
}

export function actions(...buttons) {
  return el('div', { class: 'card__actions' }, ...buttons);
}
