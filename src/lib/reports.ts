// Звіти про походи для сторінок бібліотеки: найсвіжіші першими (за роком; звіти без року — у кінці;
// звіти одного року — за номером вузла старого сайту, пізніший вище). Підписи к.с. і розміру файлу.
import { getCollection, type CollectionEntry } from 'astro:content';
import { REPORT_GRADES, REPORT_KINDS, REPORT_REGIONS, type ReportFile, type ReportGrade } from './schemas/report';
import type { FilterField, FilterValues } from './filters';
import { pluralCount, type PluralForms } from './plural';

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

export const REPORT_NOUNS: PluralForms = ['звіт', 'звіти', 'звітів'];

/** 1 звіт, 2 звіти, 5 звітів, 44 звіти. */
export const reportsCount = (n: number) => pluralCount(n, REPORT_NOUNS);

/** Значення звіту для фільтрів бібліотеки (ключі — назви полів з reportFilterFields). */
export function reportFilterValues(entry: Report): FilterValues {
  const { regions = [], kind, grade, year } = entry.data;
  return { region: [...regions], kind: [kind], grade: grade ? [grade] : [], year: year ? [String(year)] : [] };
}

/**
 * Поля фільтрів бібліотеки (тікет 08): район, вид, к.с. — значення з переліків схеми в їхньому порядку,
 * рік — від найсвіжішого. У списках лише значення, що є хоча б в одному звіті, щоб не вести в порожнечу.
 */
export function reportFilterFields(reports: Report[]): FilterField[] {
  const present = (name: string) => new Set(reports.flatMap((entry) => reportFilterValues(entry)[name]));
  const fromList = (name: string, list: readonly string[], label: (value: string) => string = (v) => v) => {
    const values = present(name);
    return list.filter((value) => values.has(value)).map((value) => ({ value, label: label(value) }));
  };
  const years = [...present('year')].sort((a, b) => Number(b) - Number(a));

  return [
    { name: 'region', label: 'Район', anyLabel: 'Усі райони', options: fromList('region', REPORT_REGIONS) },
    { name: 'kind', label: 'Вид туризму', anyLabel: 'Усі види', options: fromList('kind', REPORT_KINDS) },
    {
      name: 'grade',
      label: 'Категорія складності',
      anyLabel: 'Будь-яка',
      options: fromList('grade', REPORT_GRADES, (grade) => gradeLabel(grade as ReportGrade)),
    },
    { name: 'year', label: 'Рік', anyLabel: 'Усі роки', options: years.map((year) => ({ value: year, label: year })) },
  ];
}
