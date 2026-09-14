import { type MutableField } from '@/shared/api/schema';

/** Ячейки, которые могут подсвечиваться: собственные поля узла (дерево) и агрегаты (таблица). */
export type CellField = MutableField | 'totalHeadcount' | 'totalBudget' | 'avgPerformance';

export const FLASH_TTL_MS = 1_500;

export const cellKey = (nodeId: string, field: CellField): string => `${nodeId}:${field}`;

export interface HighlightStore {
  subscribe: (listener: () => void) => () => void;
  /** Ключ ячейки → метка времени последней подсветки. Новый объект при каждом изменении. */
  getSnapshot: () => ReadonlyMap<string, number>;
  /** Подсветить ячейки; запись живёт `ttlMs`, повторная подсветка продлевает её. */
  flash: (keys: readonly string[], now?: number) => void;
  clear: () => void;
}

/**
 * Внешнее хранилище подсветок для useSyncExternalStore: каждая ячейка
 * подписана на свой ключ и перерисовывается только когда меняется её метка.
 */
export function createHighlightStore(ttlMs = FLASH_TTL_MS): HighlightStore {
  let snapshot = new Map<string, number>();
  const listeners = new Set<() => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let lastStamp: number | undefined;

  const notify = () => listeners.forEach((listener) => listener());

  const expire = (stamp: number) => {
    let changed = false;
    const next = new Map(snapshot);
    for (const [key, value] of snapshot) {
      if (value === stamp) {
        next.delete(key);
        changed = true;
      }
    }
    if (changed) {
      snapshot = next;
      notify();
    }
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    flash(keys, now = Date.now()) {
      if (keys.length === 0) return;
      // Метка уникальна для батча: одинаковое now при двух патчах подряд
      // дало бы одну и ту же метку и не перезапустило бы анимацию.
      const stamp = Math.max(now, (lastStamp ?? 0) + 1);
      lastStamp = stamp;
      const next = new Map(snapshot);
      keys.forEach((key) => next.set(key, stamp));
      snapshot = next;
      notify();
      const timer = setTimeout(() => {
        timers.delete(timer);
        expire(stamp);
      }, ttlMs);
      timers.add(timer);
    },
    clear() {
      timers.forEach(clearTimeout);
      timers.clear();
      snapshot = new Map();
      notify();
    },
  };
}

/** Ключи ячеек, которые нужно подсветить после патча. */
export function keysForPatch(
  touchedIds: readonly string[],
  changedFields: readonly MutableField[],
): string[] {
  const [changedId, ...ancestors] = touchedIds;
  if (!changedId) return [];

  const keys: string[] = changedFields.map((field) => cellKey(changedId, field));

  const aggregateFields = new Set<CellField>();
  if (changedFields.includes('headcount')) {
    aggregateFields.add('totalHeadcount');
    aggregateFields.add('avgPerformance');
  }
  if (changedFields.includes('budget')) aggregateFields.add('totalBudget');
  if (changedFields.includes('performance')) aggregateFields.add('avgPerformance');

  for (const id of [changedId, ...ancestors]) {
    for (const field of aggregateFields) keys.push(cellKey(id, field));
  }
  return keys;
}

/** Единственный экземпляр на приложение. */
export const highlightStore = createHighlightStore();
