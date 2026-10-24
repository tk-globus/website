// Схема «Подія» (специфікація 0001, модуль 1). Одна схема на двох: збірка сайту (src/content.config.ts)
// і тест імпортера (tests/scripts/), тому тут лише `astro/zod` — без віртуальних модулів Astro.
// Поля плоскі, щоб на них пізніше ліг Keystatic: початок і кінець — `РРРР-ММ-ДДTГГ:ХХ` (київський час),
// обкладинка — шлях до файлу, посилання — список «назва + адреса».
// Майбутня чи минула — не поле: це рахується з дати під час збірки (src/lib/events.ts).
// Невалідний файл (немає заголовка, неправильна дата, кінець раніше за початок, зайве поле) ламає збірку.
import { z } from 'astro/zod';
import type { SchemaContext } from 'astro:content';
import { isoDateTime } from './fields.ts';

export const eventLinkSchema = z
  .object({
    /** Підпис кнопки: «Реєстрація команд», «Умови». */
    name: z.string().min(1),
    url: z.string().url(),
  })
  .strict();

export type EventLink = z.infer<typeof eventLinkSchema>;

export const eventSchema = ({ image }: { image: SchemaContext['image'] }) =>
  z
    .object({
      title: z.string().min(1),
      /** Початок: `2026-10-25T08:00` (київський час). */
      start: isoDateTime(),
      /** Кінець (необовʼязково): `2025-04-02T21:00`; багатоденна подія — `2023-10-29T19:00`. */
      end: isoDateTime().optional(),
      /** Місце: «Онлайн, Zoom», «магазин "Команда Екс", вул. …». */
      location: z.string().min(1).optional(),
      /** Обкладинка — відносний шлях до фото в src/assets/events/<slug>/. */
      cover: image().optional(),
      /** Опис фото для скрінрідерів; порожній, якщо фото декоративне. */
      coverAlt: z.string().optional(),
      /** Короткий опис: для карток і превʼю в месенджерах. */
      description: z.string().min(1),
      /** Посилання події: реєстрація, умови, регламент. */
      links: z.array(eventLinkSchema).optional(),
      /** Адреса оригіналу на старому сайті — для майбутніх редиректів (ADR 0004). */
      legacyUrl: z.string().url(),
    })
    .strict()
    .refine((e) => !e.end || e.end >= e.start, { message: 'кінець події раніше за початок', path: ['end'] });
