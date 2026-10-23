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
//   parse(html, url) → { legacyUrl, title, data, cover, bodyHtml }
//       data      — поля frontmatter (без обкладинки), мають пройти схему колекції
//       cover     — { src, alt } оригіналу на старому сайті або null
//       bodyHtml  — HTML тіла з абсолютними адресами (ядро завантажить фото й перетворить на Markdown)
import news from './news.mjs';

export const types = { news };
