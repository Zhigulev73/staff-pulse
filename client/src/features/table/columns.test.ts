import { describe, expect, it } from 'vitest';
import { filterRows, sortRows } from '@/features/table/columns';
import { type AggregatedRow } from '@/shared/model/orgModel';

const row = (id: string, overrides: Partial<AggregatedRow> = {}): AggregatedRow => ({
  id,
  name: id,
  level: 1,
  totalHeadcount: 0,
  totalBudget: 0,
  avgPerformance: 0,
  ...overrides,
});

describe('sortRows', () => {
  it('сортирует числа по возрастанию и убыванию', () => {
    const rows = [
      row('a', { totalBudget: 30 }),
      row('b', { totalBudget: 10 }),
      row('c', { totalBudget: 20 }),
    ];

    expect(sortRows(rows, { key: 'totalBudget', direction: 'asc' }).map((r) => r.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(sortRows(rows, { key: 'totalBudget', direction: 'desc' }).map((r) => r.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
  });

  it('сортирует названия по-русски без учёта регистра', () => {
    const rows = [
      row('1', { name: 'Ёлка' }),
      row('2', { name: 'арбуз' }),
      row('3', { name: 'Банан' }),
    ];

    expect(sortRows(rows, { key: 'name', direction: 'asc' }).map((r) => r.name)).toEqual([
      'арбуз',
      'Банан',
      'Ёлка',
    ]);
  });

  it('стабильна: равные значения сохраняют исходный порядок', () => {
    const rows = [row('x', { level: 2 }), row('y', { level: 1 }), row('z', { level: 2 })];

    expect(sortRows(rows, { key: 'level', direction: 'asc' }).map((r) => r.id)).toEqual([
      'y',
      'x',
      'z',
    ]);
    expect(sortRows(rows, { key: 'level', direction: 'desc' }).map((r) => r.id)).toEqual([
      'x',
      'z',
      'y',
    ]);
  });

  it('не мутирует исходный массив', () => {
    const rows = [row('a', { level: 2 }), row('b', { level: 1 })];
    sortRows(rows, { key: 'level', direction: 'asc' });
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('filterRows', () => {
  const rows = [row('1', { name: 'Отдел «Розница»' }), row('2', { name: 'Команда роста' })];

  it('ищет подстроку без учёта регистра', () => {
    expect(filterRows(rows, 'розн').map((r) => r.id)).toEqual(['1']);
    expect(filterRows(rows, 'РОСТ').map((r) => r.id)).toEqual(['2']);
  });

  it('пустой или пробельный запрос возвращает все строки', () => {
    expect(filterRows(rows, '   ')).toHaveLength(2);
  });
});
