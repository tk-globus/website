// Токени теми, прочитані з src/styles/theme.css, — для сторінки /styleguide.
// Так /styleguide завжди показує актуальні значення, а не копію, що може застаріти.
import themeCss from '../styles/theme.css?raw';

export interface Token {
  /** Імʼя без групи: для `--color-brand` — `brand`. */
  name: string;
  value: string;
  /** Коментар у рядку токена (що це і де вживається). */
  note?: string;
}

const TOKEN_LINE = /^\s*--([a-z]+)(?:-([a-z0-9-]+))?:\s*([^;]+);\s*(?:\/\*\s*(.*?)\s*\*\/)?/;

export function parseTokens(css: string): Record<string, Token[]> {
  const groups: Record<string, Token[]> = {};
  for (const line of css.split('\n')) {
    const match = line.match(TOKEN_LINE);
    if (!match) continue;
    const [, group, name = '', value, note] = match;
    // `--color-*: initial` скидає стандартні значення; `--text-sm--line-height` — висота рядка.
    if (value.trim() === 'initial' || name.includes('--')) continue;
    (groups[group] ??= []).push({ name, value: value.trim(), note });
  }
  return groups;
}

export const tokens = parseTokens(themeCss);

/** Утиліти Tailwind мають бути записані повністю, щоб Tailwind їх згенерував, тому — мапа. */
export function utilityFor(map: Record<string, string>, group: string, name: string): string {
  const cls = map[name];
  if (!cls) {
    throw new Error(
      `/styleguide: для токена --${group}-${name} немає прикладу. Додай клас у мапу в src/components/styleguide/.`,
    );
  }
  return cls;
}
