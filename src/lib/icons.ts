// Іконки — лінійні, у стилі логотипа: шляхи на сітці 24×24. Малює їх компонент Icon.
// Нова іконка: додай шлях сюди.
export const iconPaths = {
  mountain: '<path d="M2.5 20 9 8.5l4 6.5 2.5-4L21.5 20z"/><path d="m7 12 2 1.5 1.5-1"/>',
  book: '<path d="M4 18.5v-13A2.5 2.5 0 0 1 6.5 3H20v13H6.5A2.5 2.5 0 0 0 4 18.5 2.5 2.5 0 0 0 6.5 21H20v-5"/><path d="M8 7.5h8"/>',
  tent: '<path d="M2.5 20 12 4l9.5 16z"/><path d="m9 20 3-6 3 6"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4 2.5 4H5"/>',
  campfire: '<path d="M12 3c1.5 2.5 4 4 4 7.5a4 4 0 0 1-8 0c0-1.8 1-3 2-4 0 1.6.8 2.6 2 3 .3-2.4-.6-4.3 0-6.5z"/><path d="m5 21 14-3.5M19 21 5 17.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'chevron-left': '<path d="m15 6-6 6 6 6"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  'map-pin': '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  send: '<path d="M21 3 3 10.5l7 2.5 2.5 7.5z"/><path d="M21 3 10 13"/>',
  camera: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01"/>',
  play: '<rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
  message: '<path d="M4 4.5h16v11H10l-6 4.5z"/><path d="M8 9h8M8 12h5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/>',
  download: '<path d="M12 3.5v12M7 10.5l5 5 5-5"/><path d="M4.5 20h15"/>',
} as const;

export type IconName = keyof typeof iconPaths;
export const iconNames = Object.keys(iconPaths) as IconName[];
