import { type OrgNode } from '@/shared/api/schema';
import {
  type Aggregate,
  aggregateFromChildren,
  type AggregatedRow,
  type OrgModel,
  registerRows,
  rowsFromModel,
  type TreeNode,
} from '@/shared/model/orgModel';

export interface PatchModelResult {
  model: OrgModel;
  /** Изменённый узел, затем его предки до корня — все, чьи агрегаты пересчитаны. */
  touchedIds: string[];
}

/**
 * Инкрементальное обновление модели после изменения собственных полей ОДНОГО узла
 * (структура дерева не меняется).
 *
 * Пересчёт агрегатов идёт только по цепочке «узел → предки», каждый шаг —
 * `aggregateFromChildren` из уже готовых агрегатов детей: O(глубина · ширина),
 * без обхода поддеревьев. Клонируются только узлы этой цепочки; соседние
 * поддеревья, их агрегаты и строки таблицы сохраняют объектную идентичность,
 * поэтому React перерисовывает лишь затронутые строки.
 */
export function patchModel(prev: OrgModel, changed: OrgNode): PatchModelResult {
  const current = prev.byId.get(changed.id);
  if (!current) {
    return { model: prev, touchedIds: [] };
  }

  const byId = new Map(prev.byId);
  const aggregates = new Map(prev.aggregates);
  const touchedIds: string[] = [];

  // 1. Клон изменённого узла с новыми собственными полями (children — те же).
  let node: TreeNode = { ...current, ...changed, level: current.level, children: current.children };
  byId.set(node.id, node);
  aggregates.set(node.id, aggregateFromChildren(node, aggregates));
  touchedIds.push(node.id);

  // 2. Вверх по предкам: заменить ссылку на ребёнка и пересчитать агрегат.
  let child = node;
  while (child.parentId !== null) {
    const parent = byId.get(child.parentId);
    if (!parent) break;
    const replaced = child;
    node = {
      ...parent,
      children: parent.children.map((c) => (c.id === replaced.id ? replaced : c)),
    };
    byId.set(node.id, node);
    aggregates.set(node.id, aggregateFromChildren(node, aggregates));
    touchedIds.push(node.id);
    child = node;
  }

  // 3. Корень цепочки — новая ссылка в списке корней.
  const root = child;
  const roots = prev.roots.map((r) => (r.id === root.id ? root : r));

  const model: OrgModel = { roots, byId, order: prev.order, aggregates };

  // 4. Строки таблицы: заменить только затронутые, остальные — те же объекты.
  const prevRows = rowsFromModel(prev);
  const touched = new Set(touchedIds);
  const rows: AggregatedRow[] = prevRows.map((row) =>
    touched.has(row.id) ? rowFor(row.id, byId, aggregates) : row,
  );
  registerRows(model, rows);

  return { model, touchedIds };
}

function rowFor(
  id: string,
  byId: Map<string, TreeNode>,
  aggregates: Map<string, Aggregate>,
): AggregatedRow {
  const node = byId.get(id)!;
  const aggregate = aggregates.get(id)!;
  return {
    id,
    name: node.name,
    level: node.level,
    totalHeadcount: aggregate.totalHeadcount,
    totalBudget: aggregate.totalBudget,
    avgPerformance: aggregate.avgPerformance,
  };
}
