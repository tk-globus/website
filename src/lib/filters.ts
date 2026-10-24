// Фільтри списку (бібліотека звітів, тікет 08): опис полів, відповідність запису вибраним значенням
// і стан в адресі сторінки (?region=Кавказ&grade=3). Без залежностей — працює і під час збірки,
// і в скрипті компонента FilterPanel у браузері.

export interface FilterOption {
  /** Значення з переліку схеми — воно ж у параметрі адреси. */
  value: string;
  /** Підпис у списку: «3 к.с.». */
  label: string;
}

export interface FilterField {
  /** Параметр адреси й ключ у значеннях запису: region, kind, grade, year. */
  name: string;
  /** Підпис поля: «Район». */
  label: string;
  /** Пункт «без фільтра»: «Усі райони». */
  anyLabel: string;
  options: FilterOption[];
}

/** Значення запису для фільтрів: { region: ['Кавказ'], grade: ['3'] }. Запис без значення — порожній масив. */
export type FilterValues = Record<string, string[]>;

/** Вибрані фільтри: { region: 'Кавказ', grade: '3' }; поле без вибору відсутнє. */
export type FilterSelection = Record<string, string>;

/** Запис підходить, якщо для кожного вибраного поля має вибране значення (районів у звіту може бути кілька). */
export function matchesFilters(values: FilterValues, selection: FilterSelection): boolean {
  return Object.entries(selection).every(([name, value]) => (values[name] ?? []).includes(value));
}

/** Вибір з адреси: беруться лише поля панелі й значення з їхніх списків (решта ігнорується). */
export function selectionFromSearch(search: string, fields: FilterField[]): FilterSelection {
  const params = new URLSearchParams(search);
  const selection: FilterSelection = {};
  for (const field of fields) {
    const value = params.get(field.name);
    if (value && field.options.some((option) => option.value === value)) selection[field.name] = value;
  }
  return selection;
}

/** Адреса з вибором: параметри полів панелі переписуються, інші параметри адреси лишаються. */
export function searchWithSelection(search: string, fields: FilterField[], selection: FilterSelection): string {
  const params = new URLSearchParams(search);
  for (const field of fields) {
    const value = selection[field.name];
    if (value) params.set(field.name, value);
    else params.delete(field.name);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
