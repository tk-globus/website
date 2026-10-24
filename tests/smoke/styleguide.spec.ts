// /styleguide показує всі кольори теми і зразки всіх компонентів бібліотеки.
import { readFileSync, readdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const theme = readFileSync('src/styles/theme.css', 'utf8');
const colorTokens = [...theme.matchAll(/^\s*--color-([a-z0-9-]+):/gm)].map((m) => m[1]);

test('показує кожен колір із теми', async ({ page }) => {
  await page.goto('/styleguide/');
  const swatches = page.getByTestId('color-token');
  await expect(swatches).toHaveCount(colorTokens.length);
  for (const name of colorTokens) {
    await expect(swatches.getByText(name, { exact: true })).toBeVisible();
  }
});

// Усі токени теми (ADR 0003): кожен має позначку data-token на /styleguide.
// `initial` скидає стандартні значення Tailwind, `--text-sm--line-height` показано разом із розміром.
const allTokens = [...theme.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)]
  .filter(([, name, value]) => value.trim() !== 'initial' && !name.slice(2).includes('--'))
  .map(([, name]) => name);

test('показує кожен токен із теми', async ({ page }) => {
  await page.goto('/styleguide/');
  const shown = await page.locator('[data-token]').evaluateAll((els) => els.map((el) => el.getAttribute('data-token')));
  const missing = allTokens.filter((name) => !shown.includes(name));
  expect(missing, 'токени без показу на /styleguide').toEqual([]);
});

// Кожен компонент бібліотеки має живий зразок на /styleguide: корінь компонента позначено
// data-component="Назва", і тест шукає цю позначку в зібраній сторінці — підпис usage="<Tag…>" не рахується.
// Частини макета (шапка, підвал, банер) показані на самій сторінці, тож їх шукаємо поза <main>.
const layoutParts = ['NavMenu', 'PrototypeBanner', 'SiteHeader', 'SiteFooter'];
const components = readdirSync('src/components')
  .filter((f) => f.endsWith('.astro'))
  .map((f) => f.replace('.astro', ''));

test('має зразок кожного компонента', async ({ page }) => {
  await page.goto('/styleguide/');
  const missing: string[] = [];
  for (const name of components) {
    const scope = layoutParts.includes(name) ? page.locator('body') : page.locator('main');
    if ((await scope.locator(`[data-component="${name}"]`).count()) === 0) missing.push(name);
  }
  expect(missing, 'компоненти без зразка на /styleguide (чи без data-component на корені)').toEqual([]);
});
