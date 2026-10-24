// Події для сторінок: майбутні й минулі, підписи дат («25 жовтня 2026, 08:00») і календар місяця.
//
// Дати подій — київський час рядком `РРРР-ММ-ДДTГГ:ХХ` (src/lib/schemas/event.ts), тож порівнюємо рядки,
// без перерахунку часових поясів. Майбутня чи минула — рахується під час збірки (специфікація 0001):
// подія «майбутня», доки не скінчився (за Києвом) її останній день — сьогоднішня подія ще вгорі списку.
// Сайт статичний: після події його треба перезібрати, щоб вона переїхала в минулі.
import { getCollection, type CollectionEntry } from 'astro:content';
import { formatDate } from './dates';

export type ClubEvent = CollectionEntry<'events'>;

export const TIME_ZONE = 'Europe/Kyiv';

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Сьогодні в Києві: `2026-10-24`. */
export const todayInKyiv = (now = new Date()) => dayFormat.format(now);

const dayOf = (dateTime: string) => dateTime.slice(0, 10);
const timeOf = (dateTime: string) => dateTime.slice(11, 16);
const monthOf = (day: string) => day.slice(0, 7);
const utcDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** Останній день події: день кінця, а без кінця — день початку. */
export const lastDay = (entry: ClubEvent) => dayOf(entry.data.end ?? entry.data.start);

export const isUpcoming = (entry: ClubEvent, today = todayInKyiv()) => lastDay(entry) >= today;

const nodeId = (entry: ClubEvent) => Number(entry.data.legacyUrl.match(/\/node\/(\d+)/)?.[1] ?? 0);

/** Усі події за часом початку (найраніша першою). */
export async function getEvents(): Promise<ClubEvent[]> {
  const events = await getCollection('events');
  return events.sort((a, b) => a.data.start.localeCompare(b.data.start) || nodeId(a) - nodeId(b));
}

/** Майбутні — найближча першою; минулі — найсвіжіша першою. */
export function splitEvents(events: ClubEvent[], today = todayInKyiv()) {
  const upcoming = events.filter((e) => isUpcoming(e, today));
  const past = events.filter((e) => !isUpcoming(e, today)).reverse();
  return { upcoming, past };
}

export const eventHref = (entry: ClubEvent) => `/events/${entry.id}`;

/**
 * «25 жовтня 2026, 08:00»; той самий день — «2 квітня 2025, 19:00–21:00»;
 * кілька днів — «28 жовтня 2023, 07:00 — 29 жовтня 2023, 19:00».
 */
export function formatWhen(start: string, end?: string): string {
  const startText = `${formatDate(utcDate(dayOf(start)))}, ${timeOf(start)}`;
  if (!end) return startText;
  if (dayOf(end) === dayOf(start)) return `${startText}–${timeOf(end)}`;
  return `${startText} — ${formatDate(utcDate(dayOf(end)))}, ${timeOf(end)}`;
}

// ── Календар місяця ─────────────────────────────────────────────────────────────

export interface CalendarEvent {
  title: string;
  href: string;
  start: string;
  when: string;
}

export interface CalendarDay {
  /** `2026-10-25` */
  date: string;
  day: number;
  /** День цього місяця (дні сусідніх місяців добирають тижні до повних і лишаються порожніми). */
  inMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

export interface CalendarMonth {
  /** `2026-10` */
  key: string;
  /** «Жовтень 2026» */
  label: string;
  /** Тижні з понеділка. */
  weeks: CalendarDay[][];
  /** Події місяця за часом (список під календарем на телефоні). */
  events: CalendarEvent[];
  prev?: CalendarMonth['key'];
  next?: CalendarMonth['key'];
}

const monthName = new Intl.DateTimeFormat('uk-UA', { month: 'long', timeZone: 'UTC' });

/** `2026-10` → «Жовтень 2026» */
export function monthLabel(key: string): string {
  const name = monthName.format(utcDate(`${key}-01`));
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${key.slice(0, 4)}`;
}

const addDays = (day: string, n: number) => {
  const d = utcDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const nextMonth = (key: string) => monthOf(addDays(`${key}-28`, 7));

/** Понеділок = 0 … неділя = 6. */
const weekday = (day: string) => (utcDate(day).getUTCDay() + 6) % 7;

/** Подія для календаря: з колекції (calendarItem) чи будь-яка інша (зразок на /styleguide). */
export interface CalendarItem {
  title: string;
  href: string;
  start: string;
  end?: string;
}

export const calendarItem = (entry: ClubEvent): CalendarItem => ({
  title: entry.data.title,
  href: eventHref(entry),
  start: entry.data.start,
  end: entry.data.end,
});

/**
 * Місяці календаря: від місяця першої події до місяця останньої (і щонайменше до поточного),
 * кожен — повні тижні з понеділка; подія стоїть у кожному своєму дні (багатоденна — у кількох).
 */
export function calendarMonths(events: CalendarItem[], today = todayInKyiv()): CalendarMonth[] {
  const items = events.map(({ title, href, start, end }) => ({
    first: dayOf(start),
    last: dayOf(end ?? start),
    event: { title, href, start, when: formatWhen(start, end) },
  }));
  const keys = [monthOf(today), ...items.flatMap((i) => [monthOf(i.first), monthOf(i.last)])].sort();
  const months: CalendarMonth[] = [];

  for (let key = keys[0]; key <= keys[keys.length - 1]; key = nextMonth(key)) {
    const firstDay = `${key}-01`;
    const lastDayOfMonth = addDays(`${nextMonth(key)}-01`, -1);
    const gridStart = addDays(firstDay, -weekday(firstDay));
    const gridEnd = addDays(lastDayOfMonth, 6 - weekday(lastDayOfMonth));

    const weeks: CalendarDay[][] = [];
    for (let date = gridStart; date <= gridEnd; date = addDays(date, 1)) {
      if (weekday(date) === 0) weeks.push([]);
      const inMonth = monthOf(date) === key;
      weeks[weeks.length - 1].push({
        date,
        day: utcDate(date).getUTCDate(),
        inMonth,
        isToday: date === today,
        events: inMonth ? items.filter((i) => i.first <= date && date <= i.last).map((i) => i.event) : [],
      });
    }

    const monthEvents = items
      .filter((i) => i.first <= lastDayOfMonth && i.last >= firstDay)
      .map((i) => i.event)
      .sort((a, b) => a.start.localeCompare(b.start));
    months.push({ key, label: monthLabel(key), weeks, events: monthEvents });
  }

  months.forEach((month, i) => {
    month.prev = months[i - 1]?.key;
    month.next = months[i + 1]?.key;
  });
  return months;
}

/** Місяць календаря, відкритий спочатку, — поточний. */
export const currentMonthKey = (today = todayInKyiv()) => monthOf(today);
