// Імпортер статичних сторінок («Про клуб», «МКК», «Табір») на збережених сторінках старого сайту
// (tests/fixtures/old-site/) — без мережі. Перевіряє те, що лягає у файли: поля проходять схему,
// імʼя файлу — адреса на новому сайті, legacy URL і тіло правильні, повторний запуск нічого не змінює.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pageSchema } from '../../src/lib/schemas/page.ts';
import { readFrontmatter, runImport } from '../../scripts/import/core.mjs';
import pages from '../../scripts/import/types/pages.mjs';

const fixture = (name) => readFileSync(new URL(`../fixtures/old-site/${name}`, import.meta.url), 'utf8');
const PAGES = {
  'https://www.tkg.org.ua/about': fixture('page-type-page--about.html'),
  'https://www.tkg.org.ua/mkk': fixture('page-type-book--mkk.html'),
  'https://www.tkg.org.ua/node/18283': fixture('page-type-story--camp-18283.html'),
};
const FAKE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

/** Підміна завантажувача: сторінки — з фікстур, фото — кілька байтів. Будь-яка інша сторінка — помилка. */
function fakeFetcher() {
  const asked = [];
  return {
    asked,
    text: async (url) => {
      asked.push(url);
      if (!(url in PAGES)) throw new Error(`немає фікстури для ${url}`);
      return PAGES[url];
    },
    binary: async (url) => {
      asked.push(url);
      return FAKE_PNG;
    },
  };
}

function tempRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'import-pages-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

const readEntry = (root, slug) => {
  const file = join(root, pages.contentDir, `${slug}.md`);
  const text = readFileSync(file, 'utf8');
  return { file, data: readFrontmatter(text), body: text.replace(/^---[\s\S]*?\n---\n/, '') };
};

test('сторінки: файли about, mkk, camp з полями схеми і legacy URL; без попереджень про обкладинку', async (t) => {
  const root = tempRoot(t);
  const { results, failed } = await runImport(pages, { root, fetcher: fakeFetcher() });
  assert.deepEqual(failed, []);
  assert.deepEqual(readdirSync(join(root, pages.contentDir)).sort(), ['about.md', 'camp.md', 'mkk.md']);
  assert.deepEqual(results.flatMap((r) => r.warnings), []);

  const expected = {
    about: { title: 'Про турклуб', legacyUrl: 'https://www.tkg.org.ua/about', description: /^Турклуб КПІ "Глобус" існує \(з перервами\) з 1952 року\./ },
    mkk: { title: 'Маршрутно-кваліфікаційна комісія Глобус', legacyUrl: 'https://www.tkg.org.ua/mkk', description: /^Маршрутно-кваліфікаційна комісія турклубу "Глобус" при Центрі фізичного виховання/ },
    camp: { title: 'Табір "Глобус" у Карпатах', legacyUrl: 'https://www.tkg.org.ua/node/18283', description: /^Студентський спортивно-оздоровчий табір "Глобус".*Говерли/ },
  };
  for (const [slug, { title, legacyUrl, description }] of Object.entries(expected)) {
    const { data } = readEntry(root, slug);
    const parsed = pageSchema.safeParse(data);
    assert.ok(parsed.success, `${slug}: ${parsed.error?.message}`);
    assert.equal(data.title, title);
    assert.equal(data.legacyUrl, legacyUrl);
    assert.match(data.description, description);
    assert.ok(data.description.length <= 201, `${slug}: опис для превʼю короткий`);
  }
});

test('«Про клуб»: історія, напрями й розташування з картою-оригіналом; пошта — посиланням; табір — на /camp', async (t) => {
  const root = tempRoot(t);
  const fetcher = fakeFetcher();
  await runImport(pages, { root, fetcher });
  const { file, body } = readEntry(root, 'about');

  assert.match(body, /існує \(з перервами\) з 1952 року/);
  assert.match(body, /^## Напрями діяльності$/m);
  assert.match(body, /^## Розташування клубу$/m);
  assert.match(body, /Верхньоключова, 1\/26/);
  assert.match(body, /ст\. метро "Шулявська"/);

  // Мініатюру карти замінено оригіналом, його завантажено поруч із контентом.
  assert.ok(fetcher.asked.includes('https://www.tkg.org.ua/files/images/about_kpi_region_map.png'));
  assert.ok(!fetcher.asked.some((u) => u.includes('.thumbnail.')), 'мініатюра не завантажується');
  const map = body.match(/!\[Розташування турклубу[^\]]*\]\(([^)]+)\)/)?.[1];
  assert.equal(map, '../../assets/pages/about/about_kpi_region_map.png');
  assert.ok(existsSync(resolve(dirname(file), map)), 'файл карти є');

  // Пошта, схована від спаму (`info [at] tkg.org.ua`), — справжнє посилання; форум — на старому сайті.
  assert.match(body, /\[info@tkg\.org\.ua\]\(mailto:info@tkg\.org\.ua/);
  assert.doesNotMatch(body, /\[at\]/);
  assert.match(body, /\]\(https:\/\/www\.tkg\.org\.ua\/forum/);
  // Табір перенесено — посилання веде на новий сайт; дочірні сторінки розділу — на старий.
  assert.match(body, /\[карпатського табору "Глобус"\]\(\/camp\)/);
  assert.match(body, /^## Сторінки розділу на старому сайті$/m);
  assert.match(body, /-\s+\[Про нас у пресі\]\(https:\/\/www\.tkg\.org\.ua\/node\/4697\)/);
  // Без HTML і оформлення старого сайту, без порожніх якорів.
  assert.doesNotMatch(body, /<(?:div|span|a|strong)\b|align=|name="location"/);
});

test('«МКК»: розділи й FAQ заголовками, документи — посиланнями на старий сайт, пошта МКК, без змісту на якорі', async (t) => {
  const root = tempRoot(t);
  await runImport(pages, { root, fetcher: fakeFetcher() });
  const { body } = readEntry(root, 'mkk');

  for (const h2 of ['Про МКК', 'FAQ', 'Для випуску в похід', 'Для захисту походу', 'Для оформлення розряду', 'Страхування', 'Корисні матеріали']) {
    assert.match(body, new RegExp(`^## ${h2}$`, 'm'), h2);
  }
  // Питання FAQ (жирний абзац зі знаком питання) — підзаголовки h3, без тире на початку.
  assert.match(body, /^### Навіщо МКК\? І що дає випуск групи в МКК\?$/m);
  assert.match(body, /^### Як захистити похід\? Що для цього потрібно\?$/m);
  assert.equal(body.match(/^### /gm).length, 8);

  // Документи — на старому сайті.
  assert.match(body, /\[Маршрутна книжка та зразок її заповнення\.\]\(https:\/\/www\.tkg\.org\.ua\/node\/3473\)/);
  assert.match(body, /\[Шаблон типового звіту про спортивний похід\]\(https:\/\/www\.tkg\.org\.ua\/node\/5019\)/);
  assert.match(body, /\[Бланк довідки про спортивний похід та зразок її заповнення\]\(https:\/\/www\.tkg\.org\.ua\/node\/5020\)/);
  assert.match(body, /-\s+\[Склад МКК Глобус\]\(https:\/\/www\.tkg\.org\.ua\/node\/4764\)/);
  // Пошта МКК — посиланням.
  assert.match(body, /\(mailto:mkk_tkg@googlegroups\.com\)/);
  // Зміст на якорі (`#faq`) прибрано, а посилання на форум МКК лишилося.
  assert.doesNotMatch(body, /\]\(#|\(https:\/\/www\.tkg\.org\.ua\/#/);
  assert.doesNotMatch(body, /^-\s+Про МКК$/m);
  assert.match(body, /-\s+\[Форум МКК\]\(https:\/\/www\.tkg\.org\.ua\/forum\/363\)/);
});

test('«Табір»: текст про табір і посилання на школу інструкторів', async (t) => {
  const root = tempRoot(t);
  await runImport(pages, { root, fetcher: fakeFetcher() });
  const { body } = readEntry(root, 'camp');
  assert.match(body, /неподалік найвищої вершини Українських Карпат – Говерли/);
  assert.match(body, /\[сторінці табору\]\(https:\/\/globuscamp\.org\.ua\/\)/);
  assert.match(body, /-\s+\[Табір "Глобус" - Школа інструкторів\]\(https:\/\/www\.tkg\.org\.ua\/node\/32583\)/);
});

test('сторінки: повторний запуск нічого не змінює; не сторінка — помилка', async (t) => {
  const root = tempRoot(t);
  await runImport(pages, { root, fetcher: fakeFetcher() });
  const again = await runImport(pages, { root, fetcher: fakeFetcher() });
  assert.deepEqual(again.results.map((r) => r.status), ['unchanged', 'unchanged', 'unchanged']);

  assert.throws(() => pages.parse(fixture('news--37936.html'), 'https://www.tkg.org.ua/node/37936'), /не статична сторінка/);
});

test('сторінки: обсяг «усе» — та сама вибірка (списків на старому сайті немає)', async (t) => {
  const root = tempRoot(t);
  const { results, failed } = await runImport(pages, { root, fetcher: fakeFetcher(), scope: 'all' });
  assert.deepEqual(failed, []);
  assert.deepEqual(results.map((r) => r.slug), ['about', 'mkk', 'camp']);
});
