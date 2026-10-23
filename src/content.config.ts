// Колекції контенту. Кожен запис — Markdown-файл у src/content/<колекція>/, перевірений схемою з src/lib/schemas/.
// Невалідний файл ламає збірку. Новини пише імпортер (scripts/import/), їх можна правити й руками.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { newsSchema } from './lib/schemas/news.ts';
import { withRawDates } from './lib/raw-dates.ts';

const news = defineCollection({
  loader: withRawDates(glob({ pattern: '*.md', base: './src/content/news' }), ['date']),
  schema: newsSchema,
});

export const collections = { news };
