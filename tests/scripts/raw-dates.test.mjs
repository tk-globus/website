// Обгортка withRawDates передає схемі дату так, як її написано у файлі (YAML сам «виправив» би 2026-13-45).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withRawDates } from '../../src/lib/raw-dates.ts';
import { isoDate } from '../../src/lib/schemas/fields.ts';

async function parsedDate(t, frontmatterDate, yamlValue) {
  const dir = mkdtempSync(join(tmpdir(), 'raw-dates-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filePath = join(dir, 'x.md');
  writeFileSync(filePath, `---\ntitle: Т\ndate: ${frontmatterDate}\n---\n\ndate: не це\n`);

  let seen;
  const inner = {
    name: 'fake',
    load: (ctx) => ctx.parseData({ id: 'x', data: { title: 'Т', date: yamlValue }, filePath }),
  };
  await withRawDates(inner, ['date']).load({ parseData: async ({ data }) => (seen = data) });
  return seen.date;
}

test('схема бачить сиру дату з файлу, а не «виправлену» YAML-ом', async (t) => {
  assert.equal(await parsedDate(t, '2026-13-45', new Date('2027-02-14')), '2026-13-45');
  assert.equal(await parsedDate(t, '"2026-10-08"', '2026-10-08'), '2026-10-08');
  assert.equal(await parsedDate(t, '2026-10-08', new Date('2026-10-08')), '2026-10-08');
});

test('isoDate: лише справжня дата у форматі РРРР-ММ-ДД', () => {
  const schema = isoDate();
  assert.deepEqual(schema.parse('2026-10-08'), new Date('2026-10-08T00:00:00Z'));
  for (const bad of ['2026-13-45', '2026-02-30', '08/10/2026', 'вчора', '']) {
    assert.ok(!schema.safeParse(bad).success, bad);
  }
});
