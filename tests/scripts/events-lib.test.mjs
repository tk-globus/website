// Логіка подій (src/lib/events.ts) з фіксованою датою «зараз»: майбутня чи минула (за київським часом,
// зокрема ніч після переходу на зимовий час 25→26.10.2026) і тижні календаря з понеділка.
// src/lib/events.ts — модуль сайту: `astro:content` тут підміняємо заглушкою, а імпорти без розширення
// (`./dates`) ведемо на `.ts` — так його читає Node без збірки Astro.
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'astro:content') {
      return { url: 'data:text/javascript,export const getCollection = async () => [];', shortCircuit: true };
    }
    if (specifier.startsWith('.') && context.parentURL?.includes('/src/lib/') && !/\.\w+$/.test(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});

const { isUpcoming, splitEvents, todayInKyiv, calendarMonths } = await import('../../src/lib/events.ts');

const entry = (id, start, end) => ({ id, data: { title: id, start, end, legacyUrl: `https://www.tkg.org.ua/node/${id.length}` } });

const AUTUMN = entry('osinnii-lyst', '2026-10-25T08:00');
const DENYSHI = entry('denyshi', '2023-10-28T07:00', '2023-10-29T19:00');

test('сьогодні за Києвом: межа півночі влітку (UTC+3) і після переходу на зимовий час (UTC+2)', () => {
  // 24.10.2026 — ще літній час: північ за Києвом — 21:00 UTC.
  assert.equal(todayInKyiv(new Date('2026-10-24T20:59:59Z')), '2026-10-24');
  assert.equal(todayInKyiv(new Date('2026-10-24T21:00:00Z')), '2026-10-25');
  // У ніч на 25.10.2026 годинники переводять на зимовий час: північ 25→26 — це вже 22:00 UTC.
  assert.equal(todayInKyiv(new Date('2026-10-25T21:30:00Z')), '2026-10-25');
  assert.equal(todayInKyiv(new Date('2026-10-25T21:59:59Z')), '2026-10-25');
  assert.equal(todayInKyiv(new Date('2026-10-25T22:00:00Z')), '2026-10-26');
});

test('подія майбутня до кінця свого дня, з наступного дня — минула', () => {
  assert.equal(isUpcoming(AUTUMN, '2026-10-24'), true);
  assert.equal(isUpcoming(AUTUMN, '2026-10-25'), true, 'у день події (уже після початку о 08:00) — ще майбутня');
  assert.equal(isUpcoming(AUTUMN, '2026-10-26'), false);
});

test('«Осінній лист 2026» (25.10, ніч переходу на зимовий час): майбутня до 23:59 за Києвом', () => {
  assert.equal(isUpcoming(AUTUMN, todayInKyiv(new Date('2026-10-25T20:00:00Z'))), true); // 22:00 за Києвом
  assert.equal(isUpcoming(AUTUMN, todayInKyiv(new Date('2026-10-25T21:30:00Z'))), true); // 23:30 за Києвом
  assert.equal(isUpcoming(AUTUMN, todayInKyiv(new Date('2026-10-25T22:00:00Z'))), false); // 00:00 26.10 за Києвом
});

test('багатоденна подія майбутня до кінця останнього дня', () => {
  assert.equal(isUpcoming(DENYSHI, '2023-10-28'), true);
  assert.equal(isUpcoming(DENYSHI, '2023-10-29'), true, 'другий (останній) день — ще майбутня');
  assert.equal(isUpcoming(DENYSHI, '2023-10-30'), false);
});

test('розподіл: майбутні — найближча першою, минулі — найсвіжіша першою', () => {
  const lecture = entry('lecture', '2026-10-15T19:00', '2026-10-15T21:00');
  const camp = entry('camp', '2026-11-07T07:00');
  const { upcoming, past } = splitEvents([DENYSHI, lecture, AUTUMN, camp], '2026-10-25');
  assert.deepEqual(upcoming.map((e) => e.id), ['osinnii-lyst', 'camp']);
  assert.deepEqual(past.map((e) => e.id), ['lecture', 'denyshi']);
});

test('календар: тижні з понеділка, 25.10.2026 — неділя (останній стовпчик «Нд»)', () => {
  const [october] = calendarMonths([{ title: 'Осінній лист', href: '/events/x', start: '2026-10-25T08:00' }], '2026-10-24');
  assert.equal(october.key, '2026-10');
  for (const week of october.weeks) {
    assert.equal(week.length, 7);
    assert.equal(new Date(`${week[0].date}T00:00:00Z`).getUTCDay(), 1, `тиждень ${week[0].date} починається з понеділка`);
  }
  assert.equal(october.weeks[0][0].date, '2026-09-28');
  const week = october.weeks.find((w) => w.some((d) => d.date === '2026-10-25'));
  assert.equal(week.findIndex((d) => d.date === '2026-10-25'), 6);
  assert.deepEqual(week[6].events.map((e) => e.title), ['Осінній лист']);
});
