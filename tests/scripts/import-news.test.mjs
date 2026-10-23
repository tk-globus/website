// Імпортер новин на збережених сторінках старого сайту (tests/fixtures/old-site/) — без мережі.
// Перевіряє те, що лягає у файли: поля проходять схему колекції, legacy URL і фото правильні,
// повторний запуск не створює дублікатів.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { z } from 'astro/zod';
import { newsSchema } from '../../src/lib/schemas/news.ts';
import { readFrontmatter, runImport } from '../../scripts/import/core.mjs';
import { createFetcher } from '../../scripts/import/fetcher.mjs';
import { originalImageUrl, parseOldDate } from '../../scripts/import/html.mjs';
import { slugify } from '../../scripts/import/slug.mjs';
import news from '../../scripts/import/types/news.mjs';

const fixture = (name) => readFileSync(new URL(`../fixtures/old-site/${name}`, import.meta.url), 'utf8');
const PAGES = {
  'https://www.tkg.org.ua/node/37936': fixture('news--37936.html'),
  'https://www.tkg.org.ua/node/37934': fixture('news-report-announcement--37934.html'),
};
const FAKE_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

/** Підміна завантажувача: сторінки — з фікстур, фото — кілька байтів. Будь-яка інша адреса — помилка. */
function fakeFetcher(pages = PAGES) {
  const asked = [];
  return {
    asked,
    text: async (url) => {
      asked.push(url);
      if (!(url in pages)) throw new Error(`немає фікстури для ${url}`);
      return pages[url];
    },
    binary: async (url) => {
      asked.push(url);
      return FAKE_JPEG;
    },
  };
}

const withUrls = (urls) => ({ ...news, sampleUrls: () => urls });

// Схема колекції як у збірці; фото — шлях-рядок, існування файлу перевіряємо окремо.
const schema = newsSchema({ image: () => z.string() });

function tempRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'import-news-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

const readEntry = (root, slug) => {
  const file = join(root, news.contentDir, `${slug}.md`);
  const text = readFileSync(file, 'utf8');
  return { file, text, data: readFrontmatter(text), body: text.replace(/^---[\s\S]*?\n---\n/, '') };
};

test('новина: поля, legacy URL, обкладинка-оригінал, тіло в Markdown — і все проходить схему', async (t) => {
  const root = tempRoot(t);
  const fetcher = fakeFetcher();
  const { results, failed } = await runImport(withUrls(Object.keys(PAGES)), { root, fetcher });
  assert.deepEqual(failed, []);
  assert.equal(results.length, 2);

  const { file, data, body } = readEntry(root, 'klubnyi-vechir-iz-nadiieiu-starikovoiu-vidbuvsia');
  const parsed = schema.safeParse(data);
  assert.ok(parsed.success, parsed.error?.message);
  assert.equal(data.title, 'Клубний вечір із Надією Старіковою відбувся!');
  assert.equal(data.date, '2026-10-08');
  assert.equal(data.legacyUrl, 'https://www.tkg.org.ua/node/37936');
  assert.match(data.description, /^Дякуємо всім, хто завітав цього четверга/);
  assert.ok(data.description.length <= 201);

  // Обкладинка — оригінал (без styles/…/public/), завантажений поруч із контентом.
  assert.equal(data.cover, '../../assets/news/klubnyi-vechir-iz-nadiieiu-starikovoiu-vidbuvsia/photo_2026-10-08_08-20-53.jpg');
  assert.ok(existsSync(resolve(dirname(file), data.cover)), 'файл обкладинки є');
  assert.ok(fetcher.asked.includes('https://www.tkg.org.ua/files/news_img/37936/photo_2026-10-08_08-20-53.jpg'));
  assert.ok(!fetcher.asked.some((u) => u.includes('/styles/')), 'зменшені копії не завантажуються');

  // Тіло: Markdown без HTML старого сайту, обкладинка не дублюється в тексті.
  assert.match(body, /Надія - майстриня спорту України/);
  assert.match(body, /\[запис нашого клубного вечора\]\(https:\/\/youtu\.be\/J-F0n-5U0RY\)/);
  assert.doesNotMatch(body, /<[a-z]/i);
  assert.doesNotMatch(body, /photo_2026-10-08/);
});

test('новина-анонс звіту: підпис фото, абсолютне посилання на звіт старого сайту', async (t) => {
  const root = tempRoot(t);
  await runImport(withUrls(['https://www.tkg.org.ua/node/37934']), { root, fetcher: fakeFetcher() });
  const { data, body } = readEntry(root, 'pishokhidnyi-pokhid-2-k-s-karpatamy');
  assert.ok(schema.safeParse(data).success);
  assert.equal(data.date, '2026-09-15');
  assert.equal(data.legacyUrl, 'https://www.tkg.org.ua/node/37934');
  assert.equal(data.coverAlt, 'Група біля вдсп. Шипот');
  assert.match(data.cover, /\/2car25tm_photo\.jpg$/);
  assert.match(body, /\]\(https:\/\/www\.tkg\.org\.ua\/node\/37933/);
  assert.match(body, /Керівник: Тетяна Моянська/);
});

test('повторний запуск не створює дублікатів: той самий legacy URL — той самий файл', async (t) => {
  const root = tempRoot(t);
  const type = withUrls(Object.keys(PAGES));
  await runImport(type, { root, fetcher: fakeFetcher() });
  const filesBefore = readdirSync(join(root, news.contentDir)).sort();
  const textBefore = readEntry(root, 'pishokhidnyi-pokhid-2-k-s-karpatamy').text;

  const again = await runImport(type, { root, fetcher: fakeFetcher() });
  assert.deepEqual(again.results.map((r) => r.status), ['unchanged', 'unchanged']);
  assert.deepEqual(readdirSync(join(root, news.contentDir)).sort(), filesBefore);
  assert.equal(readEntry(root, 'pishokhidnyi-pokhid-2-k-s-karpatamy').text, textBefore);

  // Заголовок на старому сайті змінився — запис оновлюється в тому самому файлі.
  const renamed = { ...PAGES };
  renamed['https://www.tkg.org.ua/node/37934'] = PAGES['https://www.tkg.org.ua/node/37934'].replace(
    '<h1 class="page__title title" id="page-title">Пішохідний похід 2 к.с. Карпатами</h1>',
    '<h1 class="page__title title" id="page-title">Новий заголовок</h1>',
  );
  const third = await runImport(type, { root, fetcher: fakeFetcher(renamed) });
  assert.deepEqual(third.results.map((r) => [r.slug, r.status]), [
    ['klubnyi-vechir-iz-nadiieiu-starikovoiu-vidbuvsia', 'unchanged'],
    ['pishokhidnyi-pokhid-2-k-s-karpatamy', 'updated'],
  ]);
  assert.deepEqual(readdirSync(join(root, news.contentDir)).sort(), filesBefore);
  assert.equal(readEntry(root, 'pishokhidnyi-pokhid-2-k-s-karpatamy').data.title, 'Новий заголовок');
});

test('різні новини з однаковим заголовком отримують різні файли', async (t) => {
  const root = tempRoot(t);
  const twin = PAGES['https://www.tkg.org.ua/node/37934']
    .replace('href="https://www.tkg.org.ua/node/37934"', 'href="https://www.tkg.org.ua/node/37931"');
  const pages = { 'https://www.tkg.org.ua/node/37934': PAGES['https://www.tkg.org.ua/node/37934'], 'https://www.tkg.org.ua/node/37931': twin };
  const { results } = await runImport(withUrls(Object.keys(pages)), { root, fetcher: fakeFetcher(pages) });
  assert.deepEqual(results.map((r) => r.slug), ['pishokhidnyi-pokhid-2-k-s-karpatamy', 'pishokhidnyi-pokhid-2-k-s-karpatamy-37931']);
  assert.equal(readEntry(root, 'pishokhidnyi-pokhid-2-k-s-karpatamy-37931').data.legacyUrl, 'https://www.tkg.org.ua/node/37931');
});

test('обсяг «усе»: адреси новин зі сторінки архіву, події пропускаються', async () => {
  const { urls, next } = news.parseList(fixture('list-news-archive-term--2191.html'));
  assert.ok(urls.length >= 6);
  assert.ok(urls.includes('https://www.tkg.org.ua/node/37936'));
  assert.ok(!urls.includes('https://www.tkg.org.ua/node/37939'), 'подія — не новина');
  assert.equal(next, null);
});

test('вибірка — усі новини з аудиту', () => {
  const urls = news.sampleUrls();
  assert.equal(urls.length, 10);
  assert.ok(urls.includes('https://www.tkg.org.ua/node/37120'));
});

test('інша сторінка (подія) — не новина: зрозуміла помилка, а не порожній запис', () => {
  assert.throws(() => news.parse(fixture('event--37939.html'), 'x'), /не новина/);
});

test('дати, фото-оригінали, адреси записів', () => {
  assert.equal(parseOldDate('08/10/2026 - 08:26'), '2026-10-08');
  assert.throws(() => parseOldDate('31/02/2026 - 10:00'), /неіснуюча/);
  assert.throws(() => parseOldDate(''), /не розпізнав/);
  assert.equal(
    originalImageUrl('https://www.tkg.org.ua/files/styles/150x150/public/news_img/1/a.jpg?itok=xx'),
    'https://www.tkg.org.ua/files/news_img/1/a.jpg',
  );
  assert.equal(originalImageUrl('/files/story_img/2/b.jpg'), 'https://www.tkg.org.ua/files/story_img/2/b.jpg');
  assert.equal(slugify('Кубок “Сніговий барс 2024”'), 'kubok-snihovyi-bars-2024');
  assert.equal(slugify('Згарище, Єнакієве, ім\'я'), 'zgharyshche-yenakiieve-imia');
});

test('схема відкидає невалідну новину', () => {
  const valid = { title: 'Т', date: '2026-10-08', description: 'О', legacyUrl: 'https://www.tkg.org.ua/node/1' };
  assert.ok(schema.safeParse(valid).success);
  assert.ok(!schema.safeParse({ ...valid, title: '' }).success, 'порожній заголовок');
  assert.ok(!schema.safeParse({ ...valid, date: '2026-13-45' }).success, 'неправильна дата');
  assert.ok(!schema.safeParse({ ...valid, legacyUrl: 'node/1' }).success, 'legacy URL — не адреса');
  assert.ok(!schema.safeParse({ ...valid, extra: 1 }).success, 'зайве поле');
});

test('завантажувач: кеш без мережі, пауза 1,5–2 с між запитами', async (t) => {
  const cacheDir = tempRoot(t);
  const calls = [];
  const waits = [];
  const fetcher = createFetcher({
    cacheDir,
    fetchImpl: async (url) => {
      calls.push(url);
      return new Response(`<p>${url}</p>`);
    },
    sleep: async (ms) => waits.push(ms),
  });
  await fetcher.text('https://www.tkg.org.ua/node/1');
  await fetcher.text('https://www.tkg.org.ua/node/2');
  await fetcher.text('https://www.tkg.org.ua/node/1'); // з кешу
  assert.deepEqual(calls, ['https://www.tkg.org.ua/node/1', 'https://www.tkg.org.ua/node/2']);
  assert.equal(fetcher.requests, 2);
  assert.equal(waits.length, 1, 'пауза перед другим запитом у мережу, кеш — без паузи');
  assert.ok(waits[0] > 1400 && waits[0] <= 2000, `пауза ${waits[0]} мс`);
});
