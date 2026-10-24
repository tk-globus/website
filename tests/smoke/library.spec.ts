// Бібліотека звітів: пункт меню веде на /library, там усі імпортовані звіти в картках (найсвіжіші першими),
// сторінка звіту показує метадані, опис, фото й посилання на файл звіту на старому сайті з розміром.
// На головній — блок-вхід у бібліотеку.
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import YAML from 'yaml';
import { reportRoutes } from './routes';

interface ReportFrontmatter {
  title: string;
  kind: string;
  grade?: string;
  regions?: string[];
  year?: number;
  authors?: string[];
  route?: string;
  cover?: string;
  files?: { name: string; url: string; size?: number }[];
  legacyUrl: string;
}

const frontmatter = (slug: string): ReportFrontmatter =>
  YAML.parse(readFileSync(`src/content/reports/${slug}.md`, 'utf8').split(/^---$/m)[1]);

const nodeId = (url: string) => Number(url.match(/\/node\/(\d+)/)?.[1] ?? 0);

// Порядок, як на сторінці: рік (без року — у кінці), далі номер вузла старого сайту.
const reports = reportRoutes
  .map((path) => ({ ...frontmatter(path.slice('/library/'.length, -1)), path }))
  .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || nodeId(b.legacyUrl) - nodeId(a.legacyUrl));

const gradeLabel = (grade: string) => (grade === 'н/к' ? grade : `${grade} к.с.`);

test('пункт меню «Бібліотека» веде на /library', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Головне меню' }).getByRole('link', { name: 'Бібліотека' }).click();
  await expect(page).toHaveURL(/\/library\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Бібліотека звітів');
});

test('/library: усі звіти в картках, найсвіжіші — першими', async ({ page }) => {
  expect(reports.length, 'імпортовані звіти').toBe(44);
  await page.goto('/library/');
  const cards = page.getByRole('main').locator('[data-component="ReportCard"]');
  await expect(cards).toHaveCount(reports.length);
  const titles = await cards.getByRole('heading', { level: 2 }).allInnerTexts();
  expect(titles).toEqual(reports.map((r) => r.title));

  // Картка: район, вид, к.с., рік, автор, нитка маршруту — і посилання на сторінку звіту.
  for (const [i, r] of reports.entries()) {
    const card = cards.nth(i);
    await expect(card.getByRole('link', { name: r.title, exact: true })).toHaveAttribute('href', r.path);
    const text = await card.innerText();
    for (const value of [...(r.regions ?? []), r.kind, r.grade && gradeLabel(r.grade), r.year, ...(r.authors ?? [])]) {
      if (value) expect(text, `${r.path}: ${value}`).toContain(String(value));
    }
    if (r.route) await expect(card.locator('p').first()).toHaveText(r.route);
  }
});

test('головна: блок-вхід у бібліотеку з найсвіжішими звітами', async ({ page }) => {
  await page.goto('/');
  const block = page.getByRole('main').locator('section', { has: page.getByRole('heading', { level: 2, name: 'Бібліотека звітів' }) });
  await expect(block.getByRole('link', { name: 'Уся бібліотека' })).toHaveAttribute('href', '/library/');
  await expect(block).toContainText(`${reports.length} звіт`);
  const titles = await block.locator('[data-component="ReportCard"]').getByRole('heading', { level: 3 }).allInnerTexts();
  expect(titles).toEqual(reports.slice(0, 3).map((r) => r.title));
});

for (const r of reports) {
  test(`${r.path}: метадані, опис, файл і посилання на оригінал`, async ({ page }) => {
    await page.goto(r.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(r.title);
    // Хлібні крихти: «Головна › Бібліотека», назва звіту — лише в h1, не двічі поспіль.
    const crumbs = page.getByRole('navigation', { name: 'Хлібні крихти' });
    await expect(crumbs.getByRole('listitem')).toHaveText(['Головна', 'Бібліотека']);
    await expect(crumbs.getByRole('link', { name: 'Бібліотека' })).toHaveAttribute('href', '/library/');

    const facts = page.locator('[data-component="Facts"]');
    await expect(facts).toContainText(r.kind);
    if (r.grade) await expect(facts).toContainText(gradeLabel(r.grade));
    if (r.year) await expect(facts).toContainText(String(r.year));
    for (const region of r.regions ?? []) await expect(facts).toContainText(region);
    for (const author of r.authors ?? []) await expect(facts).toContainText(author);
    if (r.route) await expect(facts).toContainText(r.route);

    // Файли звіту — посилання на старий сайт (PDF не копіюємо) з розміром.
    for (const file of r.files ?? []) {
      const link = page.getByRole('main').locator(`[data-component="Button"][href="${file.url}"]`);
      await expect(link).toHaveCount(1);
      if (file.size) await expect(link).toContainText(/\d+(,\d)? (КБ|МБ|ГБ)/);
    }

    await expect(page.getByRole('link', { name: 'Оригінал на старому сайті' })).toHaveAttribute('href', r.legacyUrl);
    if (r.cover) {
      const img = page.locator('[data-component="Prose"] img').first();
      await expect(img).toBeVisible();
      expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), 'фото завантажилось').toBe(true);
    }
  });
}
