// Імпортер звітів на збережених сторінках старого сайту (tests/fixtures/old-site/) — без мережі.
// Перевіряє: поля звіту проходять схему колекції, значення нормалізовано до переліків, нерозпізнане
// потрапляє у звіт імпорту, legacy URL і файли правильні, PDF не завантажується, список — з /trip_search.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { z } from 'astro/zod';
import { REPORT_REGIONS, reportSchema } from '../../src/lib/schemas/report.ts';
import { readFrontmatter, runImport, summarizeUnrecognized } from '../../scripts/import/core.mjs';
import reports, {
  routeFromListText,
  normalizeAuthor,
  normalizeGrade,
  normalizeKind,
  normalizeMaterial,
  normalizeRegion,
  normalizeYear,
} from '../../scripts/import/types/reports.mjs';

const fixture = (name) => readFileSync(new URL(`../fixtures/old-site/${name}`, import.meta.url), 'utf8');
const URL_37933 = 'https://www.tkg.org.ua/node/37933';
const REPORT = fixture('report--37933.html');
const FAKE_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function fakeFetcher(pages) {
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

const withUrls = (urls) => ({ ...reports, sampleUrls: () => urls });
const schema = reportSchema({ image: () => z.string() });

function tempRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'import-reports-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

const readEntry = (root, slug) => {
  const file = join(root, reports.contentDir, `${slug}.md`);
  const text = readFileSync(file, 'utf8');
  return { file, data: readFrontmatter(text), body: text.replace(/^---[\s\S]*?\n---\n/, '') };
};

/** Фікстура звіту з іншими значеннями таксономій (як буває на старому сайті). */
const withTerms = (html, replacements) =>
  replacements.reduce((page, [from, to]) => page.replace(from, to), html);

test('звіт: метадані з таксономій, нитка маршруту, файл із розміром — і все проходить схему', async (t) => {
  const root = tempRoot(t);
  const fetcher = fakeFetcher({ [URL_37933]: REPORT });
  const { results, failed } = await runImport(withUrls([URL_37933]), { root, fetcher });
  assert.deepEqual(failed, []);
  assert.equal(results[0].slug, 'zvit-pro-pishokhidnyi-pokhid-2-k-s-ukrainskymy-karpatamy');
  assert.deepEqual(results[0].unrecognized, []);

  const { file, data, body } = readEntry(root, results[0].slug);
  const parsed = schema.safeParse(data);
  assert.ok(parsed.success, parsed.error?.message);
  assert.equal(data.title, 'Звіт про пішохідний похід 2 к.с. Українськими Карпатами');
  assert.equal(data.kind, 'пішохідний');
  assert.equal(data.grade, '2');
  assert.deepEqual(data.regions, ['Карпати']);
  assert.equal(data.year, 2025);
  assert.deepEqual(data.authors, ['Тетяна Моянська']);
  assert.match(data.route, /^Вдсп\. Шипот – хр\. Полонина Боржава – .* – Буковель \(с\.Паляниця\)$/);
  assert.deepEqual(data.countries, ['Україна']);
  assert.equal(data.season, 'літо');
  assert.equal(data.material, undefined, 'типу матеріалу на сторінці немає');
  assert.deepEqual(data.files, [{ name: '2car25tm.pdf', url: 'https://www.tkg.org.ua/files/2car25tm.pdf', size: 23951558 }]);
  assert.equal(data.legacyUrl, URL_37933);
  assert.match(data.description, /^Звіт про пішохідний похід 2 к\.с\. Українськими Карпатами \(pdf, 23 MB\)/);

  // Обкладинка — оригінал фото; PDF не завантажується (ADR 0004).
  assert.equal(data.cover, '../../assets/reports/zvit-pro-pishokhidnyi-pokhid-2-k-s-ukrainskymy-karpatamy/2car25tm_photo.jpg');
  assert.equal(data.coverAlt, 'Група біля вдсп. Шипот');
  assert.ok(existsSync(resolve(dirname(file), data.cover)), 'файл обкладинки є');
  assert.deepEqual(fetcher.asked, [URL_37933, 'https://www.tkg.org.ua/files/story_img/37933/2car25tm_photo.jpg']);

  // Тіло: опис із посиланням на PDF старого сайту; фото й підпис обкладинки не дублюються.
  assert.match(body, /\[пішохідний похід 2 к\.с\. Українськими Карпатами\]\(https:\/\/www\.tkg\.org\.ua\/files\/2car25tm\.pdf/);
  assert.match(body, /Керівник: Тетяна Моянська/);
  assert.doesNotMatch(body, /2car25tm_photo|Група біля вдсп/);
  assert.doesNotMatch(body, /<[a-z]/i);
});

test('нормалізація: ненормалізовані значення — у звіт імпорту, запис усе одно проходить схему', async (t) => {
  const root = tempRoot(t);
  const odd = withTerms(REPORT, [
    ['>Карпати</a>', '>Карпати</a></div><div class="field-item odd"><a href="/taxonomy/term/1">Марс</a>'],
    ['>2 к.с.</a>', '>7 к.с.</a>'],
    ['>Тетяна Моянська</a>', '>https://cutt.ly/abc</a>'],
    ['>Пішохідний туризм</a>', '>Підводний туризм</a>'],
  ]);
  const { results, failed } = await runImport(withUrls([URL_37933]), { root, fetcher: fakeFetcher({ [URL_37933]: odd }) });
  assert.deepEqual(failed, []);
  const { data } = readEntry(root, results[0].slug);
  assert.ok(schema.safeParse(data).success);
  assert.deepEqual(data.regions, ['Карпати'], 'невідомий район пропущено, відомий лишився');
  assert.equal(data.grade, undefined);
  assert.equal(data.authors, undefined);
  assert.equal(data.kind, 'інше', 'невідомий вид → «інше»');

  assert.deepEqual(summarizeUnrecognized(results), [
    { field: 'автор', value: 'https://cutt.ly/abc', slugs: [results[0].slug] },
    { field: 'вид', value: 'Підводний туризм', slugs: [results[0].slug] },
    { field: 'к.с.', value: '7 к.с.', slugs: [results[0].slug] },
    { field: 'район', value: 'Марс', slugs: [results[0].slug] },
  ]);
  assert.ok(results[0].warnings.includes('не розпізнано район «Марс» — пропущено'));
});

test('старий HTML-звіт: галерея-таблиця → фото в Markdown, таблиця даних без стилів, якорі змісту — текстом', async (t) => {
  const root = tempRoot(t);
  const extra =
    '<p><a href="#item_1">1. Довідкові дані</a></p>' +
    '<table align="center"><tbody><tr>' +
    '<td><div class="story-center-pic"><a href="/node/27895"><img src="/files/images/g_01.thumbnail.jpg" alt="Фото 1" /></a><div class="caption">Фото 1</div></div></td>' +
    '<td><img src="/files/images/g_02.thumbnail.jpg" alt="Фото 2" /></td><td> </td>' +
    '</tr></tbody></table>' +
    '<table border="1"><tbody><tr style="background-color:silver;" align="center"><td rowspan="2"><b>Вид</b></td><td colspan="2">Тривалість</td></tr>' +
    '<tr><td>9</td><td><img height="150" src="/files/images/member.jpg" alt="Учасник" /></td></tr></tbody></table>';
  const page = REPORT.replace('<p>Керівник: Тетяна Моянська</p>', `<p>Керівник: Тетяна Моянська</p>${extra}`);
  const fetcher = fakeFetcher({ [URL_37933]: page });
  const { results } = await runImport(withUrls([URL_37933]), { root, fetcher });
  const { body } = readEntry(root, results[0].slug);

  assert.match(body, /^1\\\. Довідкові дані$/m, 'якір змісту — просто текст');
  assert.doesNotMatch(body, /tkg\.org\.ua\/#/);
  // Галерея: фото завантажено й підставлено локальним шляхом, таблиці немає.
  assert.match(body, /\[!\[Фото 1\]\(\.\.\/\.\.\/assets\/reports\/[^)]+\/g_01\.thumbnail\.jpg\)\]\(https:\/\/www\.tkg\.org\.ua\/node\/27895\)/);
  assert.match(body, /!\[Фото 2\]\(\.\.\/\.\.\/assets\/reports\/[^)]+\/g_02\.thumbnail\.jpg\)/);
  assert.equal(body.match(/<table/g)?.length, 1, 'лишилась лише таблиця з даними');
  // Таблиця з даними: обʼєднані клітинки є, оформлення старого сайту — ні; фото в ній — зі старого сайту.
  assert.match(body, /<td rowspan="2"><b>Вид<\/b><\/td><td colspan="2">/);
  assert.doesNotMatch(body, /style=|align=|border=|height=|class=/);
  assert.match(body, /<img src="https:\/\/www\.tkg\.org\.ua\/files\/images\/member\.jpg" alt="Учасник">/);
  assert.ok(!fetcher.asked.includes('https://www.tkg.org.ua/files/images/member.jpg'), 'фото з сирого HTML не завантажується');
  assert.ok(fetcher.asked.includes('https://www.tkg.org.ua/files/images/g_01.thumbnail.jpg'));
});

test('нитка маршруту, поділена на кілька span.route (іноді посеред слова), склеюється повністю', async (t) => {
  const root = tempRoot(t);
  // Як на старому сайті (напр. node/35539): «… (чер</span><span class="route">ез …».
  const split = REPORT.replace(
    '<span class="route">Вдсп. Шипот – хр. Полонина Боржава – хр. Палений Грунь',
    '<span class="route">Вдсп. Шипот – хр. Полонина Бор</span><span class="route">жава – хр. Палений Грунь</span> <span class="route"> ',
  );
  assert.equal((split.match(/class="route"/g) ?? []).length, 3, 'у фікстурі три span.route');
  const { results } = await runImport(withUrls([URL_37933]), { root, fetcher: fakeFetcher({ [URL_37933]: split }) });
  const { data } = readEntry(root, results[0].slug);
  assert.match(data.route, /^Вдсп\. Шипот – хр\. Полонина Боржава – хр\. Палений Грунь – р\. Ріка – .* – Буковель \(с\.Паляниця\)$/);
});

test('кілька різних ниток на сторінці (заявлена / пройдена, походи табору) — береться перша, без злиття', async (t) => {
  const first = '<span class="route">Вдсп. Шипот – хр. Полонина Боржава – хр. Палений Грунь';
  // Як на старому сайті (node/27886, node/8369): друга нитка після підпису.
  const declared = REPORT.replace(
    first,
    '<span class="route">с. Ясіня – г. Петрос</span></p><p>2.3.1. Заявленная нитка похода:</p><p>' + first,
  );
  // Як у звіті табору (node/36853): походи через пробіл, без тире на стику.
  const camp = REPORT.replace(
    first,
    '<span class="route">Ясиня - г.Петрос - т/б “Глобус”</span> <span class="route">Кваси - г.Говерла - т/б “Глобус”</span> ' + first,
  );
  for (const [page, expected] of [
    [declared, 'с. Ясіня – г. Петрос'],
    [camp, 'Ясиня - г.Петрос - т/б “Глобус”'],
  ]) {
    const root = tempRoot(t);
    const { results } = await runImport(withUrls([URL_37933]), { root, fetcher: fakeFetcher({ [URL_37933]: page }) });
    assert.equal(readEntry(root, results[0].slug).data.route, expected);
  }
});

test('<br> усередині span.route — пробіл, слова не злипаються', async (t) => {
  const root = tempRoot(t);
  // Як на старому сайті (node/22200): «переезд на<br />Нижний Чулышман».
  const page = REPORT.replace(
    '<span class="route">Вдсп. Шипот – хр. Полонина Боржава – хр. Палений',
    '<span class="route">Вдсп. Шипот – хр. Полонина<br />Боржава –<br/>хр. Палений',
  );
  const body = page.slice(page.indexOf('<article'));
  assert.ok(body.includes('Полонина<br />Боржава'), 'розрив усередині span.route у тілі');
  const { results } = await runImport(withUrls([URL_37933]), { root, fetcher: fakeFetcher({ [URL_37933]: page }) });
  assert.match(readEntry(root, results[0].slug).data.route, /^Вдсп\. Шипот – хр\. Полонина Боржава – хр\. Палений Грунь – /);
});

test('нитка маршруту: якщо на сторінці немає span.route — з колонки «опис» таблиці /trip_search', async (t) => {
  const root = tempRoot(t);
  const noRoute = REPORT.replace(/<span class="route">([\s\S]*?)<\/span>/, '$1');
  assert.ok(!noRoute.includes('class="route"'));
  // Таблиця /trip_search (фікстура) заповнює запасні нитки для своїх адрес.
  const { urls } = reports.parseList(fixture('list-trip-search--page0.html'));
  assert.ok(urls.includes(URL_37933));
  const { results } = await runImport(withUrls([URL_37933]), { root, fetcher: fakeFetcher({ [URL_37933]: noRoute }) });
  const { data } = readEntry(root, results[0].slug);
  assert.match(data.route, /^Вдсп\. Шипот – хр\. Полонина Боржава – .* – Буковель \(с\.Паляниця\)$/);
});

test('нитки немає ні на сторінці, ні в списку /trip_search — попередження, а не тиша', () => {
  const noRoute = REPORT.replace(/<span class="route">([\s\S]*?)<\/span>/, '$1');
  // Адреса, якої немає в жодному списку: запасна нитка (стан модуля) для неї не знайдеться.
  const parsed = reports.parse(noRoute, 'https://www.tkg.org.ua/node/1');
  assert.equal(parsed.data.route, undefined);
  assert.ok(parsed.warnings.some((w) => w.startsWith('без нитки маршруту')), parsed.warnings.join('; '));
});

test('колонка «опис» /trip_search — нитка, лише якщо схожа на маршрут', () => {
  assert.equal(routeFromListText('ст. Баликсу - р. Теренсу - п. Геологов (н/к)'), 'ст. Баликсу - р. Теренсу - п. Геологов (н/к)');
  assert.equal(routeFromListText('Звіт про похід по Норвегії. Маршрут: Turtargø — Nedre Liagrø — Liaflui'), 'Turtargø — Nedre Liagrø — Liaflui');
  assert.equal(routeFromListText('Skj˚ak — Risheim — Lom\\ Керівник Сараєва Н.'), 'Skj˚ak — Risheim — Lom');
  assert.equal(routeFromListText('Сходження на пік Леніна'), null);
  assert.equal(routeFromListText('Київ – Львів'), null, 'один роздільник — ще не нитка');
  assert.equal(routeFromListText('Київ – Львів – Ворохта'), 'Київ – Львів – Ворохта');
  assert.equal(routeFromListText('Опубліковано звіт про похід по Західному Кокшал-Тоо за маршрутом:'), null);
});

test('переліки старого сайту: вид, к.с., район, рік, тип матеріалу, автор', () => {
  assert.equal(normalizeKind('Гірський туризм'), 'гірський');
  assert.equal(normalizeKind('Велосипедний туризм'), 'велотуризм');
  assert.equal(normalizeKind('Автостоп'), 'автостоп');
  assert.equal(normalizeKind('Автомобільний туризм'), 'автотуризм');
  assert.equal(normalizeKind('Водний туризм'), 'водний');
  assert.equal(normalizeKind('Лижний туризм'), 'лижний');
  assert.equal(normalizeKind('щось'), null);
  assert.equal(normalizeGrade('н/к'), 'н/к');
  assert.equal(normalizeGrade('5 к.с.'), '5');
  assert.equal(normalizeGrade('7 к.с.'), null);
  assert.equal(normalizeRegion('Кольський п-в'), 'Кольський п-в');
  assert.equal(normalizeRegion(' тянь-шань '), 'Тянь-Шань');
  assert.equal(normalizeRegion('Памір , Тянь-Шань'), null);
  assert.equal(REPORT_REGIONS.length, 27);
  assert.equal(normalizeYear('2019'), 2019);
  assert.equal(normalizeYear('2019-2020'), null);
  assert.equal(normalizeMaterial('Опис району/фоторепортаж'), 'опис району');
  assert.equal(normalizeMaterial('Технічний звіт'), 'технічний звіт');
  assert.equal(normalizeAuthor('Дар\'я Кошова'), 'Дар\'я Кошова');
  assert.equal(normalizeAuthor('cutt.ly/xyz'), null);
});

test('обсяг «усе»: адреси звітів із таблиці /trip_search і наступна сторінка', () => {
  const { urls, next } = reports.parseList(fixture('list-trip-search--page0.html'));
  assert.equal(urls.length, 50);
  assert.equal(urls[0], URL_37933);
  assert.ok(urls.every((u) => /^https:\/\/www\.tkg\.org\.ua\/node\/\d+$/.test(u)));
  assert.equal(next, 'https://www.tkg.org.ua/trip_search?page=1');
});

test('вибірка — 44 звіти з аудиту', () => {
  const urls = reports.sampleUrls();
  assert.equal(urls.length, 44);
  assert.equal(new Set(urls).size, 44);
  assert.ok(urls.includes(URL_37933));
});

test('інші сторінки — не звіти: зрозуміла помилка', () => {
  assert.throws(() => reports.parse(fixture('news--37936.html'), 'x'), /не звіт/);
  assert.throws(() => reports.parse(fixture('page-type-story--camp-18283.html'), 'x'), /не звіт/);
});

test('схема відкидає невалідний звіт', () => {
  const valid = { title: 'Т', kind: 'гірський', description: 'О', legacyUrl: 'https://www.tkg.org.ua/node/1' };
  assert.ok(schema.safeParse(valid).success, 'к.с., район, рік, автори — необовʼязкові');
  assert.ok(!schema.safeParse({ ...valid, kind: 'комбінований' }).success, 'вид поза переліком');
  assert.ok(!schema.safeParse({ ...valid, grade: '7' }).success, 'к.с. поза переліком');
  assert.ok(!schema.safeParse({ ...valid, regions: ['Марс'] }).success, 'район поза переліком');
  assert.ok(!schema.safeParse({ ...valid, regions: 'Карпати' }).success, 'райони — масив');
  assert.ok(!schema.safeParse({ ...valid, files: [{ name: 'a.pdf', url: 'a.pdf' }] }).success, 'адреса файлу — повна');
  assert.ok(!schema.safeParse({ ...valid, extra: 1 }).success, 'зайве поле');
});
