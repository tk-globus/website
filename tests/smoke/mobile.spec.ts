// Телефон: немає горизонтального скролу, меню згорнуте під кнопку й відкривається.
// Найвужчий телефон (320 px): відкрите меню теж не дає скролу, кнопка «Закрити» не виходить за край.
import { test, expect } from '@playwright/test';
import settings from '../../src/data/settings.json' with { type: 'json' };
import { routes } from './routes';

test.use({ viewport: { width: 360, height: 740 } });

for (const route of [...routes, '/takoyi-storinky-nemaye']) {
  test(`${route}: на телефоні немає горизонтального скролу`, async ({ page }) => {
    await page.goto(route);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}

test('на телефоні меню згорнуте й відкривається кнопкою', async ({ page }) => {
  await page.goto('/');
  const header = page.getByRole('banner');
  const toggle = header.getByRole('button', { name: 'Меню' });
  const menu = page.locator('#mobile-menu');

  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeHidden();
  await expect(header.getByRole('navigation')).toHaveCount(0);

  await toggle.click();
  await expect(header.getByRole('button', { name: 'Закрити' })).toHaveAttribute('aria-expanded', 'true');
  for (const label of ['Про клуб', 'Новини', 'Події', 'Бібліотека', 'МКК', 'Табір', 'Долучитися']) {
    await expect(menu.getByText(label, { exact: true })).toBeVisible();
  }

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('на 320 px відкрите меню не виходить за край', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  const header = page.getByRole('banner');
  await header.getByRole('button', { name: 'Меню' }).click();
  const close = header.getByRole('button', { name: 'Закрити' });
  await expect(close).toBeVisible();

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

  const box = await close.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(clientWidth);
  await expect(header.getByRole('img', { name: settings.name })).toBeVisible();
});
