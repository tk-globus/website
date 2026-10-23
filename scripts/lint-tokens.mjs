#!/usr/bin/env node
// Лінт «тільки токени» (ADR 0003): дизайн-значення живуть лише в src/styles/.
// Компоненти, макети й сторінки беруть кольори, шрифти й відступи з токенів теми.
// Стандартні значення Tailwind, що оминають тему, вимкнено в theme.css (`initial`); тут ловимо те,
// що вимкнути не можна: зашиті кольори й числа (прозорість, висота рядка, товщина ліній, тривалість).
//
// Використання: node scripts/lint-tokens.mjs [тека…]   (за замовчуванням — src)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXTENSIONS = ['.astro', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.md', '.mdx', '.css'];
// Тут дизайн-значення дозволені: це і є тема. Ассети (логотип) — готові файли.
const ALLOWED_DIRS = [`src${sep}styles`, `src${sep}assets`];

const TAILWIND_PALETTE =
  'slate|gray|zinc|neutral|stone|taupe|mauve|mist|olive|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black';

// Утиліти кольору: після «/» Tailwind приймає будь-яке число як прозорість (border-line/40).
const COLOR_UTILITIES =
  'bg|text|border(?:-[xytrbse])?|ring|ring-offset|inset-ring|outline|fill|stroke|from|via|to|decoration|accent|caret|divide|shadow|inset-shadow|drop-shadow|text-shadow|placeholder';

// Не частина іншого слова чи шляху: `hover:border-2` — так, `w3.org/2000` — ні.
const START = '(?<![\\w/-])';

const RULES = [
  {
    re: /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/,
    message: 'зашитий колір (hex) — використай токен кольору з теми',
  },
  {
    re: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(/,
    message: 'зашитий колір (функція кольору) — використай токен кольору з теми',
  },
  {
    re: /[\w-]+-\[[^\]]+\]/,
    message: 'довільне значення Tailwind ([…]) — додай токен у тему й використай його',
  },
  {
    re: new RegExp(`\\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|accent|caret|divide|shadow|placeholder)-(?:${TAILWIND_PALETTE})(?:-\\d{2,3})?\\b`),
    message: 'стандартний колір Tailwind — у темі його немає, використай токен (brand, ink, muted…)',
  },
  {
    re: new RegExp(`${START}(?:${COLOR_UTILITIES})-[a-z][\\w-]*\\/\\d+`),
    message: 'число після «/» (прозорість чи висота рядка) — використай токен: border-line/soft, text-on-brand/muted',
  },
  {
    re: new RegExp(`${START}(?:backdrop-)?opacity-(?!(?:0|100)\\b)\\d+`),
    message: 'прозорість числом — використай токен прозорості (opacity-disabled…) або додай новий у тему',
  },
  {
    re: new RegExp(`${START}leading-(?:\\d+|none\\b)`),
    message: 'висота рядка числом — використай токен (leading-snug) або додай новий у тему',
  },
  {
    re: new RegExp(
      `${START}(?:border(?:-[xytrbse])?|divide-[xy]|outline|outline-offset|ring|ring-offset|inset-ring|decoration|underline-offset)-(?!0\\b)\\d+`,
    ),
    message: 'товщина чи відступ лінії числом — використай токен (border-thick, underline-offset-link) або додай новий у тему',
  },
  {
    re: new RegExp(`${START}(?:duration|delay)-\\d+`),
    message: 'тривалість числом — переходи беруть тривалість із теми (--default-transition-duration)',
  },
  {
    re: /\sstyle=/,
    message: 'інлайн-стиль — стилі тільки через утиліти токенів',
  },
  {
    re: /<style[\s>]/,
    message: 'блок <style> — стилі тільки через утиліти токенів; нові значення — у тему',
  },
  {
    re: /\bfont-family\s*:/,
    message: 'зашитий шрифт — використай токен шрифту',
  },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (EXTENSIONS.some((ext) => path.endsWith(ext))) {
      yield path;
    }
  }
}

export function lintFile(path, text) {
  const problems = [];
  text.split('\n').forEach((line, i) => {
    for (const rule of RULES) {
      const match = line.match(rule.re);
      if (match) problems.push({ path, line: i + 1, found: match[0], message: rule.message });
    }
  });
  return problems;
}

export function lintDirs(dirs) {
  const problems = [];
  for (const dir of dirs) {
    for (const path of walk(dir)) {
      const rel = relative(process.cwd(), path);
      if (ALLOWED_DIRS.some((allowed) => rel.startsWith(allowed + sep))) continue;
      problems.push(...lintFile(rel, readFileSync(path, 'utf8')));
    }
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dirs = process.argv.length > 2 ? process.argv.slice(2) : ['src'];
  const problems = lintDirs(dirs);
  for (const p of problems) console.error(`${p.path}:${p.line}  «${p.found}» — ${p.message}`);
  if (problems.length) {
    console.error(`\nЛінт токенів: ${problems.length} порушень. Значення — у src/styles/theme.css.`);
    process.exit(1);
  }
  console.log('Лінт токенів: порушень немає.');
}
