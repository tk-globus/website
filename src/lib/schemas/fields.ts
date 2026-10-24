// Спільні поля схем контенту (новини, події, звіти…).
import { z } from 'astro/zod';

const toDate = (s: string) => new Date(`${s}T00:00:00Z`);

/**
 * Дата `РРРР-ММ-ДД` (як поле дати Keystatic). Лише справжня календарна дата: `2026-13-45` — помилка.
 * У даних сторінок стає Date (опівніч UTC). Сирий рядок із файлу сюди передає withRawDates
 * (src/lib/raw-dates.ts) — інакше YAML сам «виправив» би неіснуючу дату.
 */
export const isoDate = () =>
  z
    .string('дата має бути у форматі РРРР-ММ-ДД, напр. 2026-10-08')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'дата має бути у форматі РРРР-ММ-ДД, напр. 2026-10-08')
    .refine((s) => !Number.isNaN(toDate(s).getTime()) && toDate(s).toISOString().startsWith(s), 'такої дати немає в календарі')
    .transform(toDate);

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;
const DATE_TIME_HINT = 'дата й час мають бути у форматі РРРР-ММ-ДДTГГ:ХХ, напр. 2026-10-25T08:00';

/**
 * Дата й час `РРРР-ММ-ДДTГГ:ХХ` (як поле datetime Keystatic) — київський час, без часового поясу.
 * Лише справжня дата й час (`2026-02-30T08:00` чи `…T25:00` — помилка). Лишається рядком: такі рядки
 * правильно порівнюються між собою, а показ і «майбутня/минула» рахує src/lib/events.ts.
 */
export const isoDateTime = () =>
  z
    .string(DATE_TIME_HINT)
    .regex(DATE_TIME, DATE_TIME_HINT)
    .refine((s) => {
      const [, day, hh, mm] = s.match(DATE_TIME) ?? [];
      return !Number.isNaN(toDate(day).getTime()) && toDate(day).toISOString().startsWith(day) && Number(hh) < 24 && Number(mm) < 60;
    }, 'такої дати чи часу немає в календарі');
