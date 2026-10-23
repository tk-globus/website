// Новини: пункт меню веде на /news, у стрічці всі імпортовані новини (найновіша — першою),
// сторінка новини показує заголовок, дату, текст, фото й посилання на оригінал.
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import YAML from 'yaml';
import { newsRoutes } from './routes';

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

const news = newsRoutes
  .map((route) => ({ route, ...frontmatter(route.replace('/news/', '')) }))
  .sort((a, b) => b.date.localeCompare(a.date));

test('пункт меню «Новини» веде на /news', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Головне меню' }).getByRole('link', { name: 'Новини' }).click();
  await expect(page).toHaveURL(/\/news\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Новини');
});

test('/news: усі новини з датами, найновіша — першою', async ({ page }) => {
  expect(news.length, 'імпортовані новини').toBeGreaterThan(0);
  await page.goto('/news');
  const items = page.getByRole('main').getByRole('article');
  await expect(items).toHaveCount(news.length);

  const first = items.first();
  await expect(first.getByRole('heading', { level: 2 })).toHaveText(news[0].title);
  await expect(first.locator('time')).toHaveAttribute('datetime', news[0].date);

  for (const { route, title } of news) {
    await expect(page.getByRole('link', { name: title, exact: true }).and(page.locator(`[href="${route}"]`))).toHaveCount(1);
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
  });
}
