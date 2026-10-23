// Дати контенту зберігаються як `РРРР-ММ-ДД` (без часу), тож показуємо їх у UTC — без зсуву на день.
const longFormat = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** «8 жовтня 2026» */
export const formatDate = (date: Date) => longFormat.format(date).replace(/\s*р\.$/, '');

/** `2026-10-08` — для атрибута datetime у <time>. */
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);
