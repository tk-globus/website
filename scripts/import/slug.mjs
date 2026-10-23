// Адреса запису з українського заголовка: офіційна транслітерація (постанова КМУ № 55 від 2010 р.),
// лише латиниця, цифри й дефіси. «Клубний вечір відбувся!» → «klubnyi-vechir-vidbuvsia».
const MAP = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i',
  ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia',
  // Російські літери (у старих матеріалах трапляються).
  ё: 'io', ы: 'y', э: 'e', ъ: '',
};
// На початку слова деякі літери пишуться інакше: «Єнакієве» → «Yenakiieve».
const WORD_START = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' };

const MAX_LENGTH = 80;

export function transliterate(text) {
  let out = '';
  let prevIsLetter = false;
  for (const ch of text.toLowerCase().replace(/зг/g, 'zgh')) {
    const isLetter = /[\p{L}'ʼ’`]/u.test(ch); // апостроф — усередині слова: «імʼя» → «imia»
    if (!prevIsLetter && WORD_START[ch]) out += WORD_START[ch];
    else out += MAP[ch] ?? ch;
    prevIsLetter = isLetter;
  }
  return out;
}

export function slugify(text) {
  const slug = transliterate(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['ʼ’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= MAX_LENGTH) return slug;
  return slug.slice(0, MAX_LENGTH).replace(/-[^-]*$/, '');
}
