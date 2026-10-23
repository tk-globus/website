#!/usr/bin/env node
// Імпортер контенту зі старого сайту tkg.org.ua (ADR 0004). Окремий скрипт, не частина збірки сайту:
// запускається руками, результат (Markdown-файли й фото) комітиться в репо.
//
//   npm run import -- news                  вибірка для прототипу (за замовчуванням)
//   npm run import -- news --scope all      усі новини зі сторінок архіву старого сайту
//   npm run import -- news --limit 3        лише перші 3 записи
//   npm run import -- news --refresh        завантажити сторінки заново, а не з кешу
//   npm run import -- reports               звіти: вибірка з аудиту; --scope all — уся бібліотека (/trip_search)
//
// Кеш сторінок і фото — .cache/old-site/ (у .gitignore). Між запитами в мережу — пауза 1,5–2 с.
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { createFetcher } from './fetcher.mjs';
import { runImport, summarizeUnrecognized } from './core.mjs';
import { types } from './types/index.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    scope: { type: 'string', default: 'sample' },
    limit: { type: 'string' },
    refresh: { type: 'boolean', default: false },
    root: { type: 'string', default: '.' },
  },
});

const [typeName] = positionals;
const type = types[typeName];
if (!type) {
  console.error(`Вкажіть тип контенту: ${Object.keys(types).join(', ')}. Напр.: npm run import -- news`);
  process.exit(1);
}

const root = resolve(values.root);
const log = (msg) => console.log(msg);
const fetcher = createFetcher({ cacheDir: resolve('.cache/old-site'), refresh: values.refresh, log });

console.log(`Імпорт: ${type.label}, обсяг — ${values.scope === 'all' ? 'усе' : 'вибірка'}`);
const { results, failed, warnings } = await runImport(type, {
  root,
  fetcher,
  scope: values.scope,
  limit: values.limit ? Number(values.limit) : undefined,
  log,
});

const count = (status) => results.filter((r) => r.status === status).length;
console.log(
  `\nГотово: нових ${count('created')}, оновлено ${count('updated')}, без змін ${count('unchanged')}, ` +
    `помилок ${failed.length}. Запитів у мережу: ${fetcher.requests}.`,
);
for (const w of warnings) console.log(`! ${w}`);
const unrecognized = summarizeUnrecognized(results);
if (unrecognized.length) {
  console.log(`\nНе вдалося нормалізувати (значення пропущено, решту запису імпортовано): ${unrecognized.length}`);
  for (const { field, value, slugs } of unrecognized) console.log(`  ? ${field} «${value}» — ${slugs.join(', ')}`);
}
if (failed.length) process.exit(1);
