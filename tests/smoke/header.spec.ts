// Шапка на компʼютері: меню в рядок з усіма пунктами і кнопкою «Долучитися», кнопки «Меню» немає.
import { test, expect } from '@playwright/test';

test('на компʼютері меню розгорнуте', async ({ page }) => {
  await page.goto('/');
  const header = page.getByRole('banner');
  const nav = header.getByRole('navigation', { name: 'Головне меню' });
  for (const label of ['Про клуб', 'Новини', 'Події', 'Бібліотека', 'МКК', 'Табір']) {
    await expect(nav.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(header.getByText('Долучитися', { exact: true }).filter({ visible: true })).toHaveCount(1);
  await expect(header.getByRole('button', { name: 'Меню' })).toBeHidden();
});
