// Анонси звітів у новинах ведуть у бібліотеку (/library/<slug>), якщо звіт уже імпортовано,
// інакше — на старий сайт. Імпортер — на збережених сторінках старого сайту, без мережі;
// останній тест перевіряє справжній контент репозиторію: жодна новина не веде на старий сайт за звітом,
// який уже є в бібліотеці (імпортували звіти після новин — перезапустіть `npm run import -- news`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runImport } from '../../scripts/import/core.mjs';
import { REPORTS_DIR, libraryLinks, oldSiteKey, rewriteLinks } from '../../scripts/import/links.mjs';
import news from '../../scripts/import/types/news.mjs';

const ANNOUNCEMENT = 'https://www.tkg.org.ua/node/37934';
const page = readFileSync(new URL('../fixtures/old-site/news-report-announcement--37934.html', import.meta.url), 'utf8');
const fetcher = {
  text: async (url) => {
    if (url !== ANNOUNCEMENT) throw new Error(`немає фікстури для ${url}`);
    return page;
  },
  binary: async () => Buffer.from([0xff, 0xd8, 0xff]),
};
const type = { ...news, sampleUrls: () => [ANNOUNCEMENT] };

function tempRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'news-links-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function addReport(root, slug, frontmatter) {
  mkdirSync(join(root, REPORTS_DIR), { recursive: true });
  writeFileSync(join(root, REPORTS_DIR, `${slug}.md`), `---\n${frontmatter}\n---\n\nТекст.\n`);
}

const body = (root) =>
  readFileSync(join(root, news.contentDir, 'pishokhidnyi-pokhid-2-k-s-karpatamy.md'), 'utf8').replace(/^---[\s\S]*?\n---\n/, '');

test('анонс звіту: звіт уже в бібліотеці — посилання на /library/<slug>, без підказки з розміром файлу', async (t) => {
  const root = tempRoot(t);
  addReport(root, 'zvit-2-k-s-karpaty', 'title: Звіт\nlegacyUrl: https://www.tkg.org.ua/node/37933');
  const { failed } = await runImport(type, { root, fetcher });
  assert.deepEqual(failed, []);
  assert.match(body(root), /\[пішохідний похід 2 к\.с\. Українськими Карпатами\]\(\/library\/zvit-2-k-s-karpaty\/\)/);
  assert.doesNotMatch(body(root), /node\/37933|23 MB/);
});

test('анонс звіту: звіту в бібліотеці немає — посилання лишається на старому сайті', async (t) => {
  const root = tempRoot(t);
  addReport(root, 'inshyi-zvit', 'title: Інший\nlegacyUrl: https://www.tkg.org.ua/node/1');
  await runImport(type, { root, fetcher });
  assert.match(body(root), /\]\(https:\/\/www\.tkg\.org\.ua\/node\/37933 "23 MB"\)/);
});

test('звіт знаходиться і за адресою вузла, і за адресою файлу; варіанти адреси старого сайту рівноцінні', (t) => {
  const root = tempRoot(t);
  addReport(
    root,
    'zvit',
    'title: Звіт\nfiles:\n  - name: a.pdf\n    url: https://www.tkg.org.ua/files/a.pdf\nlegacyUrl: https://www.tkg.org.ua/node/5',
  );
  const links = libraryLinks(root);
  assert.equal(links.get(oldSiteKey('http://tkg.org.ua/node/5/#top')), '/library/zvit/');
  assert.equal(links.get(oldSiteKey('https://www.tkg.org.ua/files/a.pdf')), '/library/zvit/');
  assert.equal(oldSiteKey('https://example.com/node/5'), null);
  assert.equal(
    rewriteLinks('<p><a href="https://www.tkg.org.ua/files/a.pdf" title="4 MB">звіт</a> і <a href="https://youtu.be/x">відео</a></p>', links),
    '<p><a href="/library/zvit/">звіт</a> і <a href="https://youtu.be/x">відео</a></p>',
  );
  assert.equal(libraryLinks(join(root, 'nema')).size, 0, 'немає теки звітів — немає й посилань');
});

test('контент сайту: новини не ведуть на старий сайт за звітами, що вже є в бібліотеці', () => {
  const root = resolve('.');
  const links = libraryLinks(root);
  const dir = join(root, news.contentDir);
  const stale = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const text = readFileSync(join(dir, file), 'utf8').replace(/^---[\s\S]*?\n---\n/, '');
    for (const [, url] of text.matchAll(/\]\((\S+?)(?:\s+"[^"]*")?\)/g)) {
      const target = links.get(oldSiteKey(url));
      if (target) stale.push(`${file}: ${url} → ${target}`);
    }
  }
  assert.deepEqual(stale, [], 'перезапустіть імпорт новин: npm run import -- news');
});
