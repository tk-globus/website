// Маршрути сайту для смоук-тестів. Кожен новий маршрут додається сюди — і отримує базові перевірки
// (банер, noindex, шапка, підвал), перевірку мобільної ширини й порядку заголовків.
// Сторінки записів (новини…) беруться з файлів контенту, тож кожен імпортований запис теж перевіряється.
// Адреси — зі слешем у кінці, як їх віддає Cloudflare (без редиректу 308) і як посилається сам сайт.
import { readdirSync } from 'node:fs';
import { NEWS_PER_PAGE, pageCount, pageHref } from '../../src/lib/pagination';

const slugs = (collection: string) =>
  readdirSync(`src/content/${collection}`)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3));

export const newsRoutes = slugs('news').map((slug) => `/news/${slug}/`);

/** Сторінки стрічки новин: /news/, /news/2/… (тікет 05b). */
export const newsPageRoutes = Array.from({ length: pageCount(newsRoutes.length, NEWS_PER_PAGE) }, (_, i) => pageHref('/news/', i + 1));

export const reportRoutes = slugs('reports').map((slug) => `/library/${slug}/`);

export const routes = ['/', '/join/', '/styleguide/', ...newsPageRoutes, ...newsRoutes, '/library/', ...reportRoutes];

// Статичні сторінки (тікет 09).
routes.push('/about/', '/mkk/', '/camp/');

// Події (тікет 06): список і календар, сторінка кожної події.
export const eventRoutes = slugs('events').map((slug) => `/events/${slug}/`);
routes.push('/events/', ...eventRoutes);
