// Колекції контенту. Кожен запис — Markdown-файл у src/content/<колекція>/, перевірений схемою з src/lib/schemas/.
// Невалідний файл ламає збірку. Новини й звіти пише імпортер (scripts/import/), їх можна правити й руками.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { newsSchema } from './lib/schemas/news.ts';
import { reportSchema } from './lib/schemas/report.ts';
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

export const collections = { news, reports };
