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
 * Превʼю посилання з фото запису (обкладинка новини): JPEG із пропорцією 1200×630 (≈1,905), обрізаний
 * по центру. Мале фото не розтягується: картинка менша за 1200×630, але пропорція та сама.
 * Повертає адресу на сайті для BaseLayout (`image`).
 */
export async function ogImageFrom(photo: ImageMetadata): Promise<string> {
  const ratio = OG_IMAGE.width / OG_IMAGE.height;
  // Широке низьке фото обмежує ширину своєю висотою — інакше висоту довелося б розтягувати.
  const width = Math.min(OG_IMAGE.width, photo.width, Math.floor(photo.height * ratio));
  const height = Math.round(width / ratio);
  const { src } = await getImage({ src: photo, width, height, fit: 'cover', format: 'jpg' });
  return src;
}
