// Візитівка: головна веде новачка на /join, а /join — у Telegram-чат клубу.
// Посилання на обидві сторінки мають превʼю для месенджерів (Open Graph і Twitter-картка).
import { test, expect } from '@playwright/test';
import settings from '../../src/data/settings.json' with { type: 'json' };

test('кнопка «Долучитися» на головній веде на /join, а там є посилання на Telegram-чат', async ({ page }) => {
  await page.goto('/');
  const join = page.getByRole('main').getByRole('link', { name: 'Долучитися' }).first();
  await expect(join).toHaveAttribute('href', '/join');

  await join.click();
  await expect(page).toHaveURL(/\/join\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const telegram = page.getByRole('main').getByRole('link', { name: /Telegram-чат/ }).first();
  await expect(telegram).toHaveAttribute('href', settings.channels.telegram);
});

test('головна: хто ми, напрями й канали клубу', async ({ page }) => {
  await page.goto('/');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText(settings.name);
  await expect(main).toContainText('1952');
  await expect(main).toContainText('некомерційний', { ignoreCase: true });
  await expect(main).toContainText('вузівська приналежність');
  for (const title of ['Походи', 'Навчальні секції', 'Табір «Глобус»', 'Змагання', 'Клубні вечори']) {
    await expect(main.getByRole('heading', { level: 3, name: title })).toBeVisible();
  }
  const { channels } = settings;
  for (const href of [channels.telegram, channels.instagram, channels.youtube, channels.facebook, `mailto:${channels.email}`]) {
    await expect(main.locator(`[data-component="Channels"] a[href="${href}"]`)).toHaveCount(1);
  }
});

test('/join: куратори груп з налаштувань сайту', async ({ page }) => {
  await page.goto('/join');
  const main = page.getByRole('main');
  await expect(main).toContainText(`Куратор — ${settings.curators.groupA}`);
  await expect(main).toContainText(`Куратор — ${settings.curators.groupB}`);
});

test.describe('на телефоні', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('з першого екрана видно, хто ми, і кнопку «Долучитися»', async ({ page }) => {
    await page.goto('/');
    const h1 = page.getByRole('heading', { level: 1 });
    const join = page.getByRole('main').getByRole('link', { name: 'Долучитися' }).first();
    await expect(h1).toBeInViewport({ ratio: 1 });
    await expect(join).toBeInViewport({ ratio: 1 });
  });
});

for (const route of ['/', '/join']) {
  test(`${route}: превʼю для месенджерів (Open Graph, Twitter-картка)`, async ({ page, request }) => {
    await page.goto(route);
    const meta = (selector: string) => page.locator(`head meta[${selector}]`);

    const title = await page.title();
    await expect(meta('property="og:title"')).toHaveAttribute('content', title);
    await expect(meta('name="twitter:title"')).toHaveAttribute('content', title);
    const description = await meta('name="description"').getAttribute('content');
    expect(description?.length).toBeGreaterThan(50);
    await expect(meta('property="og:description"')).toHaveAttribute('content', description!);
    await expect(meta('name="twitter:description"')).toHaveAttribute('content', description!);
    await expect(meta('name="twitter:card"')).toHaveAttribute('content', 'summary_large_image');

    // Месенджери приймають лише повні адреси.
    const ogUrl = new URL((await meta('property="og:url"').getAttribute('content'))!);
    expect([route, `${route}/`]).toContain(ogUrl.pathname);
    const image = (await meta('property="og:image"').getAttribute('content'))!;
    expect(image).toMatch(/^https:\/\//);
    await expect(meta('name="twitter:image"')).toHaveAttribute('content', image);

    // Картинка є в цій збірці: PNG 1200×630.
    const response = await request.get(new URL(image).pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    const png = await response.body();
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
}
