#!/usr/bin/env node
// Імпортер контенту зі старого сайту tkg.org.ua (ADR 0004). Окремий скрипт, не частина збірки сайту:
// запускається руками, результат (Markdown-файли й фото) комітиться в репо.
//
//   npm run import -- news                  вибірка для прототипу (за замовчуванням)
//   npm run import -- news --scope all      усі новини зі сторінок архіву старого сайту
//   npm run import -- news --limit 3        лише перші 3 записи
//   npm run import -- news --refresh        завантажити сторінки заново, а не з кешу
//   npm run import -- events                події: вибірка з аудиту; --scope all — календар старого сайту
//   npm run import -- reports               звіти: вибірка з аудиту; --scope all — уся бібліотека (/trip_search)
//   npm run import -- pages                 статичні сторінки: «Про клуб», «МКК», «Табір» (about.md, mkk.md, camp.md)
//
// Кеш сторінок і фото — .cache/old-site/ (у .gitignore). Між запитами в мережу — пауза 1,5–2 с.
// Помилка в аргументах чи збій мережі — одне речення українською, без стеку (див. cli.mjs).
import { resolve } from 'node:path';
import { createFetcher } from './fetcher.mjs';
import { runImport, summarizeUnrecognized } from './core.mjs';
import { CliError, USAGE, parseCli } from './cli.mjs';
import { types } from './types/index.mjs';

async function main() {
  const options = parseCli(process.argv.slice(2), Object.keys(types));
  const type = types[options.typeName];
  const root = resolve(options.root);
  const log = (msg) => console.log(msg);
  const fetcher = createFetcher({ cacheDir: resolve('.cache/old-site'), refresh: options.refresh, log });

  console.log(`Імпорт: ${type.label}, обсяг — ${options.scope === 'all' ? 'усе' : 'вибірка'}`);
  const { results, failed, warnings } = await runImport(type, {
    root,
    fetcher,
    scope: options.scope,
    limit: options.limit,
    log,
  });

  const count = (status) => results.filter((r) => r.status === status).length;
  const skipped = count('skipped');
  console.log(
    `\nГотово: нових ${count('created')}, оновлено ${count('updated')}, без змін ${count('unchanged')}, ` +
      `${skipped ? `пропущено ${skipped}, ` : ''}помилок ${failed.length}. Запитів у мережу: ${fetcher.requests}.`,
  );
  for (const w of warnings) console.log(`! ${w}`);
  const unrecognized = summarizeUnrecognized(results);
  if (unrecognized.length) {
    console.log(`\nНе вдалося нормалізувати (значення пропущено, решту запису імпортовано): ${unrecognized.length}`);
    for (const { field, value, slugs } of unrecognized) console.log(`  ? ${field} «${value}» — ${slugs.join(', ')}`);
  }
  if (failed.length) process.exitCode = 1;
}

try {
  await main();
} catch (e) {
  if (e instanceof CliError) {
    console.error(`Помилка: ${e.message}.\n\n${USAGE}`);
  } else {
    // Збій поза окремим записом (напр. не відкрилась сторінка-список): причина без стеку.
    console.error(`Імпорт зупинено: ${e.message}`);
  }
  process.exitCode = 1;
}
