export function createInitialState() {
  return {
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
      allCategories: [],
      activeCategory: '',
      tagsInCategory: [],
      activeTags: new Set(),
      ruleCards: {
        loaded: false,
        loading: false,
        error: null,
        items: [],
        byRule: new Map(),
      },
      training: {
        ruleId: null,
        order: [],
        idx: 0,
        revealed: false,
      },
    },
  };
}

export const state = createInitialState();
