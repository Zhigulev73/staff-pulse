import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cellKey, createHighlightStore, keysForPatch } from '@/features/highlights/cellHighlights';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createHighlightStore', () => {
  it('хранит метку подсветки и снимает её через ttl', () => {
    const store = createHighlightStore(1500);
    const listener = vi.fn();
    store.subscribe(listener);

    store.flash(['a:headcount'], 1000);
    expect(store.getSnapshot().get('a:headcount')).toBe(1000);
    expect(listener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1499);
    expect(store.getSnapshot().has('a:headcount')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(store.getSnapshot().has('a:headcount')).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('повторная подсветка даёт новую метку и продлевает срок', () => {
    const store = createHighlightStore(1500);
    store.flash(['a:budget'], 1000);
    vi.advanceTimersByTime(1000);
    store.flash(['a:budget'], 2000);

    vi.advanceTimersByTime(500); // первый таймер истёк, но метка уже другая
    expect(store.getSnapshot().get('a:budget')).toBe(2000);
    vi.advanceTimersByTime(1000);
    expect(store.getSnapshot().has('a:budget')).toBe(false);
  });

  it('два батча с одинаковым временем получают разные метки', () => {
    const store = createHighlightStore(1500);
    store.flash(['a:budget'], 5000);
    const first = store.getSnapshot().get('a:budget');
    store.flash(['a:budget'], 5000);
    expect(store.getSnapshot().get('a:budget')).not.toBe(first);
  });

  it('снимок меняет ссылку только при изменении', () => {
    const store = createHighlightStore(1500);
    const before = store.getSnapshot();
    store.flash([]);
    expect(store.getSnapshot()).toBe(before);
    store.flash(['x:performance']);
    expect(store.getSnapshot()).not.toBe(before);
  });
});

describe('keysForPatch', () => {
  it('подсвечивает изменённые поля узла и агрегаты узла с предками', () => {
    const keys = keysForPatch(['team', 'dep', 'div'], ['headcount']);

    expect(keys).toEqual([
      cellKey('team', 'headcount'),
      cellKey('team', 'totalHeadcount'),
      cellKey('team', 'avgPerformance'),
      cellKey('dep', 'totalHeadcount'),
      cellKey('dep', 'avgPerformance'),
      cellKey('div', 'totalHeadcount'),
      cellKey('div', 'avgPerformance'),
    ]);
  });

  it('бюджет затрагивает только суммарный бюджет, эффективность — только среднее', () => {
    expect(keysForPatch(['t', 'p'], ['budget'])).toEqual([
      't:budget',
      't:totalBudget',
      'p:totalBudget',
    ]);
    expect(keysForPatch(['t'], ['performance'])).toEqual(['t:performance', 't:avgPerformance']);
  });

  it('пустой список затронутых узлов — нет ключей', () => {
    expect(keysForPatch([], ['headcount'])).toEqual([]);
  });
});
