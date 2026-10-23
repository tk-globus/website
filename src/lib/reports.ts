// Звіти про походи для сторінок бібліотеки: найсвіжіші першими (за роком; звіти без року — у кінці;
// звіти одного року — за номером вузла старого сайту, пізніший вище). Підписи к.с. і розміру файлу.
import { getCollection, type CollectionEntry } from 'astro:content';
import type { ReportFile, ReportGrade } from './schemas/report';

export type Report = CollectionEntry<'reports'>;

const nodeId = (entry: Report) => Number(entry.data.legacyUrl.match(/\/node\/(\d+)/)?.[1] ?? 0);

export async function getReports(): Promise<Report[]> {
  const reports = await getCollection('reports');
  return reports.sort((a, b) => (b.data.year ?? 0) - (a.data.year ?? 0) || nodeId(b) - nodeId(a));
}

export const reportHref = (entry: Report) => `/library/${entry.id}`;

/** «2» → «2 к.с.», «н/к» — як є. */
export const gradeLabel = (grade: ReportGrade) => (grade === 'н/к' ? grade : `${grade} к.с.`);

/** 23951558 → «23 МБ»; 734003 → «717 КБ». */
export function formatFileSize(bytes: number): string {
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const rounded = value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace('.', ',')} ${units[unit]}`;
}

/** Підпис файлу для кнопки: «PDF, 23 МБ». */
export function fileLabel(file: ReportFile): string {
  const ext = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toUpperCase() ?? 'Файл';
  return file.size ? `${ext}, ${formatFileSize(file.size)}` : ext;
}

/** 1 звіт, 2 звіти, 5 звітів, 44 звіти. */
export function reportsCount(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? 'звіт' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'звіти' : 'звітів';
  return `${n} ${word}`;
}
