// Картинка превʼю посилання за замовчуванням (Open Graph): логотип на білому, внизу бірюзова смуга.
// Малює її src/pages/og.png.ts під час збірки; кольори — з теми, тож редизайн змінить і її.
import { settings } from './settings';

export const OG_IMAGE = {
  path: '/og.png',
  /** Розмір, який Telegram, Facebook і X показують великою карткою. */
  width: 1200,
  height: 630,
  alt: `Логотип: ${settings.name}`,
};
