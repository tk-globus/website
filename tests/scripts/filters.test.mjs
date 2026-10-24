// Логіка фільтрів бібліотеки (src/lib/filters.ts) і множина лічильника (src/lib/plural.ts):
// модулі без залежностей, Node читає їх напряму (зі зняттям типів).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesFilters, searchWithSelection, selectionFromSearch } from '../../src/lib/filters.ts';
import { pluralCount } from '../../src/lib/plural.ts';

const fields = [
  { name: 'region', label: 'Район', anyLabel: 'Усі', options: [{ value: 'Кавказ', label: 'Кавказ' }, { value: 'Карпати', label: 'Карпати' }] },
  { name: 'grade', label: 'К.с.', anyLabel: 'Будь-яка', options: [{ value: 'н/к', label: 'н/к' }, { value: '3', label: '3 к.с.' }] },
];

test('запис підходить, лише якщо має кожне вибране значення', () => {
  const report = { region: ['Памір', 'Тянь-Шань'], kind: ['альпінізм'], grade: [], year: ['2009'] };
  assert.equal(matchesFilters(report, {}), true);
  assert.equal(matchesFilters(report, { region: 'Тянь-Шань' }), true, 'один із кількох районів');
  assert.equal(matchesFilters(report, { region: 'Тянь-Шань', year: '2009' }), true);
  assert.equal(matchesFilters(report, { region: 'Тянь-Шань', year: '2010' }), false);
  assert.equal(matchesFilters(report, { grade: '3' }), false, 'звіт без к.с. не підходить під вибрану к.с.');
  assert.equal(matchesFilters(report, { season: 'зима' }), false, 'поле, якого в записі немає');
});

test('вибір з адреси: лише поля панелі й значення з їхніх списків', () => {
  assert.deepEqual(selectionFromSearch('?region=%D0%9A%D0%B0%D0%B2%D0%BA%D0%B0%D0%B7&grade=3', fields), { region: 'Кавказ', grade: '3' });
  assert.deepEqual(selectionFromSearch('?grade=%D0%BD%2F%D0%BA', fields), { grade: 'н/к' });
  assert.deepEqual(selectionFromSearch('?region=Марс&grade=9&utm=x', fields), {});
  assert.deepEqual(selectionFromSearch('', fields), {});
});

test('адреса з вибором: поля переписуються, чужі параметри лишаються, порожній вибір — без «?»', () => {
  const search = searchWithSelection('?utm=x&region=Карпати', fields, { grade: '3' });
  assert.deepEqual(Object.fromEntries(new URLSearchParams(search)), { utm: 'x', grade: '3' });
  assert.equal(searchWithSelection('?region=Карпати&grade=3', fields, {}), '');
  const roundTrip = searchWithSelection('', fields, { region: 'Кавказ', grade: 'н/к' });
  assert.deepEqual(selectionFromSearch(roundTrip, fields), { region: 'Кавказ', grade: 'н/к' });
});

test('множина: 1 звіт, 3 звіти, 5 звітів, 11–14 звітів, 21 звіт, 44 звіти', () => {
  const forms = ['звіт', 'звіти', 'звітів'];
  const cases = { 0: 'звітів', 1: 'звіт', 3: 'звіти', 5: 'звітів', 11: 'звітів', 12: 'звітів', 14: 'звітів', 21: 'звіт', 44: 'звіти', 111: 'звітів', 122: 'звіти' };
  for (const [n, word] of Object.entries(cases)) assert.equal(pluralCount(Number(n), forms), `${n} ${word}`);
});
