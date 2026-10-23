// Канали клубу для підвалу й блоку «Канали клубу» на головній.
// Адреси — з налаштувань сайту (src/data/settings.json); тут лише підписи й іконки.
import { settings } from './settings';
import type { IconName } from './icons';

export interface Channel {
  label: string;
  href: string;
  icon: IconName;
  /** Що там є — коротко, для блоку на головній. */
  note: string;
}

const { channels } = settings;

export const clubChannels: Channel[] = [
  { label: 'Telegram-чат', href: channels.telegram, icon: 'send', note: 'Анонси, питання й живе спілкування' },
  { label: 'Instagram', href: channels.instagram, icon: 'camera', note: 'Фото й відео з походів' },
  { label: 'YouTube', href: channels.youtube, icon: 'play', note: 'Відео клубу' },
  { label: 'Facebook', href: channels.facebook, icon: 'message', note: 'Новини й анонси' },
  { label: channels.email, href: `mailto:${channels.email}`, icon: 'mail', note: 'Пошта клубу' },
];
