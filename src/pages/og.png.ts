// Картинка превʼю за замовчуванням (/og.png) — збирається разом із сайтом із логотипа й кольорів теми.
// sharp — бібліотека зображень, яку Astro вже використовує для фото (astro:assets).
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import logoSvg from '../assets/logo.svg?raw';
import { OG_IMAGE } from '../lib/og-image';
import { tokens } from '../lib/theme-tokens';

function themeColor(name: string): string {
  const token = tokens.color?.find((t) => t.name === name);
  if (!token) throw new Error(`/og.png: у темі немає кольору --color-${name}`);
  return token.value;
}

export const GET: APIRoute = async () => {
  const { width, height } = OG_IMAGE;
  const band = Math.round(height * 0.06);

  // trim — обрізати порожні поля навколо логотипа, щоб він став рівно по центру.
  const trimmed = await sharp(Buffer.from(logoSvg), { density: 300 }).trim().png().toBuffer();
  const logo = await sharp(trimmed)
    .resize({ width: Math.round(width * 0.76) })
    .png()
    .toBuffer();
  const { width: logoWidth = 0, height: logoHeight = 0 } = await sharp(logo).metadata();

  const png = await sharp({ create: { width, height, channels: 3, background: themeColor('paper') } })
    .composite([
      {
        input: logo,
        left: Math.round((width - logoWidth) / 2),
        top: Math.round((height - band - logoHeight) / 2),
      },
      {
        input: { create: { width, height: band, channels: 3, background: themeColor('brand') } },
        left: 0,
        top: height - band,
      },
    ])
    .png()
    .toBuffer();

  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
