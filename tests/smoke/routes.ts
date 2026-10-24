// Маршрути сайту для смоук-тестів. Кожен новий маршрут додається сюди — і отримує базові перевірки
// (банер, noindex, шапка, підвал), перевірку мобільної ширини й порядку заголовків.
// Сторінки записів (новини…) беруться з файлів контенту, тож кожен імпортований запис теж перевіряється.
import { readdirSync } from 'node:fs';

const slugs = (collection: string) =>
  readdirSync(`src/content/${collection}`)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3));

export const newsRoutes = slugs('news').map((slug) => `/news/${slug}`);

export const reportRoutes = slugs('reports').map((slug) => `/library/${slug}`);

export const routes = ['/', '/join', '/styleguide', '/news', ...newsRoutes, '/library', ...reportRoutes];

// Статичні сторінки (тікет 09).
routes.push('/about', '/mkk', '/camp');

// Події (тікет 06): список і календар, сторінка кожної події.
export const eventRoutes = slugs('events').map((slug) => `/events/${slug}`);
routes.push('/events', ...eventRoutes);
