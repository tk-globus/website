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

test('ловить стандартні кольори Tailwind 4, яких не було в Tailwind 3', () => {
  assert.deepEqual(found('<p class="bg-taupe-100 text-mist-700">'), ['bg-taupe-100']);
});

test('ловить числа в обхід теми: прозорість, висоту рядка, товщину ліній, тривалість', () => {
  assert.deepEqual(found('<p class="border-line/40">'), ['border-line/40']);
  assert.deepEqual(found('<p class="hover:bg-brand-soft/50">'), ['bg-brand-soft/50']);
  assert.deepEqual(found('<p class="text-sm/6">'), ['text-sm/6']);
  assert.deepEqual(found('<p class="opacity-60">'), ['opacity-60']);
  assert.deepEqual(found('<p class="leading-6">'), ['leading-6']);
  assert.deepEqual(found('<p class="leading-none">'), ['leading-none']);
  assert.deepEqual(found('<p class="border-2">'), ['border-2']);
  assert.deepEqual(found('<p class="md:border-t-4">'), ['border-t-4']);
  assert.deepEqual(found('<p class="ring-2">'), ['ring-2']);
  assert.deepEqual(found('<p class="underline-offset-4">'), ['underline-offset-4']);
  assert.deepEqual(found('<p class="duration-300">'), ['duration-300']);
});

test('ловить товщину ліній SVG, трансформації й фільтри числами', () => {
  assert.deepEqual(found('<svg class="stroke-2">'), ['stroke-2']);
  assert.deepEqual(found('<svg stroke-width="1.75">'), ['stroke-width=']);
  assert.deepEqual(found('<p class="hover:scale-105">'), ['scale-105']);
  assert.deepEqual(found('<p class="scale-x-50">'), ['scale-x-50']);
  assert.deepEqual(found('<p class="-rotate-45">'), ['-rotate-45']);
  assert.deepEqual(found('<p class="skew-y-3">'), ['skew-y-3']);
  assert.deepEqual(found('<img class="brightness-90">'), ['brightness-90']);
  assert.deepEqual(found('<img class="group-hover:contrast-125">'), ['contrast-125']);
  assert.deepEqual(found('<img class="grayscale-50">'), ['grayscale-50']);
  assert.deepEqual(found('<div class="backdrop-saturate-150">'), ['backdrop-saturate-150']);
  assert.deepEqual(found('<p class="hue-rotate-90">'), ['hue-rotate-90']);
});

test('пропускає іменовані утиліти, нульові й «без змін» трансформації та атрибути SVG', () => {
  assert.deepEqual(found('<svg class="stroke-icon stroke-brand stroke-0" stroke-linecap="round">'), []);
  assert.deepEqual(found('<p class="scale-100 hover:scale-100 rotate-0 brightness-100 grayscale">'), []);
  assert.deepEqual(found('<p class="translate-x-4 -translate-y-1/2">'), []);
});

test('ловить довільне значення після «/»: прозорість і висоту рядка', () => {
  assert.deepEqual(found('<p class="bg-brand/[0.3]">'), ['bg-brand/[0.3]']);
  assert.deepEqual(found('<p class="text-sm/[1.3]">'), ['text-sm/[1.3]']);
  assert.deepEqual(found('<p class="hover:border-line/[.4]">'), ['border-line/[.4]']);
  assert.deepEqual(found('<p class="border-line/soft w-1/2 aspect-3/2">'), []);
});

test('пропускає іменовані токени й нульові значення', () => {
  assert.deepEqual(found('<p class="border-line/soft text-on-brand/muted from-ink/scrim-strong">'), []);
  assert.deepEqual(found('<p class="opacity-disabled opacity-0 opacity-100 border-thick border-0 border">'), []);
  assert.deepEqual(found('<p class="leading-snug underline-offset-link font-bold transition-colors">'), []);
});

test('не плутає шляхи й розміри з утилітами', () => {
  assert.deepEqual(found('<svg xmlns="http://www.w3.org/2000/svg">'), []);
  assert.deepEqual(found('<p class="w-1/2 aspect-3/2 grid-cols-3 z-30 size-16">'), []);
});

test('пропускає токени, якорі й HTML-сутності', () => {
  assert.deepEqual(found('<a class="bg-brand text-on-brand p-4 max-w-page" href="#main">&#8212;</a>'), []);
  assert.deepEqual(found('<p class="text-brand-blue border-line">'), []);
});
