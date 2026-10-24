// Події: пункт меню веде на /events; майбутні й минулі розділені правильно відносно поточної дати (за Києвом);
// перемикач «Список / Календар» і гортання місяців (стан — в адресі); сторінка події з датою, місцем,
// посиланнями й описом; блок «Найближчі події» на головній (або порожній стан).
// Очікуване тест рахує сам із файлів контенту — незалежно від коду сайту (src/lib/events.ts).
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import YAML from 'yaml';
import { eventRoutes } from './routes';

interface EventFrontmatter {
  title: string;
  start: string;
  end?: string;
  location?: string;
  cover?: string;
  links?: { name: string; url: string }[];
  legacyUrl: string;
}

const frontmatter = (slug: string): EventFrontmatter =>
  YAML.parse(readFileSync(`src/content/events/${slug}.md`, 'utf8').split(/^---$/m)[1]);

const nodeId = (url: string) => Number(url.match(/\/node\/(\d+)/)?.[1] ?? 0);

// Сьогодні в Києві (РРРР-ММ-ДД). Подія майбутня, доки не минув її останній день.
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
  new Date(),
);
const lastDay = (e: EventFrontmatter) => (e.end ?? e.start).slice(0, 10);

const events = eventRoutes
  .map((path) => ({ ...frontmatter(path.replace('/events/', '')), path }))
  .sort((a, b) => a.start.localeCompare(b.start) || nodeId(a.legacyUrl) - nodeId(b.legacyUrl));
const upcoming = events.filter((e) => lastDay(e) >= today);
const past = events.filter((e) => lastDay(e) < today).reverse();

const section = (page: Page, title: string) =>
  page.getByRole('main').locator('section', { has: page.getByRole('heading', { level: 2, name: title, exact: true }) });

const cardLinks = (scope: ReturnType<typeof section>) =>
  scope.locator('[data-component="EventCard"] h3 a').evaluateAll((els) => els.map((el) => el.getAttribute('href')));

test('імпортовано події з вибірки, зокрема «Осінній лист 2026» (25 жовтня 2026)', () => {
  expect(events.length, 'імпортовані події').toBeGreaterThanOrEqual(25);
  const autumn = events.find((e) => e.title.includes('Осінній лист 2026'));
  expect(autumn?.start).toBe('2026-10-25T08:00');
  expect(autumn?.links?.map((l) => l.name)).toEqual(expect.arrayContaining(['Реєстрація команд', 'Умови']));
});

test('пункт меню «Події» веде на /events', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Головне меню' }).getByRole('link', { name: 'Події' }).click();
  await expect(page).toHaveURL(/\/events\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Події');
});

test('/events: майбутні й минулі розділені правильно відносно поточної дати', async ({ page }) => {
  await page.goto('/events');
  const upcomingSection = section(page, 'Найближчі події');
  const pastSection = section(page, 'Минулі події');

  // Майбутні — найближча першою; немає — порожній стан.
  expect(await cardLinks(upcomingSection)).toEqual(upcoming.map((e) => e.path));
  if (!upcoming.length) await expect(upcomingSection.locator('[data-component="EmptyState"]')).toBeVisible();

  // Минулі — найсвіжіша першою.
  expect(await cardLinks(pastSection)).toEqual(past.map((e) => e.path));

  // Картка показує дату й час (машинно — початок) і місце.
  for (const e of [...upcoming, ...past]) {
    const card = page.locator('[data-component="EventCard"]', { has: page.locator(`a[href="${e.path}"]`) });
    await expect(card.locator('time')).toHaveAttribute('datetime', e.start);
    if (e.location) await expect(card).toContainText(e.location);
  }
});

test('/events: без вибору — список; перемикач показує календар і пише вигляд в адресу', async ({ page }) => {
  await page.goto('/events');
  const toggle = page.getByRole('group', { name: 'Вигляд подій' });
  const listButton = toggle.getByRole('button', { name: 'Список' });
  const calendarButton = toggle.getByRole('button', { name: 'Календар' });
  const calendar = page.locator('[data-component="EventCalendar"]');

  await expect(listButton).toHaveAttribute('aria-pressed', 'true');
  await expect(section(page, 'Минулі події')).toBeVisible();
  await expect(calendar).toBeHidden();

  await calendarButton.click();
  await expect(calendarButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/[?&]view=calendar/);
  await expect(calendar).toBeVisible();
  await expect(section(page, 'Минулі події')).toBeHidden();

  await listButton.click();
  await expect(page).not.toHaveURL(/view=/);
  await expect(calendar).toBeHidden();
});

const monthKey = (day: string) => day.slice(0, 7);
const monthTitle = (key: string) => {
  const name = new Intl.DateTimeFormat('uk-UA', { month: 'long', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${key.slice(0, 4)}`;
};
const shiftMonth = (key: string, by: number) => {
  const d = new Date(`${key}-15T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
};

test('календар: спочатку поточний місяць, кнопки гортають місяці, адреса відкриває той самий місяць', async ({ page }) => {
  await page.goto('/events?view=calendar');
  const visibleMonth = page.locator('[data-month]:visible');
  await expect(visibleMonth).toHaveCount(1);
  await expect(visibleMonth).toHaveAttribute('data-month', monthKey(today));
  await expect(visibleMonth.getByRole('heading', { level: 2 })).toHaveText(monthTitle(monthKey(today)));
  await expect(visibleMonth.locator('[aria-current="date"]')).toHaveAttribute('data-date', today);

  const prev = shiftMonth(monthKey(today), -1);
  await visibleMonth.getByRole('button', { name: /^Попередній місяць/ }).click();
  await expect(page.locator('[data-month]:visible')).toHaveAttribute('data-month', prev);
  await expect(page).toHaveURL(new RegExp(`month=${prev}`));
  await expect(page.getByRole('heading', { level: 2, name: monthTitle(prev) })).toBeFocused();

  await page.reload();
  await expect(page.locator('[data-month]:visible')).toHaveAttribute('data-month', prev);
  await expect(page.getByRole('group', { name: 'Вигляд подій' }).getByRole('button', { name: 'Календар' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('календар: кожна подія стоїть на своїх датах (багатоденна — у кожному дні)', async ({ page }) => {
  await page.goto('/events');
  const calendar = page.locator('[data-component="EventCalendar"]');
  for (const e of events) {
    for (let day = e.start.slice(0, 10); day <= lastDay(e); ) {
      await expect(calendar.locator(`td[data-date="${day}"] a[href="${e.path}"]`), `${e.title}: ${day}`).toHaveCount(1);
      const d = new Date(`${day}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      day = d.toISOString().slice(0, 10);
    }
  }
  // «Осінній лист 2026» — 25 жовтня, у місяці «Жовтень 2026».
  const autumn = events.find((e) => e.title.includes('Осінній лист 2026'))!;
  await page.goto('/events?view=calendar&month=2026-10');
  const october = page.locator('[data-month="2026-10"]');
  await expect(october).toBeVisible();
  await expect(october.locator(`td[data-date="2026-10-25"] a[href="${autumn.path}"]`)).toBeVisible();
});

test('на телефоні календар показує список подій місяця', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const e = events[events.length - 1];
  await page.goto(`/events?view=calendar&month=${monthKey(e.start)}`);
  const month = page.locator(`[data-month="${monthKey(e.start)}"]`);
  await expect(month.getByRole('heading', { name: 'Події місяця' })).toBeVisible();
  await expect(month.getByRole('link', { name: e.title, exact: true })).toBeVisible();
});

test('головна: блок «Найближчі події» — до трьох найближчих або порожній стан', async ({ page }) => {
  await page.goto('/');
  const block = section(page, 'Найближчі події');
  await expect(block.getByRole('link', { name: 'Усі події' })).toHaveAttribute('href', '/events');
  expect(await cardLinks(block)).toEqual(upcoming.slice(0, 3).map((e) => e.path));
  if (!upcoming.length) {
    await expect(block.locator('[data-component="EmptyState"]')).toContainText('Найближчих подій поки немає');
  }
});

for (const e of events) {
  test(`${e.path}: дата, місце, посилання, опис і оригінал`, async ({ page }) => {
    await page.goto(e.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(e.title);
    await expect(page.locator('main [data-component="Tag"]').first()).toHaveText(
      lastDay(e) >= today ? 'Майбутня подія' : 'Минула подія',
    );

    const facts = page.locator('[data-component="Facts"]');
    await expect(facts.locator('time')).toHaveAttribute('datetime', e.start);
    await expect(facts.locator('time')).toContainText(e.start.slice(11, 16));
    if (e.location) await expect(facts).toContainText(e.location);

    for (const link of e.links ?? []) {
      await expect(page.getByRole('main').locator(`[data-component="Button"][href="${link.url}"]`)).toHaveText(link.name);
    }

    await expect(page.getByRole('link', { name: 'Оригінал на старому сайті' })).toHaveAttribute('href', e.legacyUrl);
    const prose = page.locator('[data-component="Prose"]');
    expect((await prose.innerText()).length).toBeGreaterThan(50);
    if (e.cover) {
      const img = prose.locator('img').first();
      await expect(img).toBeVisible();
      expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), 'фото завантажилось').toBe(true);
    }
  });
}
