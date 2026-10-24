// Типи контенту, які вміє імпортер. Новий тип (подія, звіт, сторінка) = новий модуль у цій теці
// з тим самим інтерфейсом + рядок у `types` нижче + схема в src/lib/schemas/ і колекція в src/content.config.ts.
//
// Інтерфейс типу:
//   name          — імʼя для командного рядка (`npm run import -- news`)
//   label         — назва для звіту імпортера
//   contentDir    — куди писати Markdown-файли (src/content/<колекція>)
//   assetsDir     — куди класти фото (src/assets/<колекція>/<slug>/)
//   sampleUrls()  — адреси вибірки для прототипу (--scope sample)
//   listSources   — сторінки-списки старого сайту для --scope all
//   parseList(html) → { urls, next } — адреси записів зі сторінки списку і наступна сторінка (або null)
//   noCover       — (необовʼязково) true: у типу немає обкладинки — не попереджати про її відсутність
//   localLinks(root) — (необовʼязково) Map: ключ адреси старого сайту (oldSiteKey) → адреса на новому сайті;
//                   такі посилання в тілі ядро переводить на новий сайт (новини → звіти бібліотеки, links.mjs)
//   parse(html, url) → { legacyUrl, title, data, cover, bodyHtml }
//       slug      — (необовʼязково) імʼя файлу замість slug із заголовка (сторінки: about, mkk, camp)
//       data      — поля frontmatter (без обкладинки), мають пройти схему колекції
//       cover     — { src, alt } оригіналу на старому сайті або null
//       bodyHtml  — HTML тіла з абсолютними адресами (ядро завантажить фото й перетворить на Markdown)
//       unrecognized — (необовʼязково) [{ field, value }]: значення, яких немає в переліках схеми, — у звіт імпорту
//       warnings  — (необовʼязково) інші попередження про запис
import news from './news.mjs';
import reports from './reports.mjs';
import pages from './pages.mjs';

export const types = { news, reports, pages };
