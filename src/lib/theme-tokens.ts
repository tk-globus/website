// Токени теми, прочитані з src/styles/theme.css, — для сторінки /styleguide.
// Так /styleguide завжди показує актуальні значення, а не копію, що може застаріти.
import themeCss from '../styles/theme.css?raw';

export interface Token {
  /** Змінна повністю: `--color-brand`. */
  variable: string;
  /** Імʼя без групи: для `--color-brand` — `brand`. */
  name: string;
  value: string;
  /** Коментар у рядку токена (що це і де вживається). */
  note?: string;
}

// Групи з дефісом у назві — перед загальним `[a-z]+`, щоб `--font-weight-bold` не потрапив у шрифти.
const TOKEN_LINE =
  /^\s*--(font-weight|border-width|stroke-width|text-underline-offset|default-transition|[a-z]+)(?:-([a-z0-9-]+))?:\s*([^;]+);\s*(?:\/\*\s*(.*?)\s*\*\/)?/;

export function parseTokens(css: string): Record<string, Token[]> {
  const groups: Record<string, Token[]> = {};
  for (const line of css.split('\n')) {
    const match = line.match(TOKEN_LINE);
    if (!match) continue;
    const [, group, name = '', value, note] = match;
    // `--color-*: initial` скидає стандартні значення; `--text-sm--line-height` — висота рядка.
    if (value.trim() === 'initial' || name.includes('--')) continue;
    const variable = `--${group}${name ? `-${name}` : ''}`;
    (groups[group] ??= []).push({ variable, name, value: value.trim(), note });
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
