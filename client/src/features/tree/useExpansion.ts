import { useCallback, useMemo, useState } from 'react';
import { ancestorIds, type OrgModel } from '@/shared/model/orgModel';

const EMPTY_SET: ReadonlySet<string> = new Set();

/**
 * Набор раскрытых узлов. Пока пользователь ничего не трогал, раскрыты корни
 * (дивизионы): второй уровень виден сразу, команды — по клику.
 * Пользовательский выбор хранится отдельно и не сбрасывается рефетчами.
 */
export function useExpansion(model: OrgModel | null) {
  const [userExpanded, setUserExpanded] = useState<ReadonlySet<string> | null>(null);

  const defaultExpanded = useMemo<ReadonlySet<string>>(
    () => (model ? new Set(model.roots.map((n) => n.id)) : EMPTY_SET),
    [model],
  );
  const expandedIds = userExpanded ?? defaultExpanded;

  const toggle = useCallback(
    (id: string) => {
      setUserExpanded((prev) => {
        const next = new Set(prev ?? defaultExpanded);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [defaultExpanded],
  );

  /** Раскрывает всех предков узла — чтобы выбранный из таблицы узел был виден в дереве. */
  const reveal = useCallback(
    (id: string) => {
      if (!model) return;
      const ancestors = ancestorIds(model, id);
      setUserExpanded((prev) => {
        const base = prev ?? defaultExpanded;
        if (ancestors.every((a) => base.has(a))) return prev;
        const next = new Set(base);
        ancestors.forEach((a) => next.add(a));
        return next;
      });
    },
    [model, defaultExpanded],
  );

  return { expandedIds, toggle, reveal };
}
