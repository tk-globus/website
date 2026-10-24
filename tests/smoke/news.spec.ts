// Новини: пункт меню веде на /news; стрічка — картки від нових до старих із пагінацією; сторінка новини
// показує заголовок (без повтору в хлібних крихтах), дату, текст, фото, посилання на оригінал і превʼю
// для месенджерів; анонси звітів ведуть у бібліотеку; на головній — блок останніх новин.
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import YAML from 'yaml';
import { newsPageRoutes, newsRoutes } from './routes';

interface NewsFrontmatter {
  title: string;
  date: string;
  cover?: string;
  legacyUrl: string;
}

const frontmatter = (slug: string): NewsFrontmatter => {
  const text = readFileSync(`src/content/news/${slug}.md`, 'utf8');
  return YAML.parse(text.split(/^---$/m)[1]);
};

const nodeId = (legacyUrl: string) => Number(legacyUrl.match(/\/node\/(\d+)/)?.[1] ?? 0);

// Порядок — як на сайті (src/lib/news.ts): новіші вище, новини одного дня — за номером вузла (пізніший вище).
const news = newsRoutes
  .map((route) => ({ route, ...frontmatter(route.replace('/news/', '')) }))
  .sort((a, b) => b.date.localeCompare(a.date) || nodeId(b.legacyUrl) - nodeId(a.legacyUrl));

/** Новини на сторінці стрічки: адреса й дата кожної картки в порядку показу. */
const cardsOn = async (page: Page) =>
  page
    .getByRole('main')
    .locator('[data-component="NewsCard"]')
    .evaluateAll((cards) =>
      cards.map((card) => ({
        href: card.querySelector('h2 a, h3 a')?.getAttribute('href'),
        date: card.querySelector('time')?.getAttribute('datetime'),
      })),
    );

test('пункт меню «Новини» веде на /news', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Головне меню' }).getByRole('link', { name: 'Новини' }).click();
  await expect(page).toHaveURL(/\/news\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Новини');
});

test('стрічка: усі новини картками з датами, від нових до старих, по сторінках', async ({ page }) => {
  expect(news.length, 'імпортовані новини').toBeGreaterThan(0);
  const shown: { href?: string | null; date?: string | null }[] = [];
  for (const [i, route] of newsPageRoutes.entries()) {
    await page.goto(route);
    const cards = await cardsOn(page);
    expect(cards.length, `${route}: є картки`).toBeGreaterThan(0);
    shown.push(...cards);

    const pagination = page.getByRole('navigation', { name: 'Сторінки новин' });
    if (newsPageRoutes.length === 1) {
      await expect(pagination).toHaveCount(0);
      continue;
    }
    await expect(pagination.locator('[aria-current="page"]')).toHaveText(String(i + 1));
    const next = pagination.getByRole('link', { name: 'Наступна' });
    if (i < newsPageRoutes.length - 1) await expect(next).toHaveAttribute('href', newsPageRoutes[i + 1]);
    else await expect(next).toHaveCount(0);
  }
  expect(shown).toEqual(news.map(({ route, date }) => ({ href: route, date })));
});

test('стрічка: картка без обкладинки показує заглушку, з обкладинкою — фото', async ({ page }) => {
  for (const route of newsPageRoutes) {
    await page.goto(route);
    for (const card of await page.locator('[data-component="NewsCard"]').all()) {
      const href = await card.locator('h2 a').getAttribute('href');
      const item = news.find((n) => n.route === href)!;
      await expect(card.locator('img')).toHaveCount(item.cover ? 1 : 0);
      await expect(card.locator('[data-placeholder]')).toHaveCount(item.cover ? 0 : 1);
    }
  }
});

for (const { route, title, date, cover, legacyUrl } of news) {
  test(`${route}: заголовок, дата, текст і посилання на оригінал`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.locator('main time').first()).toHaveAttribute('datetime', date);
    await expect(page.getByRole('link', { name: 'Оригінал на старому сайті' })).toHaveAttribute('href', legacyUrl);
    const prose = page.locator('[data-component="Prose"]');
    expect((await prose.innerText()).length).toBeGreaterThan(50);
    if (cover) {
      const img = prose.locator('img').first();
      await expect(img).toBeVisible();
      expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), 'фото завантажилось').toBe(true);
    }

    // Хлібні крихти: «Головна › Новини», назва — лише в заголовку h1, не двічі поспіль.
    const crumbs = page.getByRole('navigation', { name: 'Хлібні крихти' });
    await expect(crumbs.getByRole('listitem')).toHaveText(['Головна', 'Новини']);
    await expect(crumbs.getByRole('link', { name: 'Новини' })).toHaveAttribute('href', '/news');
    await expect(crumbs).not.toContainText(title);
  });
}

for (const { route, title, cover } of news.filter((n) => n.cover).slice(0, 2)) {
  test(`${route}: превʼю для месенджерів — заголовок, опис і обкладинка`, async ({ page, request }) => {
    await page.goto(route);
    const meta = (selector: string) => page.locator(`head meta[${selector}]`);
    await expect(meta('property="og:title"')).toHaveAttribute('content', new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    expect((await meta('property="og:description"').getAttribute('content'))?.length).toBeGreaterThan(20);
    const image = (await meta('property="og:image"').getAttribute('content'))!;
    expect(image, `обкладинка ${cover}, а не картка з логотипом`).not.toMatch(/\/og\.png$/);
    expect(image).toMatch(/^https:\/\//);
    await expect(meta('name="twitter:image"')).toHaveAttribute('content', image);
    const response = await request.get(new URL(image).pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/jpeg');
  });
}

test('анонс звіту веде на сторінку звіту в бібліотеці', async ({ page }) => {
  const announcements = news.filter(({ route }) =>
    readFileSync(`src/content/news/${route.replace('/news/', '')}.md`, 'utf8').includes('](/library/'),
  );
  expect(announcements.length, 'новини-анонси звітів, імпортованих у бібліотеку').toBeGreaterThan(0);
  await page.goto(announcements[0].route);
  await page.locator('[data-component="Prose"] a[href^="/library/"]').first().click();
  await expect(page).toHaveURL(/\/library\/[^/]+\/?$/);
  await expect(page.getByRole('navigation', { name: 'Хлібні крихти' }).getByRole('link', { name: 'Бібліотека' })).toBeVisible();
});

test('головна: блок «Останні новини» — 3–4 свіжі картки, «Усі новини», клік відкриває новину', async ({ page }) => {
  await page.goto('/');
  const block = page.locator('section', { has: page.getByRole('heading', { level: 2, name: 'Останні новини' }) });
  await expect(block.getByRole('link', { name: 'Усі новини' })).toHaveAttribute('href', '/news');
  const cards = block.locator('[data-component="NewsCard"]');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(Math.min(3, news.length));
  expect(count).toBeLessThanOrEqual(4);
  expect(await cardsOn(page).then((all) => all.slice(0, count))).toEqual(
    news.slice(0, count).map(({ route, date }) => ({ href: route, date })),
  );

  await cards.first().click();
  await expect(page).toHaveURL(new RegExp(`${news[0].route}/?$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(news[0].title);
});
