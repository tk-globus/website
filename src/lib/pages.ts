// Статичні сторінки (колекція pages, src/content/pages/): імʼя файлу — адреса на сайті (about.md → /about).
// Тексти — зі старого сайту (npm run import -- pages), їх можна правити й руками.
import { getEntry, type CollectionEntry } from 'astro:content';

export type Page = CollectionEntry<'pages'>;

export type PageId = 'about' | 'mkk' | 'camp';

/** Сторінка за іменем файлу. Немає файлу — збірка падає з підказкою, як його отримати. */
export async function getPage(id: PageId): Promise<Page> {
  const entry = await getEntry('pages', id);
  if (!entry) throw new Error(`Немає сторінки src/content/pages/${id}.md — запустіть npm run import -- pages`);
  return entry;
}
