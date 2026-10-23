// YAML у frontmatter сам перетворює `date: 2026-13-45` на «найближчу» існуючу дату (14.02.2027) — тихо,
// і схема вже не бачить помилки. Ця обгортка над завантажувачем колекції передає в схему поля дат рядком,
// точно як їх написано у файлі, — тоді схема (isoDate з src/lib/schemas/fields.ts) ловить неіснуючу дату
// і збірка падає з поясненням.
import { readFileSync } from 'node:fs';
import type { Loader, LoaderContext } from 'astro/loaders';

export function withRawDates(loader: Loader, fields: string[]): Loader {
  return {
    ...loader,
    load: (context) =>
      loader.load({
        ...context,
        parseData: ((props) => {
          if (!props.filePath) return context.parseData(props);
          const frontmatter = readFileSync(props.filePath, 'utf8').split(/^---\s*$/m)[1] ?? '';
          const data: Record<string, unknown> = { ...props.data };
          for (const field of fields) {
            const raw = frontmatter.match(new RegExp(`^${field}:[ \\t]*(.*?)[ \\t]*$`, 'm'))?.[1];
            if (raw !== undefined) data[field] = raw.replace(/^(['"])(.*)\1$/, '$2');
          }
          return context.parseData({ ...props, data });
        }) as LoaderContext['parseData'],
      }),
  };
}
