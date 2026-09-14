import { describe, expect, it } from 'vitest';
import { formatBudget, formatPerformance } from '@/shared/model/format';

/** Intl ставит неразрывные пробелы; в тестах сравниваем с обычными. */
const plain = (value: string) => value.replace(/[\u00A0\u202F]/g, ' ');

describe('formatBudget', () => {
  it('разбивает разряды пробелами и добавляет «руб.»', () => {
    expect(plain(formatBudget(12_345_678))).toBe('12 345 678 руб.');
  });

  it('округляет дробные значения и корректно показывает ноль', () => {
    expect(plain(formatBudget(1234.6))).toBe('1 235 руб.');
    expect(plain(formatBudget(0))).toBe('0 руб.');
  });
});

describe('formatPerformance', () => {
  it('округляет до целого', () => {
    expect(formatPerformance(76.49)).toBe('76');
    expect(formatPerformance(76.5)).toBe('77');
  });
});
