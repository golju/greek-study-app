import { $ } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { renderList } from './wordsListRender.js';

export function bindListEvents() {
  $('#list-search').addEventListener('input', (e) => {
    state.list.query = e.target.value;
    renderList();
  });
}
