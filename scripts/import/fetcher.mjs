// Ввічливий завантажувач старого сайту (ADR 0004): локальний кеш і пауза 1,5–2 с між запитами в мережу.
// Сторінка чи фото, що вже є в кеші, береться з диска без запиту і без паузи.
// Кеш лежить у .cache/old-site/ (у .gitignore); --refresh змушує завантажити заново.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const USER_AGENT = 'tk-globus-importer (+https://github.com/tk-globus/website)';
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Імʼя файлу в кеші: читабельна частина адреси + короткий хеш (щоб `?page=1` і `?page=2` не злиплися). */
export function cacheFileName(url) {
  const { pathname, search } = new URL(url);
  const readable = pathname.replace(/^\/+/, '').replace(/[^\w.-]+/g, '_').slice(-80) || 'index';
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 8);
  const ext = extname(pathname) || '.html';
  return `${readable.replace(/\.[^.]*$/, '')}${search ? '_q' : ''}--${hash}${ext}`;
}

/**
 * @param {object} options
 * @param {string} options.cacheDir тека кешу
 * @param {boolean} [options.refresh] ігнорувати кеш і завантажити заново
 * @param {[number, number]} [options.pauseMs] пауза між запитами в мережу: від і до, мс
 * @param {(msg: string) => void} [options.log]
 * @param {typeof fetch} [options.fetchImpl] підміна мережі в тестах
 * @param {(ms: number) => Promise<void>} [options.sleep]
 */
export function createFetcher({
  cacheDir,
  refresh = false,
  pauseMs = [1500, 2000],
  log = () => {},
  fetchImpl = fetch,
  sleep = defaultSleep,
}) {
  let lastRequestAt = 0;
  let requests = 0;

  async function pause() {
    const [min, max] = pauseMs;
    const wait = lastRequestAt + min + Math.random() * (max - min) - Date.now();
    if (lastRequestAt && wait > 0) await sleep(wait);
  }

  async function download(url) {
    for (let attempt = 1; ; attempt++) {
      await pause();
      log(`  ↓ ${url}`);
      const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
      lastRequestAt = Date.now();
      requests++;
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      if (RETRY_STATUSES.has(res.status) && attempt < 3) {
        log(`  ! ${url}: HTTP ${res.status}, чекаю й пробую ще раз`);
        await sleep(10_000 * attempt);
        continue;
      }
      throw new Error(`${url}: HTTP ${res.status}`);
    }
  }

  async function get(url) {
    const file = join(cacheDir, cacheFileName(url));
    if (!refresh && existsSync(file)) return readFileSync(file);
    const body = await download(url);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(file, body);
    return body;
  }

  return {
    /** HTML-сторінка як текст (UTF-8). */
    text: async (url) => (await get(url)).toString('utf8'),
    /** Файл (фото) як Buffer. */
    binary: (url) => get(url),
    /** Скільки запитів пішло в мережу (не з кешу). */
    get requests() {
      return requests;
    },
  };
}
