// Налаштування сайту: один файл даних (src/data/settings.json), перевірений схемою.
// Невалідний файл ламає збірку з поясненням, яке поле не так.
import { z } from 'astro/zod';
import raw from '../data/settings.json';

const settingsSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().min(1),
  description: z.string().min(1),
  channels: z.object({
    telegram: z.string().url(),
    instagram: z.string().url(),
    youtube: z.string().url(),
    facebook: z.string().url(),
    email: z.string().email(),
    oldSite: z.string().url(),
    forum: z.string().url(),
  }),
  address: z.string().min(1),
  /** Куратори навчальних груп — імена показує сторінка /join. */
  curators: z.object({
    groupA: z.string().min(1),
    groupB: z.string().min(1),
  }),
  prototypeBanner: z.object({
    text: z.string().min(1),
    linkText: z.string().min(1),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;

const parsed = settingsSchema.safeParse(raw);
if (!parsed.success) {
  throw new Error(`src/data/settings.json не відповідає схемі:\n${parsed.error.message}`);
}

export const settings: Settings = parsed.data;
