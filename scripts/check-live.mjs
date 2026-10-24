#!/usr/bin/env node
// Перевірка живого сайту на Cloudflare (продакшн чи превʼю гілки) — те, чого не бачить локальна збірка:
// - вигадана адреса (зі слешем і без) віддає статус 404 і нашу сторінку «не знайдено»;
// - ключові сторінки відкриваються одразу (200), а внутрішні посилання на них не дають редиректу 308;
// - превʼю посилань (Open Graph): повна адреса картинки, розмір у тегах, картинка відкривається.
//
// Використання: npm run check:live -- [адреса сайту]   (за замовчуванням — https://tk-globus.pages.dev)
// Мережа потрібна; у CI на кожен PR не запускається. Запускає щоденна перезбірка (.github/workflows/rebuild.yml).

const base = new URL(process.argv[2] ?? 'https://tk-globus.pages.dev');
const KEY_PAGES = ['/', '/join/', '/library/', '/news/', '/events/', '/about/', '/mkk/', '/camp/'];
const NOT_FOUND = 'Сторінку не знайдено';

const problems = [];
const fail = (message) => problems.push(message);
const get = (path, init = {}) => fetch(new URL(path, base), { redirect: 'manual', ...init });

/** Внутрішні посилання сторінки на інші сторінки сайту (без файлів і якорів). */
function pageLinks(html) {
  const links = new Set();
  for (const [, href] of html.matchAll(/\shref="([^"#]+)/g)) {
    const url = new URL(href, base);
    if (url.origin !== base.origin) continue;
    if (/\.[a-z0-9]+$/i.test(url.pathname)) continue;
    links.add(url.pathname);
  }
  return links;
}

const meta = (html, property) => html.match(new RegExp(`<meta property="${property}" content="([^"]*)"`))?.[1];

// 1. Вигадана адреса — 404 і наша сторінка.
for (const path of ['/takoyi-storinky-nemaye', '/takoyi-storinky-nemaye/']) {
  const res = await get(path);
  const text = await res.text();
  if (res.status !== 404) fail(`${path}: статус ${res.status}, а не 404`);
  else if (!text.includes(NOT_FOUND)) fail(`${path}: 404, але не наша сторінка «${NOT_FOUND}»`);
}

// 2. Ключові сторінки (200 без редиректу) і превʼю посилань; збираємо внутрішні посилання.
const linked = new Set();
const pages = [...KEY_PAGES];
for (const path of pages) {
  const res = await get(path);
  if (res.status !== 200) {
    fail(`${path}: статус ${res.status}${res.headers.get('location') ? ` → ${res.headers.get('location')}` : ''}`);
    continue;
  }
  const html = await res.text();
  for (const link of pageLinks(html)) linked.add(link);
  // Перша новина, звіт і подія — теж перевіряємо превʼю (тип article, картинка з обкладинки).
  if (['/news/', '/library/', '/events/'].includes(path)) {
    const first = [...pageLinks(html)].find((l) => l.startsWith(path) && l !== path && !/^\/news\/\d+\/$/.test(l));
    if (first && !pages.includes(first)) pages.push(first);
  }

  const image = meta(html, 'og:image');
  const width = Number(meta(html, 'og:image:width'));
  const height = Number(meta(html, 'og:image:height'));
  if (!image?.startsWith('https://')) fail(`${path}: og:image не повна адреса (${image})`);
  else {
    const img = await fetch(image);
    const type = img.headers.get('content-type') ?? '';
    if (img.status !== 200 || !type.startsWith('image/')) fail(`${path}: картинка превʼю ${image} — ${img.status} ${type}`);
  }
  if (!(width > 0 && height > 0)) fail(`${path}: немає og:image:width / og:image:height`);
  const ogUrl = meta(html, 'og:url');
  if (!ogUrl || new URL(ogUrl).pathname !== path) fail(`${path}: og:url ${ogUrl}`);
}

// 3. Внутрішні посилання з цих сторінок — без редиректу (зайвий 308 = посилання без слеша в кінці).
const results = await Promise.all(
  [...linked].map(async (path) => {
    const res = await get(path, { method: 'HEAD' });
    return { path, status: res.status, location: res.headers.get('location') };
  }),
);
for (const { path, status, location } of results) {
  if (status !== 200) fail(`посилання ${path}: статус ${status}${location ? ` → ${location}` : ''}`);
}

if (problems.length) {
  console.error(`${base.origin}: знайдено проблем — ${problems.length}:`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `${base.origin}: 404 працює; ${pages.length} сторінок відкриваються без редиректу, превʼю посилань з картинкою й розміром; ` +
    `внутрішніх посилань перевірено ${results.length}, редиректів немає.`,
);
