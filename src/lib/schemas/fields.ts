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
