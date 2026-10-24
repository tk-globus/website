// Посилання на вже перенесені записи: адреса на старому сайті → адреса на новому.
// Новини-анонси звітів («Опубліковано звіт про …») посилаються на звіт старого сайту — вузол /node/<nid>
// або одразу на PDF. Якщо цей звіт уже імпортовано в бібліотеку, посилання веде на /library/<slug>,
// інакше лишається на старому сайті. Звіти шукаються за legacyUrl і за адресами їхніх файлів (`files`).
//
// Порядок імпорту: спершу звіти, потім новини. Імпортували звіти пізніше — перезапустіть імпорт новин
// (`npm run import -- news`); застарілі посилання ловить тест tests/scripts/news-library-links.test.mjs.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { absoluteUrl, load } from './html.mjs';

export const REPORTS_DIR = 'src/content/reports';

/**
 * Ключ адреси старого сайту для порівняння: `http://tkg.org.ua/node/1/#x` і `https://www.tkg.org.ua/node/1`
 * дають той самий ключ. Не старий сайт — null.
 */
export function oldSiteKey(href) {
  let url;
  try {
    url = new URL(absoluteUrl(String(href)));
  } catch {
    return null;
  }
  if (!/^(?:www\.)?tkg\.org\.ua$/i.test(url.hostname) || !/^https?:$/.test(url.protocol)) return null;
  const path = decodeURI(url.pathname).replace(/\/+$/, '') || '/';
  return `www.tkg.org.ua${path}${url.search}`;
}

/** Звіти бібліотеки: ключ адреси на старому сайті (вузол звіту й кожен його файл) → `/library/<slug>`. */
export function libraryLinks(root) {
  const links = new Map();
  const dir = join(root, REPORTS_DIR);
  if (!existsSync(dir)) return links;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const frontmatter = readFileSync(join(dir, file), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
    const data = (frontmatter && YAML.parse(frontmatter)) || {};
    const href = `/library/${file.slice(0, -3)}`;
    for (const url of [data.legacyUrl, ...(data.files ?? []).map((f) => f.url)]) {
      const key = url && oldSiteKey(url);
      if (key && !links.has(key)) links.set(key, href);
    }
  }
  return links;
}

/**
 * Посилання тіла (HTML з абсолютними адресами) на перенесені записи → адреси нового сайту.
 * Підказку з розміром файлу (`title="43 MB"`) прибирає: тепер посилання веде на сторінку, а не на файл.
 */
export function rewriteLinks(html, links) {
  if (!links?.size || !html) return html;
  const $ = load(html);
  let changed = false;
  $('a[href]').each((_, a) => {
    const target = links.get(oldSiteKey($(a).attr('href')));
    if (!target) return;
    $(a).attr('href', target).removeAttr('title');
    changed = true;
  });
  return changed ? $('body').html() : html;
}
