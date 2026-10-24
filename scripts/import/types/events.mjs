// Парсер «Подія» (вузол Drupal `event`, див. planning/research/old-site-audit.md): заголовок — h1,
// дата — `.field-name-field-event-date` («25/10/2026 - 08:00», «02/04/2025 - 19:00 до 21:00»,
// «28/10/2023 - 07:00 до 29/10/2023 - 19:00»), тіло — `.field-name-body`, обкладинка — перше фото в тілі
// (`event_img/<nid>/…`, як у новин). Окремого поля «місце» старий сайт не має: місце береться з рядка
// «Де: …» / «Місце проведення: …» у тексті. Посилання події — дочірні сторінки книги Drupal («Реєстрація
// команд», «Умови») і документи й форми Google у тексті (регламент, реєстрація).
// Інтерфейс типу контенту описано в scripts/import/types/index.mjs.
import { readFileSync } from 'node:fs';
import {
  OLD_SITE,
  absoluteUrl,
  cleanText,
  legacyUrl,
  load,
  parseTeaserList,
  plainText,
  prepareBody,
  stripPresentation,
  summarize,
  trimBreaks,
} from '../html.mjs';

const sampleFile = new URL('../samples/news-events.json', import.meta.url);

const DATE = /(\d{2})\/(\d{2})\/(\d{4})(?:\s*-\s*(\d{1,2}):(\d{2}))?/;
const TIME = /^(\d{1,2}):(\d{2})$/;

const pad = (n) => String(n).padStart(2, '0');

/** Дата старого сайту → `РРРР-ММ-ДД`; неіснуюча дата — помилка, а не тихий пропуск. */
function isoDay(dd, mm, yyyy, source) {
  const iso = `${yyyy}-${mm}-${dd}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    throw new Error(`неіснуюча дата «${source}»`);
  }
  return iso;
}

function isoTime(hh, mm, source) {
  if (Number(hh) > 23 || Number(mm) > 59) throw new Error(`неіснуючий час «${source}»`);
  return `${pad(hh)}:${mm}`;
}

/**
 * Поле дати події → { start, end } у форматі `РРРР-ММ-ДДTГГ:ХХ` (київський час, як показує старий сайт).
 * Без часу початку — 00:00 (на старому сайті такого не траплялось, але дата важливіша за годину).
 */
export function parseEventDate(text) {
  const source = cleanText(text).replace(/^Дата:\s*/, '');
  const [startPart, endPart] = source.split(/\s+до\s+/);
  const s = startPart?.match(DATE);
  if (!s) throw new Error(`не розпізнав дату події «${source}» (чекав ДД/ММ/РРРР - ГГ:ХХ)`);
  const startDay = isoDay(s[1], s[2], s[3], source);
  const start = `${startDay}T${s[4] ? isoTime(s[4], s[5], source) : '00:00'}`;
  if (!endPart) return { start };

  const e = endPart.match(DATE);
  const t = cleanText(endPart).match(TIME);
  let end;
  if (e) end = `${isoDay(e[1], e[2], e[3], source)}T${e[4] ? isoTime(e[4], e[5], source) : '23:59'}`;
  else if (t) end = `${startDay}T${isoTime(t[1], t[2], source)}`;
  else throw new Error(`не розпізнав кінець події «${endPart}»`);
  if (end < start) throw new Error(`кінець події раніше за початок: «${source}»`);
  return { start, end };
}

const LOCATION = /^(?:Де|Місце проведення|Місце)\s*:\s*(.+)$/im;

// Скорочення адрес: крапка після них — не кінець речення («м. Київ», «вул. Михайлівська»).
const ABBREVIATION = /(?:^|[\s,(])(?:м|вул|просп|пл|бул|пров|ст|смт|с|ім|корп|буд)$/u;

/**
 * Місце з рядка «Де: …» у тексті або undefined. Лише перше речення («онлайн. Посилання на зум:» → «Онлайн»),
 * без адрес-посилань, з великої літери (крім скорочення: «м. Київ»). «Місце повідомимо згодом» — не місце.
 */
export function findLocation(lines) {
  const raw = lines.match(LOCATION)?.[1];
  if (!raw) return undefined;
  let text = cleanText(raw.replace(/https?:\/\/\S+/g, ''));
  for (const m of text.matchAll(/\.\s+(?=\p{Lu})/gu)) {
    if (!ABBREVIATION.test(text.slice(0, m.index))) {
      text = text.slice(0, m.index);
      break;
    }
  }
  text = text.replace(/[\s.,:;–—-]+$/, '').trim();
  if (!text || /повідомимо|уточнюється|згодом/i.test(text)) return undefined;
  return /^\p{Ll}{1,5}\.\s/u.test(text) ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/** Текст тіла по рядках: `<br>` і абзаци стають переносами (для пошуку «Де: …»). */
function textLines($, body) {
  const clone = body.clone();
  clone.find('br').replaceWith('\n');
  clone.find('p, div, li').each((_, el) => {
    $(el).prepend('\n').append('\n');
  });
  return clone
    .text()
    .split('\n')
    .map((line) => cleanText(line))
    .filter(Boolean)
    .join('\n');
}

const isGoogleDoc = (url) => /^https?:\/\/(docs\.google\.com|forms\.gle)\//.test(url);
const isForm = (url) => /forms\.gle\/|docs\.google\.com\/forms\//.test(url);

const sentenceCase = (text) =>
  text === text.toUpperCase() ? text.charAt(0) + text.slice(1).toLowerCase() : text;

/**
 * Підпис посилання з тексту: сам текст, якщо він схожий на назву (з великої літери: «Реєстрація»,
 * «РЕГЛАМЕНТ» → «Регламент»), інакше — за видом («…за посиланням» → «Форма реєстрації» / «Google-документ»).
 */
function linkName(text, url) {
  const t = cleanText(text).replace(/[\s:.,]+$/, '');
  if (t && /^\p{Lu}/u.test(t) && !/^https?:/.test(t)) return sentenceCase(t);
  return isForm(url) ? 'Форма реєстрації' : 'Google-документ';
}

/**
 * Назва події без дати в кінці й з українськими лапками (рішення Михайла, тікет 10): дата й так стоїть
 * на картці й сторінці події. «Лекція "Орієнтування" - 19.10.2023» → «Лекція «Орієнтування»»;
 * «Клубний вечір - 18.04.2024» → «Клубний вечір». Дата лише в кінці; рік у назві («Сніговий Барс 2025») лишається.
 */
export function cleanEventTitle(title) {
  const t = cleanText(title)
    .replace(/\s*[-–—]?\s*\d{1,2}\.\d{1,2}\.\d{4}\s*$/, '')
    .replace(/"([^"]*)"/g, '«$1»');
  return t || cleanText(title);
}

/** «Осінній лист 2026. Реєстрація команд» → «Реєстрація команд» (назва події в підписі зайва). */
function bookPageName(title) {
  const t = cleanText(title);
  const tail = t.split(/\.\s+/).pop();
  return tail && tail !== t ? tail.charAt(0).toUpperCase() + tail.slice(1) : t;
}

export default {
  name: 'events',
  label: 'події',
  contentDir: 'src/content/events',
  assetsDir: 'src/assets/events',

  /** Вибірка для прототипу: події 2023–2026 з аудиту (planning/research/data/news-events-sample.json). */
  sampleUrls() {
    return JSON.parse(readFileSync(sampleFile, 'utf8'))
      .filter((item) => item.type.includes('node-event'))
      .map((item) => item.url);
  },

  /** «Усе»: архів за роками (ті самі сторінки, що й для новин), лише вузли-події. */
  listSources: [`${OLD_SITE}/taxonomy/term/2191`, `${OLD_SITE}/taxonomy/term/2180`],

  parseList: (html) => parseTeaserList(html, 'event'),

  /**
   * HTML сторінки події → поля запису. Фото тут ще віддалені (адреси оригіналів на старому сайті);
   * завантажує їх і підставляє локальні шляхи ядро імпортера.
   */
  parse(html, pageUrl) {
    const $ = load(html);
    if (!$('body').hasClass('node-type-event')) {
      throw new Error('це не подія (немає класу node-type-event на body)');
    }
    const legacy = legacyUrl($, pageUrl);
    const title = cleanEventTitle($('h1#page-title, h1.page__title').first().text());
    const article = $('article.node').first();
    const body = article.find('.field-name-body .field-item').first();

    // Порожня чернетка (заголовок «.» без тексту, як /node/37122) — не подія, пропускаємо.
    if (!/\p{L}/u.test(title) && !plainText($, body)) return { skip: 'порожня чернетка (без заголовка й тексту)' };
    if (!title) throw new Error('немає заголовка h1');

    const dateField = article.find('.field-name-field-event-date .field-item').first();
    if (!dateField.length) throw new Error('немає дати події (.field-name-field-event-date)');
    const { start, end } = parseEventDate(dateField.text());

    // Фото з тимчасової теки Drupal (`/system/temporary/…`) на старому сайті вже не відкриваються (404) —
    // прибираємо разом із посиланням на себе, щоб у тексті не було битої картинки.
    body.find('img[src*="/system/temporary/"]').each((_, img) => {
      const link = $(img).parent('a');
      if (link.length && !cleanText(link.text())) link.remove();
      else $(img).remove();
    });

    const images = prepareBody($, body);

    // Обкладинка — перше фото старого сайту в тілі; з тексту його прибираємо, щоб не було двічі.
    let cover = null;
    const firstImg = body.find('img').filter((_, img) => images.includes($(img).attr('src'))).first();
    if (firstImg.length) {
      const link = firstImg.parent('a');
      cover = {
        src: firstImg.attr('src'),
        alt: cleanText(firstImg.attr('alt') || firstImg.attr('title') || link.attr('title') || ''),
      };
      if (link.length && !cleanText(link.text())) link.remove();
      else firstImg.remove();
    }

    // Посилання події: дочірні сторінки книги (реєстрація, умови), далі документи й форми Google з тексту.
    const links = [];
    const addLink = (name, url) => {
      if (!links.some((l) => l.url === url)) links.push({ name, url });
    };
    article.find('.book-navigation > ul.menu > li > a[href]').each((_, a) => {
      addLink(bookPageName($(a).text()), absoluteUrl($(a).attr('href')));
    });
    body.find('a[href]').each((_, a) => {
      const url = $(a).attr('href').trim();
      if (isGoogleDoc(url)) addLink(linkName($(a).text(), url), url);
    });

    stripPresentation($, body);
    trimBreaks($, body);

    const location = findLocation(textLines($, body));
    const description = summarize(plainText($, body));
    if (!description) throw new Error('порожнє тіло події');

    return {
      legacyUrl: legacy,
      title,
      data: { title, start, end, location, description, links: links.length ? links : undefined },
      cover,
      bodyHtml: body.html() ?? '',
    };
  },
};
