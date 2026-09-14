import { type AggregatedRow } from '@/shared/model/orgModel';

export type ColumnKey = keyof Pick<
  AggregatedRow,
  'name' | 'level' | 'totalHeadcount' | 'totalBudget' | 'avgPerformance'
>;

export interface Column {
  key: ColumnKey;
  label: string;
  align: 'left' | 'right';
}

export const COLUMNS: readonly Column[] = [
  { key: 'name', label: 'Подразделение', align: 'left' },
  { key: 'level', label: 'Уровень', align: 'right' },
  { key: 'totalHeadcount', label: 'Всего сотрудников', align: 'right' },
  { key: 'totalBudget', label: 'Бюджет суммарный', align: 'right' },
  { key: 'avgPerformance', label: 'Средняя эффективность', align: 'right' },
];

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: ColumnKey;
  direction: SortDirection;
}

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

/** Сравнение по столбцу; для строк — локализованное, для чисел — числовое. */
export function compareRows(a: AggregatedRow, b: AggregatedRow, key: ColumnKey): number {
  if (key === 'name') {
    return collator.compare(a.name, b.name);
  }
  return a[key] - b[key];
}

/**
 * Стабильная сортировка: при равенстве значений сохраняется исходный порядок
 * (обход дерева в глубину), поэтому одинаковые уровни остаются сгруппированными.
 */
export function sortRows(rows: readonly AggregatedRow[], sort: SortState): AggregatedRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => sign * compareRows(a.row, b.row, sort.key) || a.index - b.index)
    .map(({ row }) => row);
}

/** Регистронезависимый фильтр по названию. */
export function filterRows(rows: readonly AggregatedRow[], query: string): AggregatedRow[] {
  const needle = query.trim().toLocaleLowerCase('ru');
  if (!needle) return [...rows];
  return rows.filter((row) => row.name.toLocaleLowerCase('ru').includes(needle));
}
