// Схема «Новина» (специфікація 0001, модуль 1). Одна схема на двох: збірка сайту (src/content.config.ts)
// і тест імпортера (tests/scripts/), тому тут лише `astro/zod` — без віртуальних модулів Astro.
// Поля прості й плоскі, щоб на них пізніше ліг Keystatic: дата — `РРРР-ММ-ДД`, обкладинка — шлях до файлу.
// Імпорт — з розширенням `.ts`: так файл читає і Astro, і Node у тестах.
// Невалідний файл (немає заголовка, неправильна дата, зайве поле) ламає збірку з поясненням.
import { z } from 'astro/zod';
import type { SchemaContext } from 'astro:content';
import { isoDate } from './fields.ts';

export const newsSchema = ({ image }: { image: SchemaContext['image'] }) =>
  z
    .object({
      title: z.string().min(1),
      /** Дата публікації (`2026-10-08`). */
      date: isoDate(),
      /** Обкладинка — відносний шлях до фото в src/assets/news/<slug>/. */
      cover: image().optional(),
      /** Опис фото для скрінрідерів; порожній, якщо фото декоративне. */
      coverAlt: z.string().optional(),
      /** Короткий опис: для карток і превʼю в месенджерах. */
      description: z.string().min(1),
      /** Адреса оригіналу на старому сайті — для майбутніх редиректів (ADR 0004). */
      legacyUrl: z.string().url(),
    })
    .strict();
