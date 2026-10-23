// Пункти меню шапки. href: null — сторінки ще немає (тікети 04–09):
// пункт показується як текст без посилання, щоб не було битих посилань.
export interface NavItem {
  label: string;
  href: string | null;
}

export const mainNav: NavItem[] = [
  { label: 'Про клуб', href: null },
  { label: 'Новини', href: null },
  { label: 'Події', href: null },
  { label: 'Бібліотека', href: null },
  { label: 'МКК', href: null },
  { label: 'Табір', href: null },
];

export const joinLink: NavItem = { label: 'Долучитися', href: null };
