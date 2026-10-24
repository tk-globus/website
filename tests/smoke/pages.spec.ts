// Статичні сторінки (тікет 09): пункти меню «Про клуб», «МКК», «Табір» ведуть на живі сторінки з текстом
// зі старого сайту; «Про клуб» — з адресою, дорогою й форумом, «МКК» — з документами й контактом комісії.
import { test, expect } from '@playwright/test';
import settings from '../../src/data/settings.json' with { type: 'json' };

const OLD_SITE = 'https://www.tkg.org.ua/';

for (const { label, href } of [
  { label: 'Про клуб', href: '/about/' },
  { label: 'МКК', href: '/mkk/' },
  { label: 'Табір', href: '/camp/' },
]) {
  test(`пункт меню «${label}» веде на ${href}`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Головне меню' }).getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${href}/?$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
}

test('/about: історія, напрями, адреса й дорога, карта, канали і старий форум', async ({ page }) => {
  await page.goto('/about/');
  const main = page.getByRole('main');
  await expect(main).toContainText('1952');
  await expect(main.getByRole('heading', { level: 2, name: 'Напрями діяльності' })).toBeVisible();
  await expect(main.getByRole('heading', { level: 2, name: 'Розташування клубу' })).toBeVisible();
  await expect(main).toContainText('Верхньоключова, 1/26');
  await expect(main).toContainText('Шулявська');
  const map = main.getByRole('img', { name: /Розташування турклубу/ });
  await expect(map).toBeVisible();
  expect(await map.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(300);

  await expect(main.getByRole('link', { name: 'Старий форум' })).toHaveAttribute('href', settings.channels.forum);
  await expect(main.locator(`[data-component="Channels"] a[href="${settings.channels.telegram}"]`)).toHaveCount(1);
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Форум' })).toHaveAttribute('href', settings.channels.forum);
});

test('/mkk: FAQ, документи на старому сайті й контакт МКК', async ({ page }) => {
  await page.goto('/mkk/');
  const main = page.getByRole('main');
  for (const name of ['Контакт МКК', 'Про МКК', 'FAQ', 'Для випуску в похід', 'Для захисту походу']) {
    await expect(main.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
  }
  await expect(main.getByRole('heading', { level: 3, name: /Навіщо МКК\?/ })).toBeVisible();

  // Документи — посилання на старий сайт.
  for (const name of ['Маршрутна книжка та зразок її заповнення.', 'Шаблон типового звіту про спортивний похід']) {
    await expect(main.getByRole('link', { name, exact: true })).toHaveAttribute('href', new RegExp(`^${OLD_SITE}node/\\d+$`));
  }
  expect(await main.locator(`a[href^="${OLD_SITE}"]`).count()).toBeGreaterThan(30);

  // Контакт: пошта комісії, графік засідань і склад.
  await expect(main.getByRole('link', { name: settings.mkk.email }).first()).toHaveAttribute('href', `mailto:${settings.mkk.email}`);
  await expect(main.getByRole('link', { name: 'Графік роботи МКК' }).first()).toHaveAttribute('href', settings.mkk.schedule);
  await expect(main.getByRole('link', { name: 'Склад МКК і координати' })).toHaveAttribute('href', settings.mkk.members);
});

test('/camp: табір «Глобус» і школа інструкторів', async ({ page }) => {
  await page.goto('/camp/');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toContainText('Табір');
  await expect(main).toContainText('Говерли');
  await expect(main.getByRole('link', { name: /Школа інструкторів/ })).toHaveAttribute('href', `${OLD_SITE}node/32583`);
});

test('головна: напрям «Табір «Глобус»» веде на /camp', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('link', { name: 'Табір «Глобус»' })).toHaveAttribute('href', '/camp/');
});
