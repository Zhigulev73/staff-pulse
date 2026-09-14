import { type OrgNode } from '@/shared/api/schema';

/** Узел дерева: исходные поля + связи и уровень (1 — дивизион, 2 — отдел, 3 — команда). */
export interface TreeNode extends OrgNode {
  level: number;
  children: TreeNode[];
}

/** Агрегат узла: собственные показатели + все потомки. */
export interface Aggregate {
  totalHeadcount: number;
  totalBudget: number;
  /** Σ performance·headcount — хранится, чтобы пересчитывать среднее без обхода поддерева. */
  weightedPerformance: number;
  /** Средняя эффективность, взвешенная по численности; 0 при нулевой численности. */
  avgPerformance: number;
}

export interface OrgModel {
  roots: TreeNode[];
  byId: Map<string, TreeNode>;
  /** Порядок обхода в глубину — порядок строк таблицы по умолчанию. */
  order: string[];
  aggregates: Map<string, Aggregate>;
}

/** Строка аналитической таблицы. */
export interface AggregatedRow {
  id: string;
  name: string;
  level: number;
  totalHeadcount: number;
  totalBudget: number;
  avgPerformance: number;
}

function finishAggregate(
  totalHeadcount: number,
  totalBudget: number,
  weightedPerformance: number,
): Aggregate {
  return {
    totalHeadcount,
    totalBudget,
    weightedPerformance,
    avgPerformance: totalHeadcount > 0 ? weightedPerformance / totalHeadcount : 0,
  };
}

/**
 * Агрегат одного узла из его собственных полей и УЖЕ посчитанных агрегатов
 * прямых детей. O(число детей) — на этом держится инкрементальный пересчёт
 * по цепочке предков при live-патче.
 */
export function aggregateFromChildren(
  node: TreeNode,
  aggregates: Map<string, Aggregate>,
): Aggregate {
  let totalHeadcount = node.headcount;
  let totalBudget = node.budget;
  let weightedPerformance = node.headcount * node.performance;

  for (const child of node.children) {
    const childAggregate = aggregates.get(child.id);
    if (childAggregate) {
      totalHeadcount += childAggregate.totalHeadcount;
      totalBudget += childAggregate.totalBudget;
      weightedPerformance += childAggregate.weightedPerformance;
    }
  }

  return finishAggregate(totalHeadcount, totalBudget, weightedPerformance);
}

/**
 * Полная сборка модели: O(n). Узел с неизвестным parentId считается корнем,
 * чтобы битые ссылки не «теряли» данные молча.
 */
export function buildModel(nodes: readonly OrgNode[]): OrgModel {
  const byId = new Map<string, TreeNode>();
  for (const node of nodes) {
    byId.set(node.id, { ...node, level: 0, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId === null ? undefined : byId.get(node.parentId);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const order: string[] = [];
  const aggregates = new Map<string, Aggregate>();

  const visit = (node: TreeNode, level: number): void => {
    node.level = level;
    order.push(node.id);
    for (const child of node.children) {
      visit(child, level + 1);
    }
    // post-order: дети уже посчитаны
    aggregates.set(node.id, aggregateFromChildren(node, aggregates));
  };
  for (const root of roots) {
    visit(root, 1);
  }

  return { roots, byId, order, aggregates };
}

/**
 * Мемоизация «массив узлов → модель». Ключ — ссылка на массив, поэтому пока
 * кэш react-query возвращает тот же объект, модель не пересобирается.
 * Live-патч регистрирует модель для нового массива инкрементально (см. applyPatch).
 */
const modelCache = new WeakMap<readonly OrgNode[], OrgModel>();

export function getOrgModel(nodes: readonly OrgNode[]): OrgModel {
  const cached = modelCache.get(nodes);
  if (cached) {
    return cached;
  }
  const model = buildModel(nodes);
  modelCache.set(nodes, model);
  return model;
}

export function registerModel(nodes: readonly OrgNode[], model: OrgModel): void {
  modelCache.set(nodes, model);
}

const rowsCache = new WeakMap<OrgModel, AggregatedRow[]>();

/** Строки таблицы из модели; мемоизировано по ссылке на модель. */
export function rowsFromModel(model: OrgModel): AggregatedRow[] {
  const cached = rowsCache.get(model);
  if (cached) {
    return cached;
  }

  const rows = model.order.map((id): AggregatedRow => {
    const node = model.byId.get(id)!;
    const aggregate = model.aggregates.get(id)!;
    return {
      id,
      name: node.name,
      level: node.level,
      totalHeadcount: aggregate.totalHeadcount,
      totalBudget: aggregate.totalBudget,
      avgPerformance: aggregate.avgPerformance,
    };
  });
  rowsCache.set(model, rows);
  return rows;
}

/** Цепочка id предков от родителя к корню. */
export function ancestorIds(model: OrgModel, id: string): string[] {
  const result: string[] = [];
  let current = model.byId.get(id);
  while (current?.parentId) {
    const parent = model.byId.get(current.parentId);
    if (!parent) break;
    result.push(parent.id);
    current = parent;
  }
  return result;
}
