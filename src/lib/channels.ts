// Канали клубу для підвалу й блоку «Канали клубу» на головній.
// Адреси, підписи й описи — з налаштувань сайту (src/data/settings.json); тут лише порядок та іконки.
import { settings } from './settings';
import type { IconName } from './icons';

export interface Channel {
  label: string;
  href: string;
  icon: IconName;
  /** Що там є — коротко, для блоку на головній. */
  note: string;
}

const { channels, channelTexts: texts } = settings;

const channel = (text: { label?: string; note: string }, href: string, icon: IconName, fallbackLabel: string): Channel => ({
  label: text.label ?? fallbackLabel,
  href,
  icon,
  note: text.note,
});

export const clubChannels: Channel[] = [
  channel(texts.telegram, channels.telegram, 'send', channels.telegram),
  channel(texts.instagram, channels.instagram, 'camera', channels.instagram),
  channel(texts.youtube, channels.youtube, 'play', channels.youtube),
  channel(texts.facebook, channels.facebook, 'message', channels.facebook),
  channel(texts.email, `mailto:${channels.email}`, 'mail', channels.email),
];
