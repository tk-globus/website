// Українська множина для лічильників: 1 звіт, 2 звіти, 5 звітів, 11 звітів, 21 звіт.
// Без залежностей — працює і під час збірки, і в скрипті сторінки (лічильник фільтрів).

/** Форми слова: [1 звіт, 2 звіти, 5 звітів]. */
export type PluralForms = readonly [one: string, few: string, many: string];

/** 3, ['звіт', 'звіти', 'звітів'] → «звіти». */
export function pluralWord(n: number, [one, few, many]: PluralForms): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** 3, ['звіт', 'звіти', 'звітів'] → «3 звіти». */
export const pluralCount = (n: number, forms: PluralForms) => `${n} ${pluralWord(n, forms)}`;
