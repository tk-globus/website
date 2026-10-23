// Заголовки на кожній сторінці йдуть по порядку: один h1, далі без пропусків рівня (h2 → h4 — помилка).
// Так сторінку зрозуміло читає скрінрідер і бачить пошуковик.
import { test, expect } from '@playwright/test';
import { routes } from './routes';

for (const route of [...routes, '/takoyi-storinky-nemaye']) {
  test(`${route}: заголовки по порядку`, async ({ page }) => {
    await page.goto(route);
    const headings = await page
      .locator('h1, h2, h3, h4, h5, h6')
      .evaluateAll((els) => els.map((el) => ({ level: Number(el.tagName[1]), text: el.textContent?.trim() ?? '' })));

    expect(headings.filter((h) => h.level === 1), 'рівно один h1').toHaveLength(1);
    expect(headings[0]?.level, 'перший заголовок — h1').toBe(1);

    const skips: string[] = [];
    headings.forEach((h, i) => {
      if (i > 0 && h.level > headings[i - 1].level + 1) {
        skips.push(`h${headings[i - 1].level} «${headings[i - 1].text}» → h${h.level} «${h.text}»`);
      }
    });
    expect(skips, 'пропущені рівні заголовків').toEqual([]);
  });
}
