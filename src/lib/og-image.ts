// Картинка превʼю посилання за замовчуванням (Open Graph): логотип на білому, внизу бірюзова смуга.
// Малює її src/pages/og.png.ts під час збірки; кольори — з теми, тож редизайн змінить і її.
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { settings } from './settings';

export const OG_IMAGE = {
  path: '/og.png',
  /** Розмір, який Telegram, Facebook і X показують великою карткою. */
  width: 1200,
  height: 630,
  alt: `Логотип: ${settings.name}`,
};

/**
 * Превʼю посилання з фото запису (обкладинка новини): JPEG 1200×630, обрізаний по центру.
 * Повертає адресу на сайті для BaseLayout (`image`); фото меншого розміру не розтягується.
 */
export async function ogImageFrom(photo: ImageMetadata): Promise<string> {
  const { src } = await getImage({ src: photo, width: OG_IMAGE.width, height: OG_IMAGE.height, fit: 'cover', format: 'jpg' });
  return src;
}
