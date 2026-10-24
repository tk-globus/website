// Імпортер подій на збережених сторінках старого сайту (tests/fixtures/old-site/) — без мережі.
// Перевіряє те, що лягає у файли: поля проходять схему колекції, дата й час, місце, посилання події
// (дочірні сторінки книги — реєстрація, умови), legacy URL і обкладинка.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { z } from 'astro/zod';
import { eventSchema } from '../../src/lib/schemas/event.ts';
import { readFrontmatter, runImport } from '../../scripts/import/core.mjs';
import events, { findLocation, parseEventDate } from '../../scripts/import/types/events.mjs';

const fixture = (name) => readFileSync(new URL(`../fixtures/old-site/${name}`, import.meta.url), 'utf8');
const AUTUMN = 'https://www.tkg.org.ua/node/37939';
const LECTURE = 'https://www.tkg.org.ua/node/37532';
const PAGES = {
  [AUTUMN]: fixture('event--37939.html'),
  [LECTURE]: fixture('event-with-end-time--37532.html'),
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

const withUrls = (urls) => ({ ...events, sampleUrls: () => urls });

// Схема колекції як у збірці; фото — шлях-рядок, існування файлу перевіряємо окремо.
const schema = eventSchema({ image: () => z.string() });

function tempRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'import-events-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

const readEntry = (root, slug) => {
  const file = join(root, events.contentDir, `${slug}.md`);
  const text = readFileSync(file, 'utf8');
  return { file, text, data: readFrontmatter(text), body: text.replace(/^---[\s\S]*?\n---\n/, '') };
};

test('подія «Осінній лист 2026»: дата й час, посилання на реєстрацію й умови, обкладинка — і все проходить схему', async (t) => {
  const root = tempRoot(t);
  const fetcher = fakeFetcher();
  const { results, failed } = await runImport(withUrls([AUTUMN]), { root, fetcher });
  assert.deepEqual(failed, []);
  assert.equal(results[0].slug, 'vidkryte-zmahalne-trenuvannia-osinnii-lyst-2026');

  const { file, data, body } = readEntry(root, 'vidkryte-zmahalne-trenuvannia-osinnii-lyst-2026');
  const parsed = schema.safeParse(data);
  assert.ok(parsed.success, parsed.error?.message);
  assert.equal(data.title, 'Відкрите змагальне тренування "Осінній лист 2026"');
  assert.equal(data.start, '2026-10-25T08:00');
  assert.equal(data.end, undefined);
  assert.equal(data.location, undefined, 'рядка «Де:» у тексті немає');
  assert.equal(data.legacyUrl, AUTUMN);
  assert.match(data.description, /^Запрошуємо на відкрите змагальне тренування/);

  // Дочірні сторінки книги — посилання події (на старий сайт), далі документ Google з тексту.
  assert.deepEqual(data.links, [
    { name: 'Реєстрація команд', url: 'https://www.tkg.org.ua/node/37940' },
    { name: 'Умови', url: 'https://www.tkg.org.ua/node/37941' },
    {
      name: 'Google-документ',
      url: 'https://docs.google.com/document/d/1sO4KbtV-CFwuAcHzI50Gnfbx4XEzP7pP/edit?usp=sharing&ouid=111745182812479847337&rtpof=true&sd=true',
    },
  ]);

  // Обкладинка — оригінал (без styles/…/public/), завантажений поруч із контентом, і в тексті не дублюється.
  assert.equal(data.cover, '../../assets/events/vidkryte-zmahalne-trenuvannia-osinnii-lyst-2026/autumn_leave_2026_main.jpg');
  assert.ok(existsSync(resolve(dirname(file), data.cover)), 'файл обкладинки є');
  assert.ok(fetcher.asked.includes('https://www.tkg.org.ua/files/event_img/37939/autumn_leave_2026_main.jpg'));
  assert.doesNotMatch(body, /autumn_leave/);
  assert.doesNotMatch(body, /<[a-z]/i);
  assert.match(body, /Дата проведення — 25 жовтня/);
});

test('лекція з часом закінчення і місцем «Де: Онлайн, Zoom: …»', async (t) => {
  const root = tempRoot(t);
  await runImport(withUrls([LECTURE]), { root, fetcher: fakeFetcher() });
  const { data } = readEntry(root, 'lektsiia-hirski-perepravy-02-04-2025');
  assert.ok(schema.safeParse(data).success);
  assert.equal(data.start, '2025-04-02T19:00');
  assert.equal(data.end, '2025-04-02T21:00');
  assert.equal(data.location, 'Онлайн, Zoom');
  assert.equal(data.links, undefined, 'Zoom — не посилання події (воно лишається в тексті)');
  assert.equal(data.legacyUrl, LECTURE);
});

test('порожня чернетка (заголовок «.», без тексту) пропускається без файлу і без помилки', async (t) => {
  const root = tempRoot(t);
  const draft = PAGES[AUTUMN]
    .replace(/(<h1[^>]*>)[^<]*(<\/h1>)/, '$1.$2')
    .replace(/<div class="field field-name-body[\s\S]*?<div id="book-navigation/, '<div id="book-navigation');
  const { results, failed } = await runImport(withUrls([AUTUMN]), { root, fetcher: fakeFetcher({ [AUTUMN]: draft }) });
  assert.deepEqual(failed, []);
  assert.equal(results[0].status, 'skipped');
  assert.ok(!existsSync(join(root, events.contentDir)) || readdirSync(join(root, events.contentDir)).length === 0);
});

test('биті фото з тимчасової теки Drupal прибираються з тексту', () => {
  const html = PAGES[AUTUMN].replace(
    '<p><img src="https://www.tkg.org.ua/files/styles/150x150/public/event_img/37939/autumn_leave_2026_main.jpg?itok=Ag05_X2V" width="150" height="84" alt="" class="image-150x150 news-right-pic" />',
    '<p><a href="https://www.tkg.org.ua/system/temporary/filefield_paths/x.jpg"><img src="https://www.tkg.org.ua/system/temporary/filefield_paths/x.jpg" /></a>',
  );
  const parsed = events.parse(html, AUTUMN);
  assert.equal(parsed.cover, null);
  assert.doesNotMatch(parsed.bodyHtml, /system\/temporary/);
});

test('дата події: один час, час закінчення, кілька днів; неправильна дата — зрозуміла помилка', () => {
  assert.deepEqual(parseEventDate('Дата: 25/10/2026 - 08:00'), { start: '2026-10-25T08:00' });
  assert.deepEqual(parseEventDate('02/04/2025 - 19:00 до 21:00'), { start: '2025-04-02T19:00', end: '2025-04-02T21:00' });
  assert.deepEqual(parseEventDate('28/10/2023 - 07:00 до 29/10/2023 - 19:00'), {
    start: '2023-10-28T07:00',
    end: '2023-10-29T19:00',
  });
  assert.throws(() => parseEventDate('31/02/2026 - 10:00'), /неіснуюча дата/);
  assert.throws(() => parseEventDate('25/10/2026 - 25:00'), /неіснуючий час/);
  assert.throws(() => parseEventDate('завтра'), /не розпізнав дату/);
  assert.throws(() => parseEventDate('25/10/2026 - 19:00 до 18:00'), /раніше за початок/);
});

test('місце з тексту: перше речення, без адрес, скорочення не ріжуть', () => {
  assert.equal(findLocation('Коли: четвер\nДе: Онлайн, Zoom: https://us06web.zoom.us/j/1\nПочаток: 19:00'), 'Онлайн, Zoom');
  assert.equal(findLocation('Де: онлайн. Посилання на зум:'), 'Онлайн');
  assert.equal(findLocation('Місце проведення: м. Київ'), 'м. Київ');
  assert.equal(findLocation('Де: магазин "Команда Екс", вул. Михайлівська, 15'), 'Магазин "Команда Екс", вул. Михайлівська, 15');
  assert.equal(findLocation('Де: місце проведення повідомимо згодом.'), undefined);
  assert.equal(findLocation('Без місця'), undefined);
});

test('обсяг «усе»: адреси подій зі сторінки архіву, новини пропускаються', () => {
  const { urls, next } = events.parseList(fixture('list-news-archive-term--2191.html'));
  assert.ok(urls.includes(AUTUMN));
  assert.ok(!urls.includes('https://www.tkg.org.ua/node/37936'), 'новина — не подія');
  assert.equal(next, null);
});

test('вибірка — усі події з аудиту, зокрема «Осінній лист 2026»', () => {
  const urls = events.sampleUrls();
  assert.equal(urls.length, 27);
  assert.ok(urls.includes(AUTUMN));
});

test('інша сторінка (новина) — не подія: зрозуміла помилка', () => {
  assert.throws(() => events.parse(fixture('news--37936.html'), 'x'), /не подія/);
});

test('схема відкидає невалідну подію', () => {
  const valid = { title: 'Т', start: '2026-10-25T08:00', description: 'О', legacyUrl: 'https://www.tkg.org.ua/node/1' };
  assert.ok(schema.safeParse(valid).success);
  assert.ok(schema.safeParse({ ...valid, end: '2026-10-26T18:00', location: 'Київ', links: [{ name: 'Умови', url: 'https://a.b/c' }] }).success);
  assert.ok(!schema.safeParse({ ...valid, title: '' }).success, 'порожній заголовок');
  assert.ok(!schema.safeParse({ ...valid, start: '2026-10-25' }).success, 'без часу');
  assert.ok(!schema.safeParse({ ...valid, start: '2026-10-25 08:00' }).success, 'не той формат');
  assert.ok(!schema.safeParse({ ...valid, start: '2026-02-30T08:00' }).success, 'неіснуюча дата');
  assert.ok(!schema.safeParse({ ...valid, start: '2026-10-25T24:00' }).success, 'неіснуючий час');
  assert.ok(!schema.safeParse({ ...valid, end: '2026-10-25T07:00' }).success, 'кінець раніше за початок');
  assert.ok(!schema.safeParse({ ...valid, links: [{ name: 'Умови' }] }).success, 'посилання без адреси');
  assert.ok(!schema.safeParse({ ...valid, legacyUrl: 'node/1' }).success, 'legacy URL — не адреса');
  assert.ok(!schema.safeParse({ ...valid, extra: 1 }).success, 'зайве поле');
});
