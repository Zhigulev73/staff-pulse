/** Форматирование чисел для UI. Локаль ru-RU: разряды через неразрывный пробел. */
const budgetFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const integerFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/** `12 345 678 руб.` */
export function formatBudget(value: number): string {
  return `${budgetFormatter.format(Math.round(value))} руб.`;
}

export function formatHeadcount(value: number): string {
  return integerFormatter.format(value);
}

/** Эффективность — целое число 0..100. */
export function formatPerformance(value: number): string {
  return String(Math.round(value));
}
