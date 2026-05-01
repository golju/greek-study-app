export const DATA_URL = 'docs/greek-words.json';
export const RULES_URL = 'docs/greek-rules.json';
export const CARDS_URL = 'docs/greek-rule-cards.json';

export const PERSON_ORDER = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'];

export const PERSON_LABEL = {
  '1sg': '1 л. ед. (я)',
  '2sg': '2 л. ед. (ты)',
  '3sg': '3 л. ед. (он/она)',
  '1pl': '1 л. мн. (мы)',
  '2pl': '2 л. мн. (вы)',
  '3pl': '3 л. мн. (они)',
};

export const PERSON_LABEL_SHORT = {
  '1sg': '1sg', '2sg': '2sg', '3sg': '3sg',
  '1pl': '1pl', '2pl': '2pl', '3pl': '3pl',
};

export const TENSES = ['past', 'present', 'future'];

export const TENSE_LABEL = {
  past: 'Прошедшее',
  present: 'Настоящее',
  future: 'Будущее',
};

export const REVEAL_SUBMODES = new Set(['lemma-ru', 'ru-lemma', 'name-form']);

export const CATEGORY_LABEL = {
  verbs: 'Глаголы',
  nouns: 'Существительные',
  articles: 'Артикли',
  pronouns: 'Местоимения',
  adjectives: 'Прилагательные',
  adverbs: 'Наречия',
  prepositions: 'Предлоги',
  particles: 'Частицы',
  numbers: 'Числительные',
  syntax: 'Синтаксис',
  phonology: 'Фонология',
  vocabulary: 'Лексика',
};
