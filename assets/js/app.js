(() => {
  const DATA_URL = 'docs/greek-words.json';
  const RULES_URL = 'docs/greek-rules.json';

  const PERSON_ORDER = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'];
  const PERSON_LABEL = {
    '1sg': '1 л. ед. (я)',
    '2sg': '2 л. ед. (ты)',
    '3sg': '3 л. ед. (он/она)',
    '1pl': '1 л. мн. (мы)',
    '2pl': '2 л. мн. (вы)',
    '3pl': '3 л. мн. (они)',
  };
  const PERSON_LABEL_SHORT = {
    '1sg': '1sg', '2sg': '2sg', '3sg': '3sg',
    '1pl': '1pl', '2pl': '2pl', '3pl': '3pl',
  };
  const TENSES = ['past', 'present', 'future'];
  const TENSE_LABEL = {
    past: 'Прошедшее',
    present: 'Настоящее',
    future: 'Будущее',
  };
  const REVEAL_SUBMODES = new Set(['lemma-ru', 'ru-lemma', 'name-form']);

  const state = {
    words: [],
    mode: 'cards',
    cards: {
      submode: 'lemma-ru',
      counter: 1,
      challenge: null,
      revealed: false,
      picked: null,
      answered: false,
      revealedRows: new Set(),
    },
    list: { query: '' },
    rules: {
      loaded: false,
      loading: false,
      error: null,
      items: [],
      submode: 'list',
      list: { query: '' },
      cards: { order: [], idx: 0, revealed: false },
    },
  };

  // ---------- DOM helpers ----------

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'on') {
        for (const [evt, fn] of Object.entries(v)) node.addEventListener(evt, fn);
      } else if (k in node) {
        node[k] = v;
      } else {
        node.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  // ---------- Generic helpers ----------

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function sortForms(forms) {
    return [...forms].sort(
      (a, b) => PERSON_ORDER.indexOf(a.person) - PERSON_ORDER.indexOf(b.person),
    );
  }

  function findForm(word, person) {
    return word.forms.find((f) => f.person === person);
  }

  function personCell(person, opts = {}) {
    const attrs = { scope: 'row', class: 'person-label' };
    if (opts.class) attrs.class += ' ' + opts.class;
    if (opts.on) attrs.on = opts.on;
    return el('th', attrs,
      el('span', { class: 'person-label__full', text: PERSON_LABEL[person] ?? person }),
      el('span', { class: 'person-label__short', text: PERSON_LABEL_SHORT[person] ?? person }),
    );
  }

  function makeFormsTable(forms) {
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

  function actionBtn(label, handler, opts = {}) {
    return el('button', {
      type: 'button',
      class: 'card__btn' + (opts.primary ? ' card__btn--primary' : ''),
      text: label,
      on: { click: handler },
    });
  }

  function actions(...buttons) {
    return el('div', { class: 'card__actions' }, ...buttons);
  }

  // ---------- Cards: state transitions ----------

  function pickChallenge() {
    const c = state.cards;
    const sm = c.submode;
    if (sm === 'lemma-ru' || sm === 'ru-lemma') {
      c.challenge = { word: pickRandom(state.words) };
    } else if (sm === 'name-form' || sm === 'recognize-form') {
      const word = pickRandom(state.words);
      const form = pickRandom(word.forms);
      const tense = pickRandom(TENSES);
      c.challenge = { word, form, tense };
    } else if (sm === 'conjugate-tense') {
      const word = pickRandom(state.words);
      const tense = pickRandom(TENSES);
      c.challenge = { word, tense };
    }
  }

  function resetSubmodeState() {
    const c = state.cards;
    c.revealed = false;
    c.picked = null;
    c.answered = false;
    c.revealedRows = new Set();
  }

  function nextChallenge() {
    state.cards.counter += 1;
    resetSubmodeState();
    pickChallenge();
    renderCard();
  }

  function restart() {
    state.cards.counter = 1;
    resetSubmodeState();
    pickChallenge();
    renderCard();
  }

  function changeSubmode(sm) {
    state.cards.submode = sm;
    state.cards.counter = 1;
    resetSubmodeState();
    pickChallenge();
    renderCard();
  }

  function toggleReveal() {
    state.cards.revealed = !state.cards.revealed;
    renderCard();
  }

  // ---------- Cards: render dispatch ----------

  function renderCard() {
    const card = $('#card');
    card.replaceChildren();
    $('#cards-counter').textContent = `Карточка ${state.cards.counter}`;
    card.classList.toggle('card--clickable', REVEAL_SUBMODES.has(state.cards.submode));

    if (!state.words.length || !state.cards.challenge) return;

    const sm = state.cards.submode;
    if (sm === 'lemma-ru') renderLemmaRu(card);
    else if (sm === 'ru-lemma') renderRuLemma(card);
    else if (sm === 'name-form') renderNameForm(card);
    else if (sm === 'recognize-form') renderRecognizeForm(card);
    else if (sm === 'conjugate-tense') renderConjugateTense(card);

    if (REVEAL_SUBMODES.has(sm)) {
      card.appendChild(el('p', {
        class: 'card__hint',
        text: 'Подсказка: клик по карточке тоже показывает ответ.',
      }));
    }
  }

  // ---------- Submode renderers ----------

  function renderLemmaRu(card) {
    const { word } = state.cards.challenge;
    const revealed = state.cards.revealed;

    card.appendChild(el('div', { class: 'card__stimulus', text: word.verb }));
    if (revealed) {
      card.appendChild(el('div', { class: 'card__answer', text: word.translation }));
      card.appendChild(makeFormsTable(word.forms));
    }
    card.appendChild(actions(
      actionBtn(revealed ? 'Скрыть' : 'Показать перевод', toggleReveal, { primary: !revealed }),
      actionBtn('Следующее →', nextChallenge),
    ));
  }

  function renderRuLemma(card) {
    const { word } = state.cards.challenge;
    const revealed = state.cards.revealed;

    card.appendChild(el('div', { class: 'card__stimulus card__stimulus--ru', text: word.translation }));
    if (revealed) {
      card.appendChild(el('div', { class: 'card__answer', text: word.verb }));
      card.appendChild(makeFormsTable(word.forms));
    }
    card.appendChild(actions(
      actionBtn(revealed ? 'Скрыть' : 'Показать слово', toggleReveal, { primary: !revealed }),
      actionBtn('Следующее →', nextChallenge),
    ));
  }

  function renderNameForm(card) {
    const { word, form, tense } = state.cards.challenge;
    const revealed = state.cards.revealed;

    card.appendChild(el('div', { class: 'card__meta', text: `${word.verb} — ${word.translation}` }));
    card.appendChild(el('div', { class: 'card__cue' },
      el('span', { class: 'card__cue-person', text: PERSON_LABEL[form.person] }),
      ' · ',
      el('span', { class: 'card__cue-tense', text: TENSE_LABEL[tense] }),
    ));

    if (revealed) {
      card.appendChild(el('div', { class: 'card__answer', text: form[tense] }));
      card.appendChild(makeFormsTable(word.forms));
    } else {
      card.appendChild(el('div', { class: 'card__answer card__answer--placeholder', text: '?' }));
    }

    card.appendChild(actions(
      actionBtn(revealed ? 'Скрыть' : 'Показать форму', toggleReveal, { primary: !revealed }),
      actionBtn('Следующее →', nextChallenge),
    ));
  }

  function renderRecognizeForm(card) {
    const c = state.cards;
    const { word, form, tense } = c.challenge;

    card.appendChild(el('div', { class: 'card__cue', text: 'Какое лицо и время?' }));
    card.appendChild(el('div', { class: 'card__stimulus', text: form[tense] }));

    const tbody = el('tbody');
    for (const p of PERSON_ORDER) {
      const row = el('tr', {},
        personCell(p),
        ...TENSES.map((t) => {
          const isCorrect = (p === form.person && t === tense);
          const isPicked = (c.picked && c.picked.person === p && c.picked.tense === t);
          let cls = 'choice-cell';
          if (c.answered) {
            if (isCorrect) cls += ' is-correct';
            else if (isPicked) cls += ' is-wrong';
            else cls += ' is-dim';
          }
          return el('td', { class: 'choice-grid__td' },
            el('button', {
              type: 'button',
              class: cls,
              text: c.answered ? findForm(word, p)[t] : ' ',
              disabled: c.answered,
              on: { click: () => answerRecognize(p, t) },
            }),
          );
        }),
      );
      tbody.appendChild(row);
    }

    const grid = el('table', { class: 'choice-grid' },
      el('thead', {},
        el('tr', {},
          el('th', { text: '' }),
          ...TENSES.map((t) => el('th', { text: TENSE_LABEL[t] })),
        ),
      ),
      tbody,
    );
    card.appendChild(el('div', { class: 'table-wrap' }, grid));

    if (c.answered) {
      const correct = (c.picked.person === form.person && c.picked.tense === tense);
      card.appendChild(el('div', {
        class: 'card__verdict ' + (correct ? 'is-correct' : 'is-wrong'),
        text: correct ? 'Верно' : 'Мимо',
      }));
      card.appendChild(el('div', { class: 'card__answer-meta' },
        el('strong', { text: word.verb }),
        ` — ${word.translation} · `,
        el('span', { text: `${PERSON_LABEL[form.person]}, ${TENSE_LABEL[tense]}` }),
      ));
    }

    card.appendChild(actions(
      actionBtn('Следующее →', nextChallenge, { primary: c.answered }),
    ));
  }

  function answerRecognize(person, tense) {
    const c = state.cards;
    if (c.answered) return;
    c.picked = { person, tense };
    c.answered = true;
    renderCard();
  }

  function renderConjugateTense(card) {
    const c = state.cards;
    const { word, tense } = c.challenge;
    const allRevealed = c.revealedRows.size === PERSON_ORDER.length;

    card.appendChild(el('div', { class: 'card__meta', text: `${word.verb} — ${word.translation}` }));
    card.appendChild(el('div', { class: 'card__cue' },
      'Спрягать в: ',
      el('strong', { text: TENSE_LABEL[tense] }),
    ));

    const tbody = el('tbody');
    for (const p of PERSON_ORDER) {
      const f = findForm(word, p);
      const isRevealed = c.revealedRows.has(p);
      const tr = el('tr', { class: 'conj-row' + (isRevealed ? ' is-revealed' : '') },
        personCell(p),
        el('td', {
          class: 'conj-row__cell',
          on: { click: () => toggleConjRow(p) },
          text: isRevealed ? f[tense] : '?',
        }),
      );
      tbody.appendChild(tr);
    }

    const table = el('table', { class: 'forms conj-table' },
      el('thead', {},
        el('tr', {},
          el('th', { text: 'Лицо' }),
          el('th', { text: TENSE_LABEL[tense] }),
        ),
      ),
      tbody,
    );
    card.appendChild(el('div', { class: 'table-wrap' }, table));

    card.appendChild(actions(
      actionBtn(allRevealed ? 'Скрыть все' : 'Показать все', toggleConjAll, { primary: !allRevealed }),
      actionBtn('Следующее →', nextChallenge),
    ));

    card.appendChild(el('p', {
      class: 'card__hint',
      text: 'Подсказка: клик по строке показывает только её.',
    }));
  }

  function toggleConjRow(person) {
    const set = state.cards.revealedRows;
    if (set.has(person)) set.delete(person);
    else set.add(person);
    renderCard();
  }

  function toggleConjAll() {
    const set = state.cards.revealedRows;
    if (set.size === PERSON_ORDER.length) {
      state.cards.revealedRows = new Set();
    } else {
      state.cards.revealedRows = new Set(PERSON_ORDER);
    }
    renderCard();
  }

  // ---------- List mode ----------

  function buildHaystack(word) {
    const parts = [word.id, word.verb, word.translation];
    for (const f of word.forms) parts.push(f.past, f.present, f.future);
    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  function renderList() {
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

  // ---------- Rules ----------

  function rebuildRulesOrder() {
    const idxs = state.rules.items.map((_, i) => i);
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    state.rules.cards.order = idxs;
    state.rules.cards.idx = 0;
    state.rules.cards.revealed = false;
  }

  async function ensureRulesLoaded() {
    const r = state.rules;
    if (r.loaded || r.loading) return;
    r.loading = true;
    r.error = null;
    renderRules();
    try {
      const res = await fetch(RULES_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Ожидался массив правил');
      r.items = data;
      r.loaded = true;
      rebuildRulesOrder();
    } catch (err) {
      r.error = err.message;
    } finally {
      r.loading = false;
      renderRules();
    }
  }

  function renderBlocks(blocks) {
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

  function ruleBadges(rule) {
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

  function buildRuleHaystack(r) {
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

  function renderRules() {
    const status = $('#rules-status');
    const content = $('#rules-content');
    const search = $('#rules-search');
    const restart = $('#rules-restart');
    const counter = $('#rules-counter');
    const r = state.rules;

    if (r.loading) {
      status.hidden = false;
      status.textContent = 'Загрузка правил…';
      content.replaceChildren();
      search.hidden = true;
      restart.hidden = true;
      counter.textContent = '';
      return;
    }
    if (r.error) {
      status.hidden = false;
      status.textContent =
        `Не удалось загрузить ${RULES_URL}: ${r.error}. ` +
        `Создай файл (формат — в docs/prompt-rules.md) и убедись, ` +
        `что приложение открыто через статический сервер.`;
      content.replaceChildren();
      search.hidden = true;
      restart.hidden = true;
      counter.textContent = '';
      return;
    }
    if (!r.items.length) {
      status.hidden = false;
      status.textContent = 'Правил пока нет. Добавь их в docs/greek-rules.json.';
      content.replaceChildren();
      search.hidden = true;
      restart.hidden = true;
      counter.textContent = '';
      return;
    }

    status.hidden = true;
    if (r.submode === 'list') {
      search.hidden = false;
      restart.hidden = true;
      renderRulesList(content);
    } else {
      search.hidden = true;
      restart.hidden = false;
      renderRulesCards(content);
    }
  }

  function renderRulesList(content) {
    content.replaceChildren();
    const q = state.rules.list.query.trim().toLowerCase();
    const filtered = q
      ? state.rules.items.filter((rule) => buildRuleHaystack(rule).includes(q))
      : state.rules.items;
    $('#rules-counter').textContent = `${filtered.length} / ${state.rules.items.length}`;

    const ul = el('ul', { class: 'rules-list' });
    for (const rule of filtered) {
      const li = el('li', { class: 'rules-list__item' });
      const details = el('details');
      details.appendChild(el('summary', {},
        el('span', { class: 'rules-list__title', text: rule.title }),
        rule.summary ? el('span', { class: 'rules-list__summary', text: ` — ${rule.summary}` }) : null,
      ));
      const badges = ruleBadges(rule);
      if (badges) details.appendChild(badges);
      details.appendChild(renderBlocks(rule.blocks));
      li.appendChild(details);
      ul.appendChild(li);
    }
    content.appendChild(ul);
  }

  function renderRulesCards(content) {
    content.replaceChildren();
    const r = state.rules;
    const total = r.cards.order.length;
    $('#rules-counter').textContent = total
      ? `Карточка ${r.cards.idx + 1} / ${total}`
      : '0 / 0';
    if (!total) return;

    const rule = r.items[r.cards.order[r.cards.idx]];
    const revealed = r.cards.revealed;

    const card = el('article', {
      class: 'card card--rule' + (revealed ? '' : ' card--clickable'),
      on: { click: (e) => {
        if (e.target.closest('button')) return;
        if (!revealed) toggleRulesReveal();
      }},
    });

    card.appendChild(el('div', { class: 'card__stimulus card__stimulus--rule', text: rule.title }));
    if (rule.summary) {
      card.appendChild(el('div', { class: 'rule-summary', text: rule.summary }));
    }
    const badges = ruleBadges(rule);
    if (badges) card.appendChild(badges);

    if (revealed) {
      card.appendChild(el('hr', { class: 'rule-divider' }));
      card.appendChild(renderBlocks(rule.blocks));
    }

    card.appendChild(actions(
      actionBtn(revealed ? 'Скрыть' : 'Показать правило', toggleRulesReveal, { primary: !revealed }),
      actionBtn('Следующее →', nextRule),
    ));

    if (!revealed) {
      card.appendChild(el('p', {
        class: 'card__hint',
        text: 'Подсказка: клик по карточке тоже показывает правило.',
      }));
    }

    content.appendChild(card);
  }

  function toggleRulesReveal() {
    state.rules.cards.revealed = !state.rules.cards.revealed;
    renderRules();
  }

  function nextRule() {
    const total = state.rules.cards.order.length;
    if (!total) return;
    state.rules.cards.idx = (state.rules.cards.idx + 1) % total;
    state.rules.cards.revealed = false;
    renderRules();
  }

  function restartRules() {
    rebuildRulesOrder();
    renderRules();
  }

  function changeRulesSubmode(sm) {
    state.rules.submode = sm;
    state.rules.cards.revealed = false;
    renderRules();
  }

  // ---------- Mode switching ----------

  function setMode(mode) {
    state.mode = mode;
    $$('.mode-btn').forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.classList.toggle('is-active', active);
    });
    $('#view-cards').hidden = mode !== 'cards';
    $('#view-list').hidden = mode !== 'list';
    $('#view-rules').hidden = mode !== 'rules';
    if (mode === 'cards') renderCard();
    else if (mode === 'list') renderList();
    else if (mode === 'rules') {
      if (!state.rules.loaded && !state.rules.loading) ensureRulesLoaded();
      else renderRules();
    }
  }

  // ---------- Init ----------

  function bindEvents() {
    $$('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    $('#cards-submode').addEventListener('change', (e) => changeSubmode(e.target.value));
    $('#cards-restart').addEventListener('click', restart);

    $('#card').addEventListener('click', (e) => {
      if (e.target.closest('button, .choice-cell, .conj-row__cell, summary')) return;
      if (REVEAL_SUBMODES.has(state.cards.submode)) toggleReveal();
    });

    $('#list-search').addEventListener('input', (e) => {
      state.list.query = e.target.value;
      renderList();
    });

    $('#rules-submode').addEventListener('change', (e) => changeRulesSubmode(e.target.value));
    $('#rules-restart').addEventListener('click', restartRules);
    $('#rules-search').addEventListener('input', (e) => {
      state.rules.list.query = e.target.value;
      renderRules();
    });
  }

  async function init() {
    bindEvents();
    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) {
        throw new Error('Пустой или некорректный JSON');
      }
      state.words = data;
      $('#status').hidden = true;
      pickChallenge();
      setMode('cards');
    } catch (err) {
      $('#status').textContent =
        `Не удалось загрузить ${DATA_URL}: ${err.message}. ` +
        `Запусти статический сервер в корне проекта: ` +
        `python3 -m http.server 8000`;
    }
  }

  init();
})();
