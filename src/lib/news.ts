// Новини для сторінок: найновіші першими. Новини одного дня — за номером вузла старого сайту (пізніший вище).
import { getCollection, type CollectionEntry } from 'astro:content';

export type News = CollectionEntry<'news'>;

const nodeId = (entry: News) => Number(entry.data.legacyUrl.match(/\/node\/(\d+)/)?.[1] ?? 0);

export async function getNews(): Promise<News[]> {
  const news = await getCollection('news');
  return news.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || nodeId(b) - nodeId(a));
}

export const newsHref = (entry: News) => `/news/${entry.id}/`;
