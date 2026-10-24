// Налаштування сайту: один файл даних (src/data/settings.json), перевірений схемою.
// Невалідний файл ламає збірку з поясненням, яке поле не так.
import { z } from 'astro/zod';
import raw from '../data/settings.json';

const channelText = z.object({
  label: z.string().min(1).optional(),
  note: z.string().min(1),
});

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
  /**
   * Підписи каналів і що там є (підвал, блок «Канали клубу»). Без `label` показується сама адреса (пошта).
   * Адреси — у `channels`, іконки — у src/lib/channels.ts.
   */
  channelTexts: z.object({
    telegram: channelText,
    instagram: channelText,
    youtube: channelText,
    facebook: channelText,
    email: channelText,
  }),
  address: z.string().min(1),
  /** Секція «Звʼязатися з клубом» на /about: заголовок і вступ над каналами клубу. */
  contactSection: z.object({
    title: z.string().min(1),
    intro: z.string().min(1),
  }),
  /**
   * Контакт МКК для сторінки /mkk: заголовок і вступ секції, загальна пошта, графік засідань і склад комісії
   * (на старому сайті).
   */
  mkk: z.object({
    title: z.string().min(1),
    intro: z.string().min(1),
    email: z.string().email(),
    schedule: z.string().url(),
    members: z.string().url(),
  }),
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
