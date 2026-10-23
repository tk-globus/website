// Парсер «Новина» (вузол Drupal `news`): заголовок — h1, дата — `.submitted`, тіло — `.field-name-body`,
// обкладинка — перше фото в тілі (на старому сайті це мініатюра ліворуч чи праворуч від тексту).
// Інтерфейс типу контенту описано в scripts/import/types/index.mjs.
import { readFileSync } from 'node:fs';
import {
  OLD_SITE,
  cleanText,
  legacyUrl,
  load,
  parseOldDate,
  parseTeaserList,
  plainText,
  prepareBody,
  summarize,
  trimBreaks,
} from '../html.mjs';

const sampleFile = new URL('../samples/news-events.json', import.meta.url);

export default {
  name: 'news',
  label: 'новини',
  contentDir: 'src/content/news',
  assetsDir: 'src/assets/news',

  /** Вибірка для прототипу: новини 2023–2026 з аудиту (planning/research/data/news-events-sample.json). */
  sampleUrls() {
    return JSON.parse(readFileSync(sampleFile, 'utf8'))
      .filter((item) => item.type.includes('node-news'))
      .map((item) => item.url);
  },

  /** «Усе»: архів новин за роками — 2026 (термін 2191) і 2021–2025 (термін 2180), з усіма сторінками. */
  listSources: [`${OLD_SITE}/taxonomy/term/2191`, `${OLD_SITE}/taxonomy/term/2180`],

  parseList: (html) => parseTeaserList(html, 'news'),

  /**
   * HTML сторінки новини → поля запису. Фото тут ще віддалені (адреси оригіналів на старому сайті);
   * завантажує їх і підставляє локальні шляхи ядро імпортера.
   */
  parse(html, pageUrl) {
    const $ = load(html);
    if (!$('body').hasClass('node-type-news')) {
      throw new Error('це не новина (немає класу node-type-news на body)');
    }
    const title = cleanText($('h1#page-title, h1.page__title').first().text());
    if (!title) throw new Error('немає заголовка h1');
    const date = parseOldDate($('article.node .submitted').first().text());

    const body = $('article.node .field-name-body .field-item').first();
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
      // Фото в посиланні на саме себе (повнорозмірна копія) — прибираємо разом із посиланням.
      if (link.length && !cleanText(link.text())) link.remove();
      else firstImg.remove();
    }

    trimBreaks($, body);

    const description = summarize(plainText($, body));
    if (!description) throw new Error('порожнє тіло новини');

    return {
      legacyUrl: legacyUrl($, pageUrl),
      title,
      data: { title, date, description },
      cover,
      bodyHtml: body.html() ?? '',
    };
  },
};
