// Спільне для всіх парсерів старого сайту (Drupal 7, див. planning/research/old-site-audit.md):
// адреси, дати, фото, списки-тизери і перетворення HTML → Markdown.
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export const OLD_SITE = 'https://www.tkg.org.ua';

export const load = (html) => cheerio.load(html);

/** Абсолютна адреса на старому сайті (`/node/1` → `https://www.tkg.org.ua/node/1`). */
export function absoluteUrl(href, base = OLD_SITE) {
  try {
    return new URL(href.trim(), base).href;
  } catch {
    return href;
  }
}

const isOldSiteHost = (host) => host === 'tkg.org.ua' || host.endsWith('.tkg.org.ua');

/** Адреса оригіналу (legacy URL) з `link[rel=canonical]`, завжди `https://www.tkg.org.ua/…`. */
export function legacyUrl($, fallback) {
  const href = $('link[rel="canonical"]').attr('href') ?? fallback;
  if (!href) throw new Error('немає link[rel=canonical] — не знаю адреси оригіналу');
  const url = new URL(absoluteUrl(href));
  if (isOldSiteHost(url.hostname)) {
    url.protocol = 'https:';
    url.hostname = 'www.tkg.org.ua';
  }
  return url.href;
}

/** Номер вузла Drupal з адреси `/node/<nid>`, інакше null. */
export function nodeId(url) {
  return url.match(/\/node\/(\d+)/)?.[1] ?? null;
}

/** `08/10/2026 - 08:26` → `2026-10-08`. Неправильна дата — помилка, а не тихий пропуск. */
export function parseOldDate(text) {
  const m = text?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) throw new Error(`не розпізнав дату «${text}» (чекав ДД/ММ/РРРР)`);
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    throw new Error(`неіснуюча дата «${text}»`);
  }
  return iso;
}

/** Файл, викладений на старому сайті (`/files/…`): фото, яке треба забрати в репо. */
export function isOldSiteFile(url) {
  try {
    const { hostname, pathname } = new URL(url);
    return isOldSiteHost(hostname) && pathname.startsWith('/files/');
  } catch {
    return false;
  }
}

/**
 * Оригінал зображення замість зменшеної копії Drupal:
 * `/files/styles/150x150/public/news_img/1/a.jpg?itok=…` → `/files/news_img/1/a.jpg`.
 */
export function originalImageUrl(src) {
  const url = new URL(absoluteUrl(src));
  if (isOldSiteHost(url.hostname)) {
    url.protocol = 'https:';
    url.hostname = 'www.tkg.org.ua';
    url.pathname = url.pathname.replace(/^\/files\/styles\/[^/]+\/public\//, '/files/');
    url.search = '';
  }
  return url.href;
}

/** Текст підпису фото: на старому сайті трапляється подвійно закодоване `&nbsp;`. */
export function cleanText(text = '') {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/[\s ]+/g, ' ')
    .trim();
}

/** Видимий текст фрагмента: абзаци й переноси рядків стають пробілами. */
export function plainText($, el) {
  const clone = $(el).clone();
  clone.find('s, del, strike').remove(); // закреслене (стара дата) в опис не беремо
  clone.find('br').replaceWith(' ');
  clone.find('p, li, div, h1, h2, h3, h4, h5, h6, td, th, blockquote').append(' ');
  return cleanText(clone.text());
}

/** Короткий опис: перші ~200 знаків тексту, обрізані по слову. */
export function summarize(text, max = 200) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, '')}…`;
}

/**
 * Список-тизери Drupal (архів новин `/taxonomy/term/<id>`): адреси вузлів потрібного типу
 * і адреса наступної сторінки списку (або null).
 */
export function parseTeaserList(html, nodeType) {
  const $ = load(html);
  const urls = $(`article.node-${nodeType}.node-teaser`)
    .map((_, el) => $(el).find('.node__title a, h2 a').first().attr('href'))
    .get()
    .filter(Boolean)
    .map((href) => absoluteUrl(href));
  const nextHref = $('.pager .pager-next a').attr('href');
  return { urls, next: nextHref ? absoluteUrl(nextHref) : null };
}

/**
 * Готує тіло з HTML старого сайту до перетворення: абсолютні посилання (щоб відносні `/node/…` не стали
 * битими посиланнями нового сайту), без порожніх абзаців. Повертає перелік фото старого сайту в тілі.
 */
export function prepareBody($, body) {
  body.find('a[href]').each((_, a) => {
    $(a).attr('href', absoluteUrl($(a).attr('href')));
  });
  const images = [];
  body.find('img[src]').each((_, img) => {
    const src = originalImageUrl($(img).attr('src'));
    $(img).attr('src', src);
    if (isOldSiteFile(src) && !images.includes(src)) images.push(src);
  });
  body.find('p').each((_, p) => {
    if (!$(p).text().trim() && !$(p).find('img, iframe').length) $(p).remove();
  });
  return images;
}

const isBlank = (node) => node.type === 'text' && !node.data.replace(/[\s\u00a0]/g, '');

/** Переноси рядка `<br>` на початку чи в кінці абзацу нічого не переносять — прибираємо. */
export function trimBreaks($, body) {
  body.find('br').each((_, br) => {
    let prev = br.prev;
    while (prev && isBlank(prev)) prev = prev.prev;
    let next = br.next;
    while (next && isBlank(next)) next = next.next;
    if (!prev || !next) $(br).remove();
  });
}

/**
 * HTML → Markdown. `resolveImage(src)` повертає локальний шлях до завантаженого фото
 * (або саму адресу, якщо фото лишається зовнішнім).
 */
export function htmlToMarkdown(html, { resolveImage = (src) => src } = {}) {
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
    strongDelimiter: '**',
  });
  td.use(gfm);
  td.addRule('image', {
    filter: 'img',
    replacement: (_, node) => {
      const src = node.getAttribute('src');
      if (!src) return '';
      const alt = cleanText(node.getAttribute('alt') || node.getAttribute('title') || '').replace(/[[\]]/g, '');
      return `![${alt}](${resolveImage(src)})`;
    },
  });
  // Вбудоване відео (YouTube тощо) — посиланням: iframe у Markdown не переносимо.
  td.addRule('iframe', {
    filter: 'iframe',
    replacement: (_, node) => {
      const src = node.getAttribute('src');
      return src ? `\n\n[Відео](${absoluteUrl(src)})\n\n` : '';
    },
  });
  td.remove(['script', 'noscript', 'style']);
  return td
    .turndown(html)
    .replace(/[ \t\u00a0]+$/gm, (spaces) => (spaces === '  ' ? spaces : ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
