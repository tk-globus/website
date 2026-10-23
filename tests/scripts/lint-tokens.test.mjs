// Перевіряє сам лінт токенів: він має ловити зашиті значення і пропускати токени.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintFile } from '../../scripts/lint-tokens.mjs';

const found = (line) => lintFile('x.astro', line).map((p) => p.found);

test('ловить зашиті кольори', () => {
  assert.deepEqual(found('<div class="x" data-c="#16666c">'), ['#16666c']);
  assert.deepEqual(found('color: rgb(0, 0, 0);'), ['rgb(']);
});

test('ловить довільні значення, стандартну палітру, інлайн-стилі й <style>', () => {
  assert.deepEqual(found('<p class="text-[#fff]">'), ['#fff', 'text-[#fff]']);
  assert.deepEqual(found('<p class="mt-[13px]">'), ['mt-[13px]']);
  assert.deepEqual(found('<p class="bg-red-500 text-white">'), ['bg-red-500']);
  assert.deepEqual(found('<p style="margin: 3px">'), [' style=']);
  assert.deepEqual(found('<style>'), ['<style>']);
});

test('пропускає токени, якорі й HTML-сутності', () => {
  assert.deepEqual(found('<a class="bg-brand text-on-brand p-4 max-w-page" href="#main">&#8212;</a>'), []);
  assert.deepEqual(found('<p class="text-brand-blue border-line">'), []);
});
