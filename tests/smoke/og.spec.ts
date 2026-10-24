// Превʼю посилань (Open Graph) на всіх сторінках: повна адреса сторінки зі слешем у кінці, тип сторінки
// (запис — `article`), картинка з розміром у тегах og:image:width / og:image:height, який збігається
// з самою картинкою (Facebook без розміру іноді не показує картинку при першому поширенні).
import { test, expect, type APIRequestContext } from '@playwright/test';
import { newsRoutes, reportRoutes, routes } from './routes';

const articles = new Set([...newsRoutes, ...reportRoutes]);

/** Розмір PNG (заголовок IHDR) або JPEG (маркер SOF0…SOF15, крім DHT/JPG/DAC). */
function imageSize(bytes: Buffer): [number, number] {
  if (bytes.readUInt32BE(0) === 0x89504e47) return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  for (let i = 2; i < bytes.length; ) {
    const marker = bytes[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return [bytes.readUInt16BE(i + 7), bytes.readUInt16BE(i + 5)];
    }
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  throw new Error('не знайшов розмір картинки');
}

const sizes = new Map<string, Promise<[number, number]>>();
const sizeOf = (request: APIRequestContext, path: string) => {
  if (!sizes.has(path)) {
    sizes.set(
      path,
      request.get(path).then(async (response) => {
        expect(response.status(), path).toBe(200);
        return imageSize(await response.body());
      }),
    );
  }
  return sizes.get(path)!;
};

for (const route of routes) {
  test(`${route}: Open Graph — адреса, тип, картинка з розміром`, async ({ page, request }) => {
    await page.goto(route);
    const content = (property: string) => page.locator(`head meta[property="${property}"]`).getAttribute('content');

    expect(new URL((await content('og:url'))!).pathname).toBe(route);
    expect(await content('og:type')).toBe(articles.has(route) ? 'article' : 'website');

    const image = new URL((await content('og:image'))!);
    expect(image.protocol).toBe('https:');
    const declared = [Number(await content('og:image:width')), Number(await content('og:image:height'))];
    expect(declared.every((n) => Number.isInteger(n) && n > 0), `og:image:width і og:image:height: ${declared}`).toBe(true);
    expect(await sizeOf(request, image.pathname), `розмір ${image.pathname}`).toEqual(declared);
  });
}
