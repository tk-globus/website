// Ядро імпортера: спільне для всіх типів контенту. Бере адреси (вибірка чи все), для кожної —
// сторінка (з кешу чи мережі) → парсер типу → фото в репо → Markdown-файл із frontmatter.
//
// Повторний запуск не створює дублікатів: файл шукається за legacy URL у frontmatter уже імпортованих
// записів, тож той самий оригінал завжди пише в той самий файл (навіть якщо заголовок змінився).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, sep } from 'node:path';
import YAML from 'yaml';
import { htmlToMarkdown, isOldSiteFile, nodeId } from './html.mjs';
import { slugify } from './slug.mjs';

// Формати, які вміє оптимізувати збірка Astro. Інші фото лишаються посиланням на старий сайт.
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

export function readFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? YAML.parse(m[1]) : null;
}

/** Уже імпортовані записи: legacy URL → slug, і всі зайняті slug. */
export function indexExisting(contentDir) {
  const byLegacy = new Map();
  const slugs = new Set();
  const warnings = [];
  if (existsSync(contentDir)) {
    for (const file of readdirSync(contentDir).filter((f) => f.endsWith('.md')).sort()) {
      const slug = file.slice(0, -3);
      slugs.add(slug);
      const legacy = readFrontmatter(readFileSync(join(contentDir, file), 'utf8'))?.legacyUrl;
      if (!legacy) continue;
      if (byLegacy.has(legacy)) warnings.push(`${legacy} уже є у двох файлах: ${byLegacy.get(legacy)}.md і ${file}`);
      else byLegacy.set(legacy, slug);
    }
  }
  return { byLegacy, slugs, warnings };
}

/**
 * Slug запису: той самий для того самого legacy URL; новий — із заголовка, при збігу — з номером вузла.
 * Парсер може задати slug сам (`slug` — напр. сторінка «Про клуб» завжди about.md, бо це її адреса на сайті).
 */
export function chooseSlug({ legacyUrl, title, slug: fixed }, index) {
  if (fixed) {
    index.byLegacy.set(legacyUrl, fixed);
    index.slugs.add(fixed);
    return fixed;
  }
  const known = index.byLegacy.get(legacyUrl);
  if (known) return known;
  const nid = nodeId(legacyUrl);
  const base = slugify(title) || (nid ? `node-${nid}` : 'zapys');
  let slug = base;
  if (index.slugs.has(slug)) slug = nid ? `${base}-${nid}` : base;
  for (let n = 2; index.slugs.has(slug); n++) slug = `${base}-${n}`;
  index.byLegacy.set(legacyUrl, slug);
  index.slugs.add(slug);
  return slug;
}

/** Markdown-файл запису: frontmatter (YAML) + тіло. Порядок полів — як у схемі. */
export function renderEntry(frontmatter, markdown) {
  const clean = Object.fromEntries(Object.entries(frontmatter).filter(([, v]) => v !== undefined && v !== ''));
  return `---\n${YAML.stringify(clean, { lineWidth: 0 })}---\n\n${markdown}\n`;
}

function imageFileName(src, taken) {
  const raw = decodeURIComponent(basename(new URL(src).pathname));
  const ext = extname(raw).toLowerCase();
  const stem = raw.slice(0, raw.length - ext.length).toLowerCase().replace(/[^\w.-]+/g, '-') || 'foto';
  let name = `${stem}${ext}`;
  for (let n = 2; taken.has(name); n++) name = `${stem}-${n}${ext}`;
  taken.add(name);
  return name;
}

const toPosix = (p) => p.split(sep).join('/');

/**
 * Імпорт одного запису. Повертає { slug, file, status: created | updated | unchanged, warnings }.
 * @param {object} type тип контенту (scripts/import/types/)
 * @param {string} url адреса сторінки на старому сайті
 * @param {{ root: string, fetcher: object, index: object }} ctx
 */
export async function importItem(type, url, { root, fetcher, index }) {
  const parsed = type.parse(await fetcher.text(url), url);
  // Парсер може повернути власні попередження і значення, яких немає в переліках схеми (звіти).
  const unrecognized = parsed.unrecognized ?? [];
  const warnings = [
    ...unrecognized.map(({ field, value }) => `не розпізнано ${field} «${value}» — пропущено`),
    ...(parsed.warnings ?? []),
  ];
  const slug = chooseSlug(parsed, index);
  const mdPath = join(root, type.contentDir, `${slug}.md`);
  const assetDir = join(root, type.assetsDir, slug);
  const taken = new Set();
  const localBySrc = new Map();

  // Завантажує фото старого сайту в src/assets/<тип>/<slug>/ і повертає шлях відносно Markdown-файлу.
  // Не вдалося — null (і попередження): запис імпортується без цього фото.
  async function localImage(src) {
    if (!localBySrc.has(src)) localBySrc.set(src, await downloadImage(src));
    return localBySrc.get(src);
  }

  async function downloadImage(src) {
    const ext = extname(new URL(src).pathname).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      warnings.push(`${src}: формат ${ext || '?'} збірка не оптимізує — лишаю посилання на старий сайт`);
      return null;
    }
    let bytes;
    try {
      bytes = await fetcher.binary(src);
    } catch (e) {
      warnings.push(`фото не завантажилось: ${e.message}`);
      return null;
    }
    const file = join(assetDir, imageFileName(src, taken));
    if (!existsSync(file) || !readFileSync(file).equals(bytes)) {
      mkdirSync(assetDir, { recursive: true });
      writeFileSync(file, bytes);
    }
    const rel = toPosix(relative(dirname(mdPath), file));
    return rel.startsWith('.') ? rel : `./${rel}`;
  }

  const cover = parsed.cover ? await localImage(parsed.cover.src) : null;
  if (!parsed.cover && !type.noCover) warnings.push('без обкладинки (у тексті немає фото)');

  // Завантажуємо лише фото, що стануть Markdown-картинками. Фото всередині сирого HTML (таблиці з
  // обʼєднаними клітинками) лишаються посиланням на старий сайт: збірка відносних шляхів у HTML не бачить.
  // Пробний прогін: кожне фото отримує мітку; мітки, що дійшли до Markdown, — це фото поза сирим HTML.
  const seen = [];
  const draft = htmlToMarkdown(parsed.bodyHtml, { resolveImage: (src) => `tkg-image-${seen.push(src)}-` });
  const imageMap = new Map();
  for (const [i, src] of seen.entries()) {
    if (!draft.includes(`tkg-image-${i + 1}-`) || !isOldSiteFile(src) || imageMap.has(src)) continue;
    imageMap.set(src, (await localImage(src)) ?? src);
  }
  const markdown = htmlToMarkdown(parsed.bodyHtml, { resolveImage: (src) => imageMap.get(src) ?? src });

  const text = renderEntry(
    {
      ...parsed.data,
      cover: cover ?? undefined,
      coverAlt: cover ? parsed.cover.alt : undefined,
      legacyUrl: parsed.legacyUrl,
    },
    markdown,
  );

  const before = existsSync(mdPath) ? readFileSync(mdPath, 'utf8') : null;
  const status = before === null ? 'created' : before === text ? 'unchanged' : 'updated';
  if (status !== 'unchanged') {
    mkdirSync(dirname(mdPath), { recursive: true });
    writeFileSync(mdPath, text);
  }
  return { slug, file: toPosix(relative(root, mdPath)), status, warnings, unrecognized };
}

/**
 * Звіт про ненормалізовані значення: те саме значення з кількох записів — одним рядком.
 * @returns {{ field: string, value: string, slugs: string[] }[]} за полем, далі за значенням
 */
export function summarizeUnrecognized(results) {
  const groups = new Map();
  for (const { slug, unrecognized = [] } of results) {
    for (const { field, value } of unrecognized) {
      const key = `${field}\u0000${value}`;
      if (!groups.has(key)) groups.set(key, { field, value, slugs: [] });
      groups.get(key).slugs.push(slug);
    }
  }
  return [...groups.values()].sort((a, b) => a.field.localeCompare(b.field, 'uk') || a.value.localeCompare(b.value, 'uk'));
}

/** Адреси для імпорту: вибірка з аудиту або всі записи зі сторінок-списків старого сайту. */
export async function collectUrls(type, { scope, fetcher, log = () => {} }) {
  if (scope === 'sample') return type.sampleUrls();
  if (scope !== 'all') throw new Error(`невідомий обсяг «${scope}»: sample або all`);
  // Тип без сторінок-списків на старому сайті (статичні сторінки): «усе» — та сама вибірка.
  if (!type.listSources) return type.sampleUrls();
  const urls = [];
  for (const source of type.listSources) {
    for (let page = source, seen = new Set(); page && !seen.has(page); ) {
      seen.add(page);
      log(`Список: ${page}`);
      const { urls: found, next } = type.parseList(await fetcher.text(page));
      for (const u of found) if (!urls.includes(u)) urls.push(u);
      page = next;
    }
  }
  return urls;
}

/**
 * Повний прогін для одного типу. Помилка на одному записі не зупиняє інші — вона йде у звіт.
 * @returns {Promise<{ results: object[], failed: { url: string, error: string }[], warnings: string[] }>}
 */
export async function runImport(type, { root, fetcher, scope = 'sample', limit, log = () => {} }) {
  let urls = await collectUrls(type, { scope, fetcher, log });
  if (limit) urls = urls.slice(0, limit);
  const index = indexExisting(join(root, type.contentDir));
  const results = [];
  const failed = [];
  for (const url of urls) {
    try {
      const result = await importItem(type, url, { root, fetcher, index });
      results.push({ url, ...result });
      log(`${{ created: '+ нове', updated: '~ оновлено', unchanged: '= без змін' }[result.status]}  ${result.file}`);
      for (const w of result.warnings) log(`    ! ${w}`);
    } catch (e) {
      failed.push({ url, error: e.message });
      log(`✗ ${url}: ${e.message}`);
    }
  }
  return { results, failed, warnings: index.warnings };
}
