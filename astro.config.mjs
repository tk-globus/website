// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// Повна адреса сайту — для превʼю посилань (Open Graph): Telegram і Facebook беруть картинку
// лише за повною адресою. Продакшн (гілка main) — постійна адреса; превʼю гілки на Cloudflare
// Pages — адреса саме цієї збірки (CF_PAGES_URL), щоб картинка в превʼю бралася з неї.
const PRODUCTION_URL = 'https://tk-globus.pages.dev';
const branch = process.env.CF_PAGES_BRANCH;
const site = branch && branch !== 'main' && process.env.CF_PAGES_URL ? process.env.CF_PAGES_URL : PRODUCTION_URL;

// https://astro.build/config
export default defineConfig({
  site,
  // Адреси сторінок — зі слешем у кінці (`/news/`): Cloudflare Pages віддає сторінку-теку саме так,
  // а `/news` перенаправляє (308) на `/news/`. Внутрішні посилання без слеша ловить npm run check:links.
  trailingSlash: 'always',
  vite: {
    plugins: [tailwindcss()]
  }
});
