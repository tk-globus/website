// Неіснуюча адреса: сторінка «не знайдено» в стилі сайту і статус 404 (а не головна з 200).
import { test, expect } from '@playwright/test';
import settings from '../../src/data/settings.json' with { type: 'json' };

test('неіснуюча адреса віддає 404 зі сторінкою «не знайдено»', async ({ page }) => {
  const response = await page.goto('/takoyi-storinky-nemaye');
  expect(response?.status()).toBe(404);

  await expect(page.getByRole('heading', { level: 1, name: 'Сторінку не знайдено' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'На головну' })).toHaveAttribute('href', '/');
  await expect(page.getByTestId('prototype-banner')).toContainText(settings.prototypeBanner.text);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
