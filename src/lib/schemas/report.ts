// Схема «Звіт про похід» (специфікація 0001, модуль 1, уточнено аудитом старого сайту).
// Одна схема на трьох: збірка сайту (src/content.config.ts), імпортер (нормалізує значення старого сайту
// до переліків нижче) і тест імпортера — тому тут лише `astro/zod`, без віртуальних модулів Astro.
// Переліки — значення таксономій старого сайту; з них беруться й фільтри бібліотеки (тікет 08).
// Невалідний файл (вид поза переліком, «7 к.с.», зайве поле) ламає збірку з поясненням.
import { z } from 'astro/zod';
import type { SchemaContext } from 'astro:content';

/** Вид туризму — 11 значень старого сайту. */
export const REPORT_KINDS = [
  'гірський',
  'пішохідний',
  'альпінізм',
  'велотуризм',
  'автотуризм',
  'водний',
  'лижний',
  'спелеотуризм',
  'перегони',
  'автостоп',
  'інше',
] as const;

/** Категорія складності: н/к або 1–6 к.с. (у файлі — `н/к`, `1`…`6`; на сайті — «2 к.с.»). */
export const REPORT_GRADES = ['н/к', '1', '2', '3', '4', '5', '6'] as const;

/** Район — 27 значень старого сайту; у звіту їх може бути кілька. */
export const REPORT_REGIONS = [
  'Карпати',
  'Кавказ',
  'Крим',
  'Тянь-Шань',
  'Памір',
  'Алтай',
  'Паміро-Алай',
  'Тавр',
  'Скандинавські гори',
  'Кольський п-в',
  'Урал',
  'Родопи',
  'Гімалаї',
  'Динарські Альпи',
  'Саяни',
  'Карелія',
  'Альпи',
  'Понт',
  'Камчатка',
  'Кордильєри',
  'Атлас',
  'Кузнецький Алатау',
  'Корсика',
  'Кунь-Лунь',
  'Нань-Шань',
  'Тибет',
  'Каракорум',
] as const;

export const REPORT_SEASONS = ['зима', 'весна', 'літо', 'осінь'] as const;

/** Тип матеріалу (на старому сайті «Опис району/фоторепортаж» — це «опис району»). */
export const REPORT_MATERIALS = ['технічний звіт', 'нарис', 'опис району'] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];
export type ReportGrade = (typeof REPORT_GRADES)[number];
export type ReportRegion = (typeof REPORT_REGIONS)[number];

/** Файл звіту (PDF тощо) — лежить на старому сайті, сюди не копіюється (ADR 0004). */
export const reportFileSchema = z
  .object({
    /** Назва, як на старому сайті (`2car25tm.pdf`). */
    name: z.string().min(1),
    /** Повна адреса файлу на старому сайті. */
    url: z.string().url(),
    /** Розмір у байтах; невідомий — поля немає. */
    size: z.number().int().positive().optional(),
  })
  .strict();

export type ReportFile = z.infer<typeof reportFileSchema>;

export const reportSchema = ({ image }: { image: SchemaContext['image'] }) =>
  z
    .object({
      title: z.string().min(1),
      kind: z.enum(REPORT_KINDS),
      /** Необовʼязкова: у 43 % звітів старого сайту її немає. */
      grade: z.enum(REPORT_GRADES).optional(),
      regions: z.array(z.enum(REPORT_REGIONS)).optional(),
      year: z.number().int().min(1900).max(2100).optional(),
      /** Автори (зазвичай керівник групи). */
      authors: z.array(z.string().min(1)).optional(),
      /** Нитка маршруту: «с. Бистриця – пол. Тавпиш – …». */
      route: z.string().min(1).optional(),
      countries: z.array(z.string().min(1)).optional(),
      season: z.enum(REPORT_SEASONS).optional(),
      material: z.enum(REPORT_MATERIALS).optional(),
      files: z.array(reportFileSchema).optional(),
      /** Короткий опис: для превʼю в месенджерах. */
      description: z.string().min(1),
      /** Обкладинка — відносний шлях до фото в src/assets/reports/<slug>/. */
      cover: image().optional(),
      /** Опис фото для скрінрідерів; порожній, якщо фото декоративне. */
      coverAlt: z.string().optional(),
      /** Адреса оригіналу на старому сайті — для майбутніх редиректів (ADR 0004). */
      legacyUrl: z.string().url(),
    })
    .strict();
