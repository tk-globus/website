// Парсер «Звіт про похід» (вузол Drupal `story` з таксономіями). Список звітів — таблиця пошуку бібліотеки
// `/trip_search` (тип `story` буває й не звітом, напр. табір), деталі — зі сторінки звіту:
// поля `.field-name-taxonomy-vocabulary-*` (див. planning/research/old-site-audit.md), нитка маршруту —
// усі `span.route` у тілі (старий сайт ділить її на кілька span, іноді посеред слова), а якщо їх немає —
// колонка «опис» таблиці `/trip_search` (у вибірці вона збережена як `route`); файли —
// `.field-name-field-attachment` (розмір — з `type="…; length=<байти>"`).
//
// Значення старого сайту нормалізуються до переліків схеми (src/lib/schemas/report.ts). Що не вдалося
// розпізнати, не губиться мовчки: воно йде в `unrecognized` і у звіт імпорту.
// Інтерфейс типу контенту описано в scripts/import/types/index.mjs.
import { readFileSync } from 'node:fs';
import {
  REPORT_GRADES,
  REPORT_KINDS,
  REPORT_MATERIALS,
  REPORT_REGIONS,
  REPORT_SEASONS,
} from '../../../src/lib/schemas/report.ts';
import {
  OLD_SITE,
  absoluteUrl,
  cleanText,
  flattenLayoutTables,
  legacyUrl,
  load,
  plainText,
  prepareBody,
  stripPresentation,
  summarize,
  trimBreaks,
  unwrapAnchorLinks,
} from '../html.mjs';

const sampleFile = new URL('../samples/reports.json', import.meta.url);

// Номери словників таксономії старого сайту.
const VOCABULARY = { authors: 1, material: 5, kind: 7, regions: 14, year: 15, grade: 16, season: 17, countries: 18 };

const lower = (s) => cleanText(s).toLocaleLowerCase('uk');

/** «Пішохідний туризм» → «пішохідний». Порядок важливий: «автостоп» раніше за «авто…». */
const KIND_PATTERNS = [
  [/^гірськ/, 'гірський'],
  [/^пішохідн/, 'пішохідний'],
  [/^альпінізм/, 'альпінізм'],
  [/^вело/, 'велотуризм'],
  [/^автостоп/, 'автостоп'],
  [/^авто/, 'автотуризм'],
  [/^водн/, 'водний'],
  [/^лижн/, 'лижний'],
  [/^спелео/, 'спелеотуризм'],
  [/^перегон/, 'перегони'],
  [/^інше/, 'інше'],
];

export function normalizeKind(value) {
  const v = lower(value);
  const found = KIND_PATTERNS.find(([re]) => re.test(v))?.[1];
  return found && REPORT_KINDS.includes(found) ? found : null;
}

/** «2 к.с.» → «2», «н/к» → «н/к». */
export function normalizeGrade(value) {
  const v = lower(value).replace(/\s+/g, '');
  if (/^н\/?к\.?$/.test(v)) return 'н/к';
  const digit = v.match(/^([1-6])(к\.?с\.?)?$/)?.[1];
  return digit && REPORT_GRADES.includes(digit) ? digit : null;
}

export function normalizeRegion(value) {
  const v = lower(value);
  return REPORT_REGIONS.find((r) => r.toLocaleLowerCase('uk') === v) ?? null;
}

export function normalizeSeason(value) {
  const v = lower(value);
  return REPORT_SEASONS.includes(v) ? v : null;
}

/** «Технічний звіт», «Нарис», «Опис району/фоторепортаж» → значення переліку. */
export function normalizeMaterial(value) {
  const v = lower(value);
  if (v.startsWith('опис району')) return 'опис району';
  return REPORT_MATERIALS.includes(v) ? v : null;
}

export function normalizeYear(value) {
  const v = cleanText(value);
  return /^(19|20)\d{2}$/.test(v) ? Number(v) : null;
}

/** Автор — імʼя людини; посилання (трапляється cutt.ly замість імені) — сміття. */
export function normalizeAuthor(value) {
  const v = cleanText(value);
  if (!v || /https?:|www\.|\.(ly|com|ua|org)\b|\//i.test(v)) return null;
  return v;
}

/**
 * Нитка маршруту з колонки «опис» таблиці `/trip_search`: адреса звіту → текст. Запасне джерело для звітів,
 * де на сторінці немає `span.route`. Заповнюють sampleUrls (з вибірки) і parseTripSearch (з таблиці).
 */
const listRoutes = new Map();

/**
 * Текст колонки «опис» — нитка маршруту, лише якщо схожий на неї: щонайменше три пункти через « – ».
 * Вступ («Звіт про … Маршрут:») і хвіст «Керівник …» відрізаємо.
 * Не схожий на нитку текст (напр. «Сходження на пік Леніна») — null.
 */
export function routeFromListText(text) {
  const route = cleanText(text)
    .replace(/^[\s\S]*маршрут(?:ом)?\s*:\s*/i, '')
    .replace(/[\s\\.]*Керівник[\s\S]*$/, '');
  return (route.match(/\s[–—-]\s/g) ?? []).length >= 2 ? route : null;
}

/** Нитка маршруту з тіла сторінки: текст усіх `span.route` підряд (без роздільника), пробіли нормалізовано. */
export function routeFromBody($, body) {
  return cleanText(body.find('.route').map((_, el) => $(el).text()).get().join('')) || undefined;
}

/** Таблиця пошуку бібліотеки `/trip_search`: адреси звітів і наступна сторінка (або null). */
export function parseTripSearch(html) {
  const $ = load(html);
  const urls = [];
  for (const row of $('table.views-table tbody tr').get()) {
    const href = $(row).find('td.views-field-title a').attr('href');
    if (!href) continue;
    const url = absoluteUrl(href);
    urls.push(url);
    const route = routeFromListText($(row).find('td.views-field-body').text());
    if (route) listRoutes.set(url, route);
  }
  const nextHref = $('.pager .pager-next a').attr('href');
  return { urls, next: nextHref ? absoluteUrl(nextHref) : null };
}

export default {
  name: 'reports',
  label: 'звіти',
  contentDir: 'src/content/reports',
  assetsDir: 'src/assets/reports',

  /** Вибірка для прототипу: 44 звіти з аудиту (planning/research/data/reports-sample.json). */
  sampleUrls() {
    return JSON.parse(readFileSync(sampleFile, 'utf8')).map((item) => {
      const url = absoluteUrl(item.url);
      const route = routeFromListText(item.route ?? '');
      if (route) listRoutes.set(url, route);
      return url;
    });
  },

  /** «Усе»: пошук бібліотеки старого сайту, 14 сторінок по 50 звітів. */
  listSources: [`${OLD_SITE}/trip_search`],

  parseList: parseTripSearch,

  /**
   * HTML сторінки звіту → поля запису. Фото тут ще віддалені; завантажує їх ядро імпортера.
   * `unrecognized` — значення, яких немає в переліках схеми (поле пропущено, щоб запис пройшов схему).
   */
  parse(html, pageUrl) {
    const $ = load(html);
    const article = $('article.node-story').first();
    if (!$('body').hasClass('node-type-story') || !article.length) {
      throw new Error('це не звіт (немає класу node-type-story на body)');
    }
    if (!article.find('[class*="field-name-taxonomy-vocabulary-"]').length) {
      throw new Error('це не звіт (сторінка story без полів бібліотеки: вид, район, к.с.…)');
    }
    const title = cleanText($('h1#page-title, h1.page__title').first().text());
    if (!title) throw new Error('немає заголовка h1');

    const terms = (field) =>
      article
        .find(`.field-name-taxonomy-vocabulary-${VOCABULARY[field]} .field-item`)
        .map((_, el) => cleanText($(el).text()))
        .get()
        .filter(Boolean);

    const unrecognized = [];
    const warnings = [];
    /** Значення старого сайту → значення переліку; нерозпізнане — у звіт імпорту. */
    const normalizeAll = (field, label, normalize) => {
      const out = [];
      for (const raw of terms(field)) {
        const value = normalize(raw);
        if (value === null) unrecognized.push({ field: label, value: raw });
        else if (!out.includes(value)) out.push(value);
      }
      return out;
    };
    const one = (field, label, normalize) => {
      const values = normalizeAll(field, label, normalize);
      if (values.length > 1) warnings.push(`${label}: кілька значень (${values.join(', ')}) — беру перше`);
      return values[0];
    };

    let kind = one('kind', 'вид', normalizeKind);
    if (!kind) {
      if (!terms('kind').length) unrecognized.push({ field: 'вид', value: '(не вказано)' });
      kind = 'інше';
    }
    const grade = one('grade', 'к.с.', normalizeGrade);
    const regions = normalizeAll('regions', 'район', normalizeRegion);
    const year = one('year', 'рік', normalizeYear);
    const authors = normalizeAll('authors', 'автор', normalizeAuthor);
    const countries = normalizeAll('countries', 'країна', cleanText);
    const season = one('season', 'сезон', normalizeSeason);
    const material = one('material', 'тип матеріалу', normalizeMaterial);

    const files = article
      .find('.field-name-field-attachment .field-item a[href]')
      .map((_, a) => {
        const size = Number($(a).attr('type')?.match(/length=(\d+)/)?.[1]);
        return {
          name: cleanText($(a).text()) || decodeURIComponent(new URL(absoluteUrl($(a).attr('href'))).pathname.split('/').pop()),
          url: absoluteUrl($(a).attr('href')),
          size: size > 0 ? size : undefined,
        };
      })
      .get();
    if (!files.length) warnings.push('без файлів (немає вкладень на сторінці)');

    const body = article.find('.field-name-body .field-item').first();
    const route = routeFromBody($, body) ?? listRoutes.get(pageUrl);
    unwrapAnchorLinks($, body);
    flattenLayoutTables($, body);
    const images = prepareBody($, body);

    // Обкладинка — перше фото старого сайту в тілі; з тексту прибираємо разом із підписом
    // і посиланням на повнорозмірну копію, щоб фото не було двічі.
    let cover = null;
    const firstImg = body.find('img').filter((_, img) => images.includes($(img).attr('src'))).first();
    if (firstImg.length) {
      const caption = cleanText(firstImg.parent().find('.caption').first().text());
      cover = {
        src: firstImg.attr('src'),
        alt: cleanText(firstImg.attr('alt') || firstImg.attr('title') || caption),
      };
      const link = firstImg.closest('a');
      const linkToImage = /\.(jpe?g|png|gif|webp)(\?|$)/i.test(link.attr('href') ?? '');
      if (link.length && (linkToImage || !cleanText(link.text()))) link.remove();
      else (firstImg.parent('span').length ? firstImg.parent('span') : firstImg).remove();
    }

    trimBreaks($, body);
    stripPresentation($, body);

    const description = summarize(plainText($, body)) || route || title;

    return {
      legacyUrl: legacyUrl($, pageUrl),
      title,
      data: {
        title,
        kind,
        grade,
        regions: regions.length ? regions : undefined,
        year,
        authors: authors.length ? authors : undefined,
        route,
        countries: countries.length ? countries : undefined,
        season,
        material,
        files: files.length ? files : undefined,
        description,
      },
      cover,
      bodyHtml: body.html() ?? '',
      unrecognized,
      warnings,
    };
  },
};
