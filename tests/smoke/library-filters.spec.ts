// Фільтри бібліотеки (тікет 08): район, вид, к.с. і рік комбінуються, лічильник показує, скільки звітів
// лишилося, вибір пишеться в адресу, а відкрите посилання з фільтрами відновлює ту саму вибірку.
// Коли нічого не знайдено — порожній стан із «Скинути фільтри». Без JavaScript видно повний список.
// На телефоні поля згорнуті під кнопку «Фільтри».
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import YAML from 'yaml';
import { reportRoutes } from './routes';

interface Report {
  title: string;
  kind: string;
  grade?: string;
  regions?: string[];
  year?: number;
}

const reports: Report[] = reportRoutes.map((path) =>
  YAML.parse(readFileSync(`src/content/reports/${path.replace('/library/', '')}.md`, 'utf8').split(/^---$/m)[1]),
);

const titlesWhere = (match: (r: Report) => boolean) => reports.filter(match).map((r) => r.title).sort();

const cards = (page: Page) => page.getByRole('main').locator('[data-component="ReportCard"]');

/** Заголовки видимих карток (у порядку на сторінці не важливо — порівнюємо множини). */
const visibleTitles = async (page: Page) =>
  (await cards(page).filter({ visible: true }).getByRole('heading', { level: 2 }).allInnerTexts()).sort();

const panel = (page: Page) => page.getByRole('form', { name: 'Фільтри звітів' });
const count = (page: Page) => panel(page).locator('[data-filter-count]');

test('Кавказ + 3 к.с.: лишаються тільки такі звіти, лічильник і адреса оновлюються', async ({ page }) => {
  const expected = titlesWhere((r) => !!r.regions?.includes('Кавказ') && r.grade === '3');
  expect(expected.length, 'у вибірці є звіти «Кавказ, 3 к.с.»').toBeGreaterThan(0);

  await page.goto('/library');
  await expect(count(page)).toHaveText(new RegExp(`^Усього ${reports.length} звіт(и|ів)?$`));
  await expect(cards(page).filter({ visible: true })).toHaveCount(reports.length);

  await panel(page).getByLabel('Район').selectOption('Кавказ');
  await panel(page).getByLabel('Категорія складності').selectOption('3');

  expect(await visibleTitles(page)).toEqual(expected);
  await expect(count(page)).toHaveText(new RegExp(`^Знайдено ${expected.length} звіт(и|ів)? з ${reports.length}$`));
  const url = new URL(page.url());
  expect(url.pathname).toMatch(/^\/library\/?$/);
  expect(url.searchParams.get('region')).toBe('Кавказ');
  expect(url.searchParams.get('grade')).toBe('3');
  expect(url.searchParams.has('kind')).toBe(false);

  // Відкриття такої адреси в новій вкладці відновлює і вибір у полях, і вибірку.
  const fresh = await page.context().newPage();
  await fresh.goto(page.url());
  await expect(panel(fresh).getByLabel('Район')).toHaveValue('Кавказ');
  await expect(panel(fresh).getByLabel('Категорія складності')).toHaveValue('3');
  await expect(panel(fresh).getByLabel('Вид туризму')).toHaveValue('');
  expect(await visibleTitles(fresh)).toEqual(expected);
  await expect(count(fresh)).toHaveText(await count(page).innerText());
});

test('вид і рік комбінуються з районом; зняття фільтра повертає звіти', async ({ page }) => {
  await page.goto('/library?region=Карпати&kind=пішохідний&year=2020');
  const expected = titlesWhere((r) => !!r.regions?.includes('Карпати') && r.kind === 'пішохідний' && r.year === 2020);
  expect(expected.length).toBeGreaterThan(0);
  expect(await visibleTitles(page)).toEqual(expected);

  await panel(page).getByLabel('Рік').selectOption('');
  expect(await visibleTitles(page)).toEqual(titlesWhere((r) => !!r.regions?.includes('Карпати') && r.kind === 'пішохідний'));
  expect(new URL(page.url()).searchParams.has('year')).toBe(false);
});

test('нічого не знайдено: порожній стан і «Скинути фільтри» повертає весь список', async ({ page }) => {
  // Гімалаї є лише з 6 к.с. — комбінація з 1 к.с. порожня.
  expect(titlesWhere((r) => !!r.regions?.includes('Гімалаї') && r.grade === '1')).toEqual([]);
  await page.goto('/library');
  await panel(page).getByLabel('Район').selectOption('Гімалаї');
  await panel(page).getByLabel('Категорія складності').selectOption('1');

  await expect(cards(page).filter({ visible: true })).toHaveCount(0);
  await expect(count(page)).toHaveText(`Знайдено 0 звітів з ${reports.length}`);
  const empty = page.getByRole('main').locator('[data-component="EmptyState"]');
  await expect(empty).toBeVisible();
  await expect(empty.getByRole('heading', { level: 2 })).toHaveText('Звітів не знайдено');

  await empty.getByRole('button', { name: 'Скинути фільтри' }).click();
  await expect(empty).toBeHidden();
  await expect(cards(page).filter({ visible: true })).toHaveCount(reports.length);
  await expect(panel(page).getByLabel('Район')).toHaveValue('');
  expect(new URL(page.url()).search).toBe('');
});

test('невідомі значення в адресі ігноруються', async ({ page }) => {
  await page.goto('/library?region=Марс&grade=9&utm=x');
  await expect(cards(page).filter({ visible: true })).toHaveCount(reports.length);
  await expect(panel(page).getByLabel('Район')).toHaveValue('');
  await expect(count(page)).toHaveText(new RegExp(`^Усього ${reports.length} звіт(и|ів)?$`));
});

test.describe('без JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('повний список, панелі фільтрів і порожнього стану не видно', async ({ page }) => {
    await page.goto('/library?region=Кавказ&grade=3');
    await expect(cards(page)).toHaveCount(reports.length);
    await expect(cards(page).filter({ visible: true })).toHaveCount(reports.length);
    await expect(page.locator('[data-component="FilterPanel"] form')).toBeHidden();
    await expect(page.getByRole('main').locator('[data-component="EmptyState"]')).toBeHidden();
  });
});

test.describe('телефон', () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test('поля згорнуті під кнопку «Фільтри», лічильник видно', async ({ page }) => {
    await page.goto('/library?kind=гірський');
    const toggle = panel(page).getByRole('button', { name: /^Фільтри/ });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('Фільтри · 1');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(panel(page).getByLabel('Район')).toBeHidden();
    await expect(count(page)).toBeVisible();
    await expect(panel(page).getByRole('button', { name: 'Скинути фільтри' })).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await panel(page).getByLabel('Район').selectOption('Карпати');
    expect(await visibleTitles(page)).toEqual(titlesWhere((r) => !!r.regions?.includes('Карпати') && r.kind === 'гірський'));

    await toggle.click();
    await expect(panel(page).getByLabel('Район')).toBeHidden();
  });
});

test('на компʼютері поля видно одразу, кнопки «Фільтри» немає', async ({ page }) => {
  await page.goto('/library');
  await expect(panel(page).getByLabel('Район')).toBeVisible();
  await expect(panel(page).getByRole('button', { name: /^Фільтри/ })).toBeHidden();
  await expect(panel(page).getByRole('button', { name: 'Скинути фільтри' })).toBeHidden();
});
