#!/usr/bin/env node
// Перевірка внутрішніх посилань у зібраному сайті (dist/): кожне href/src усередині сайту
// має вести на існуючий файл. Зовнішні посилання не перевіряються.
// Посилання на сторінку (не файл) — зі слешем у кінці (`/news/`, `/news/?page`): адреса без слеша
// на Cloudflare дає зайвий редирект 308 (знахідка перевірки 05a). Такі посилання — теж помилка.
//
// Використання: node scripts/check-links.mjs [тека збірки]   (за замовчуванням — dist)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');

if (!existsSync(root)) {
  console.error(`Немає теки ${root}. Спершу зберіть сайт: npm run build`);
  process.exit(1);
}

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* htmlFiles(path);
    else if (path.endsWith('.html')) yield path;
  }
}

function extractUrls(html) {
  const urls = [];
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) urls.push(m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) {
    for (const part of m[1].split(',')) urls.push(part.trim().split(/\s+/)[0]);
  }
  return urls;
}

function isInternal(url) {
  return url !== '' && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url);
}

/** Посилання на сторінку без слеша в кінці (`/join`, `../news?x`): шлях без розширення файлу. */
function missingSlash(url) {
  const path = url.split(/[?#]/)[0];
  if (!path || path.endsWith('/')) return false;
  return !/\.[a-z0-9]+$/i.test(path.split('/').pop());
}

function targetExists(fromFile, url) {
  const path = decodeURIComponent(url.split(/[?#]/)[0]);
  const base = path.startsWith('/') ? join(root, path) : resolve(dirname(fromFile), path);
  const candidates = [base, join(base, 'index.html'), `${base}.html`];
  return candidates.some((c) => existsSync(c) && statSync(c).isFile());
}

const broken = [];
const noSlash = [];
let checked = 0;
for (const file of htmlFiles(root)) {
  const html = readFileSync(file, 'utf8');
  for (const url of extractUrls(html)) {
    if (!isInternal(url)) continue;
    checked++;
    if (!targetExists(file, url)) broken.push(`${relative(root, file)} → ${url}`);
    else if (missingSlash(url)) noSlash.push(`${relative(root, file)} → ${url}`);
  }
}

if (broken.length) {
  console.error(`Биті внутрішні посилання (${broken.length}):`);
  for (const b of broken) console.error(`  ${b}`);
}
if (noSlash.length) {
  console.error(`Посилання на сторінку без слеша в кінці (${noSlash.length}) — на Cloudflare це редирект 308, пишіть /адреса/:`);
  for (const b of noSlash) console.error(`  ${b}`);
}
if (broken.length || noSlash.length) process.exit(1);
console.log(`Внутрішні посилання: перевірено ${checked}, битих немає.`);
