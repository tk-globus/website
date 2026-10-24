// Парсер «Сторінка»: статичні розділи старого сайту (вузли Drupal `page`, `book`, `story`) →
// /about, /mkk, /camp. Заголовок — h1, тіло — `.field-name-body`, legacy URL — `link[rel=canonical]`.
// Інтерфейс типу контенту описано в scripts/import/types/index.mjs.
//
// Що робить з тілом, крім спільного (абсолютні посилання, фото-оригінали):
// - зміст на якорі сторінки (`#faq`) прибирає — якорів у Markdown немає;
// - підзаголовки старого сайту (рядок ВЕЛИКИМИ жирним) → h2, питання FAQ (жирний абзац із «?») → h3;
// - адреси пошти, сховані від спаму (`info [at] tkg.org.ua`), стають посиланнями mailto;
// - мініатюру карти (`….thumbnail.png`) замінює оригіналом;
// - дочірні сторінки розділу (навігація «книги» Drupal) додає списком посилань на старий сайт —
//   у MVP переносимо лише головну сторінку розділу (аудит, розділ «Статичні сторінки»);
// - посилання на інші перенесені сторінки (табір зі сторінки «Про клуб») веде на новий сайт;
// - застарілі посилання (графік МКК 2015/2016) замінює актуальними — див. UPDATED_LINKS;
// - перелік у рядок («Потрапити туди можна: - від …; - від …») розбиває на список;
// - підпис під фото, що повторює заголовок розділу («Розташування клубу» під картою), прибирає.
import {
  OLD_SITE,
  absoluteUrl,
  cleanText,
  legacyUrl,
  load,
  plainText,
  prepareBody,
  stripPresentation,
  summarize,
  trimBreaks,
} from '../html.mjs';

/** Сторінки прототипу: адреса на старому сайті → імʼя файлу (і адреса на новому сайті: about → /about). */
export const PAGES = [
  { slug: 'about', url: `${OLD_SITE}/about` },
  { slug: 'mkk', url: `${OLD_SITE}/mkk` },
  { slug: 'camp', url: `${OLD_SITE}/node/18283` },
];

const PAGE_TYPES = ['node-type-page', 'node-type-book', 'node-type-story'];

/**
 * Застарілі посилання старого сайту → актуальні. Правити руками файл сторінки марно: наступний імпорт
 * перезапише правку, тому заміна — тут.
 * - FAQ МКК: «записуйтесь на засідання у темі про Графік роботи МКК» вело на графік 2015/2016 (/node/32954);
 *   актуальний графік — /node/4765 (той самий, що `mkk.schedule` у src/data/settings.json).
 */
export const UPDATED_LINKS = new Map([[`${OLD_SITE}/node/32954`, `${OLD_SITE}/node/4765`]]);

const slugByUrl = new Map(PAGES.map(({ slug, url }) => [url, slug]));

/** Адреса старого сайту без якоря (`/about#location` → `/about`) — для пошуку серед перенесених сторінок. */
const withoutHash = (href) => href.split('#')[0];

const isWholeBold = ($, el) => {
  const text = cleanText($(el).text());
  if (!text || $(el).find('a[href], img').length) return false;
  const bold = cleanText($(el).find('strong, b').text());
  return bold === text;
};

const sentenceCase = (text) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

/** Адреси пошти, сховані від спаму: `info [at] tkg.org.ua` → `info@tkg.org.ua` (і в тексті, і в mailto). */
const deobfuscate = (text) => text.replace(/([\w.+-])\s*\[at\]\s*([\w-])/g, '$1@$2');

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

/** Адреса пошти в тексті (не в посиланні) → посилання mailto: так її можна натиснути. */
function linkEmails($, body) {
  const walk = (node) => {
    for (const child of [...(node.children ?? [])]) {
      if (child.type === 'text') {
        if (!EMAIL.test(child.data)) continue;
        EMAIL.lastIndex = 0;
        const html = $('<i>').text(child.data).html().replace(EMAIL, (m) => `<a href="mailto:${m}">${m}</a>`);
        $(child).replaceWith(html);
      } else if (child.type === 'tag' && child.name !== 'a') walk(child);
    }
  };
  walk(body.get(0));
}

/**
 * Перелік, записаний одним абзацом («Потрапити туди можна: - від метро …; - від трамваю …»), → вступ і список.
 * Абзац розбивається, лише якщо після двокрапки йдуть щонайменше два пункти « - », розділені «;».
 */
export function splitInlineLists($, body) {
  body.find('p').each((_, p) => {
    const parts = ($(p).html() ?? '').split(/(?<=[:;])\s+-\s+/);
    if (parts.length < 3 || !parts[0].trimEnd().endsWith(':')) return;
    if (!parts.slice(1, -1).every((part) => part.trimEnd().endsWith(';'))) return;
    const list = $('<ul>');
    for (const item of parts.slice(1)) list.append($('<li>').html(item.trim()));
    $(p).html(parts[0].trim()).after(list);
  });
}

/** Підпис під фото (`.caption`), що дослівно повторює заголовок свого розділу, — зайвий: прибираємо. */
export function dropHeadingCaptions($, body) {
  let heading = '';
  body.find('h2, h3, .caption').each((_, el) => {
    const text = cleanText($(el).text()).toLocaleLowerCase('uk');
    if (!$(el).hasClass('caption')) heading = text;
    else if (text && text === heading) $(el).remove();
  });
}

export default {
  name: 'pages',
  label: 'сторінки',
  contentDir: 'src/content/pages',
  assetsDir: 'src/assets/pages',
  noCover: true,

  /** Вибірка для прототипу (аудит): «Про клуб», «МКК», «Табір». Списків на старому сайті немає: «усе» — те саме. */
  sampleUrls: () => PAGES.map((p) => p.url),

  parse(html, pageUrl) {
    const $ = load(html);
    if (!PAGE_TYPES.some((c) => $('body').hasClass(c))) {
      throw new Error(`це не статична сторінка (немає класу ${PAGE_TYPES.join(' / ')} на body)`);
    }
    const title = cleanText($('h1#page-title, h1.page__title').first().text());
    if (!title) throw new Error('немає заголовка h1');
    const legacy = legacyUrl($, pageUrl);

    const article = $('article.node').first();
    const body = article.find('.field-name-body .field-item').first();
    if (!body.length) throw new Error('немає тіла сторінки (.field-name-body)');

    // Зміст на якорі цієї ж сторінки: пункти, що ведуть лише на `#…`, прибираємо; решта посилань на якорі — текст.
    body.find('li').each((_, li) => {
      const links = $(li).find('a[href]');
      if (links.length && links.toArray().every((a) => $(a).attr('href').startsWith('#'))) $(li).remove();
    });
    body.find('ul, ol').each((_, list) => {
      if (!$(list).children('li').length) $(list).remove();
    });
    body.find('a[href^="#"]').each((_, a) => {
      $(a).replaceWith($(a).contents());
    });
    // Іменовані якорі (`<a name="faq">`) — порожні мітки без адреси.
    body.find('a:not([href])').each((_, a) => {
      $(a).replaceWith($(a).contents());
    });

    // Підзаголовки: рядок ВЕЛИКИМИ жирним по центру → h2; питання FAQ (жирний абзац, що закінчується «?») → h3.
    body.find('div, p').each((_, el) => {
      if (!isWholeBold($, el) || $(el).find('div, p').length) return;
      const text = cleanText($(el).text());
      if (/\p{L}/u.test(text) && text === text.toUpperCase()) {
        $(el).replaceWith($('<h2>').text(sentenceCase(text)));
      } else if (text.endsWith('?')) {
        $(el).replaceWith($('<h3>').text(text.replace(/^[-–—]\s*/, '')));
      }
    });

    dropHeadingCaptions($, body);
    splitInlineLists($, body);

    // Пошта: `[at]` → `@`, адреса в тексті → посилання.
    body.find('a[href^="mailto:"]').each((_, a) => {
      $(a).attr('href', deobfuscate($(a).attr('href')));
    });
    body.find('*').contents().each((_, node) => {
      if (node.type === 'text') node.data = deobfuscate(node.data);
    });
    linkEmails($, body);

    // Мініатюра модуля зображень Drupal (`/files/images/x.thumbnail.png`) → оригінал (`x.png`).
    body.find('img[src]').each((_, img) => {
      $(img).attr('src', $(img).attr('src').replace(/\.thumbnail(\.\w+)$/, '$1'));
    });

    // Дочірні сторінки розділу — посиланнями на старий сайт.
    const children = article.find('.book-navigation > ul.menu > li > a[href]');
    if (children.length) {
      body.append('<h2>Сторінки розділу на старому сайті</h2>');
      const list = $('<ul>');
      children.each((_, a) => {
        list.append($('<li>').append($('<a>').attr('href', absoluteUrl($(a).attr('href'))).text(cleanText($(a).text()))));
      });
      body.append(list);
    }

    prepareBody($, body);
    // Посилання на перенесені сторінки — на новий сайт; застарілі — на актуальні сторінки старого сайту.
    body.find('a[href]').each((_, a) => {
      const updated = UPDATED_LINKS.get($(a).attr('href'));
      if (updated) $(a).attr('href', updated);
      const slug = slugByUrl.get(withoutHash($(a).attr('href')));
      if (slug) $(a).attr('href', `/${slug}/`);
    });
    stripPresentation($, body);
    body.find('span').each((_, span) => {
      if (!cleanText($(span).text())) $(span).remove();
    });
    trimBreaks($, body);

    // Опис для превʼю — перший абзац тексту.
    const first = body
      .find('p')
      .toArray()
      .map((p) => plainText($, p))
      .find(Boolean);
    const description = summarize(first ?? plainText($, body));
    if (!description) throw new Error('порожнє тіло сторінки');

    return {
      legacyUrl: legacy,
      slug: slugByUrl.get(legacy),
      title,
      data: { title, description },
      cover: null,
      bodyHtml: body.html() ?? '',
    };
  },
};
