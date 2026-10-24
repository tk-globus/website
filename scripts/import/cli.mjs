// Аргументи командного рядка імпортера. Помилка в аргументах — одне зрозуміле речення українською
// (і підказка, як правильно), а не стек Node: імпортер запускає й не розробник.
import { parseArgs } from 'node:util';

export const USAGE = [
  'Як запускати:',
  '  npm run import -- <тип>                  вибірка для прототипу (з аудиту)',
  '  npm run import -- <тип> --scope all      усе зі сторінок-списків старого сайту',
  '  npm run import -- <тип> --limit 3        лише перші 3 записи',
  '  npm run import -- <тип> --refresh        завантажити заново, а не з кешу',
].join('\n');

/** Помилка в аргументах: її текст показується як є, без стеку. */
export class CliError extends Error {}

const OPTIONS = {
  scope: { type: 'string', default: 'sample' },
  limit: { type: 'string' },
  refresh: { type: 'boolean', default: false },
  root: { type: 'string', default: '.' },
};

const SCOPES = ['sample', 'all'];

/** Пояснення помилки node:util parseArgs українською. */
function explainParseError(e) {
  const option = e.message.match(/'(-{1,2}[^' ]+)/)?.[1];
  switch (e.code) {
    case 'ERR_PARSE_ARGS_UNKNOWN_OPTION':
      return `невідомий параметр ${option ?? ''}. Є лише --scope, --limit, --refresh`.replace(/\s+\./, '.');
    case 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE':
      return option === '--refresh'
        ? 'параметр --refresh пишеться без значення'
        : `параметру ${option ?? ''} бракує значення (напр. --scope all, --limit 3)`;
    default:
      return `не зрозумів аргументи: ${e.message}`;
  }
}

/**
 * Аргументи → параметри імпорту. Невідомий тип, параметр чи значення — CliError із поясненням.
 * @param {string[]} argv аргументи без `node` і шляху до скрипта
 * @param {string[]} typeNames типи контенту, які вміє імпортер
 * @returns {{ typeName: string, scope: 'sample' | 'all', limit?: number, refresh: boolean, root: string }}
 */
export function parseCli(argv, typeNames) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, allowPositionals: true, strict: true, options: OPTIONS });
  } catch (e) {
    throw new CliError(explainParseError(e));
  }
  const { values, positionals } = parsed;
  const types = typeNames.join(', ');

  const [typeName, ...extra] = positionals;
  if (!typeName) throw new CliError(`вкажіть тип контенту: ${types}. Напр.: npm run import -- news`);
  if (!typeNames.includes(typeName)) throw new CliError(`невідомий тип «${typeName}». Є: ${types}`);
  if (extra.length) throw new CliError(`зайвий аргумент «${extra[0]}». Тип вказується один: ${types}`);

  if (!SCOPES.includes(values.scope)) {
    throw new CliError(`невідомий обсяг «${values.scope}»: --scope sample (вибірка) або --scope all (усе)`);
  }

  let limit;
  if (values.limit !== undefined) {
    limit = Number(values.limit);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new CliError(`--limit має бути цілим числом від 1, а не «${values.limit}»`);
    }
  }

  return { typeName, scope: values.scope, limit, refresh: values.refresh, root: values.root };
}
