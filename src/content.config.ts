// Колекції контенту. Кожен запис — Markdown-файл у src/content/<колекція>/, перевірений схемою з src/lib/schemas/.
// Невалідний файл ламає збірку. Новини, звіти й сторінки пише імпортер (scripts/import/), їх можна правити й руками.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { newsSchema } from './lib/schemas/news.ts';
import { reportSchema } from './lib/schemas/report.ts';
import { pageSchema } from './lib/schemas/page.ts';
import { withRawDates } from './lib/raw-dates.ts';

const news = defineCollection({
  loader: withRawDates(glob({ pattern: '*.md', base: './src/content/news' }), ['date']),
  schema: newsSchema,
});

// Звіти про походи (бібліотека): дат немає — лише рік числом.
const reports = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/reports' }),
  schema: reportSchema,
});

// Статичні сторінки («Про клуб», «МКК», «Табір»): імʼя файлу — адреса на сайті (about.md → /about).
const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: pageSchema,
});

export const collections = { news, reports, pages };
