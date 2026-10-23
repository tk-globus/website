// Смоук-тест зібраного сайту: сторінка відкривається, банер прототипу й noindex на місці.
import { test, expect } from '@playwright/test';
import settings from '../../src/data/settings.json' with { type: 'json' };

// Кожен новий маршрут додається сюди — і отримує ті самі базові перевірки.
const routes = ['/'];

for (const route of routes) {
  test(`${route}: відкривається, є банер прототипу, noindex, шапка й підвал`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const response = await page.goto(route);
    expect(response?.status()).toBe(200);

    const banner = page.getByTestId('prototype-banner');
    await expect(banner).toContainText(settings.prototypeBanner.text);
    await expect(banner.getByRole('link')).toHaveAttribute('href', settings.channels.oldSite);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');

    await expect(page.getByRole('banner').getByRole('img', { name: settings.name })).toBeVisible();
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Telegram-чат' })).toHaveAttribute(
      'href',
      settings.channels.telegram,
    );

    expect(errors).toEqual([]);
  });
}

test('robots.txt забороняє індексацію', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.status()).toBe(200);
  expect(await response.text()).toMatch(/Disallow:\s*\/\s*$/m);
});
