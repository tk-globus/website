// /styleguide показує всі кольори теми і зразки всіх компонентів бібліотеки.
import { readFileSync, readdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const theme = readFileSync('src/styles/theme.css', 'utf8');
const colorTokens = [...theme.matchAll(/^\s*--color-([a-z0-9-]+):/gm)].map((m) => m[1]);

test('показує кожен колір із теми', async ({ page }) => {
  await page.goto('/styleguide');
  const swatches = page.getByTestId('color-token');
  await expect(swatches).toHaveCount(colorTokens.length);
  for (const name of colorTokens) {
    await expect(swatches.getByText(name, { exact: true })).toBeVisible();
  }
});

// Кожен компонент бібліотеки має зразок на /styleguide. Службові — показані іншими способами.
const shownElsewhere = ['Container', 'Icon', 'NavMenu', 'PrototypeBanner', 'SiteHeader', 'SiteFooter'];
const components = readdirSync('src/components')
  .filter((f) => f.endsWith('.astro'))
  .map((f) => f.replace('.astro', ''))
  .filter((name) => !shownElsewhere.includes(name));

test('має зразок кожного компонента', () => {
  const page = readFileSync('src/pages/styleguide.astro', 'utf8');
  const missing = components.filter((name) => !page.includes(`<${name}`));
  expect(missing, 'компоненти без зразка на /styleguide').toEqual([]);
});
