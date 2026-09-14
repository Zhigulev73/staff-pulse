import { describe, expect, it } from 'vitest';
import { type OrgNode } from '@/shared/api/schema';
import { buildModel, getOrgModel, rowsFromModel } from '@/shared/model/orgModel';

export function makeNode(overrides: Partial<OrgNode> & { id: string }): OrgNode {
  return {
    name: overrides.id,
    parentId: null,
    headcount: 0,
    budget: 0,
    performance: 0,
    updatedAt: '2026-09-14T10:00:00.000Z',
    ...overrides,
  };
}

const sample: OrgNode[] = [
  makeNode({ id: 'div', headcount: 5, budget: 1_000_000, performance: 80 }),
  makeNode({ id: 'dep', parentId: 'div', headcount: 3, budget: 500_000, performance: 60 }),
  makeNode({ id: 'team', parentId: 'dep', headcount: 2, budget: 200_000, performance: 90 }),
  makeNode({ id: 'div2', headcount: 1, budget: 10, performance: 10 }),
];

describe('buildModel', () => {
  it('суммирует численность и бюджет узла и всех его потомков', () => {
    const { aggregates } = buildModel(sample);

    expect(aggregates.get('team')).toMatchObject({ totalHeadcount: 2, totalBudget: 200_000 });
    expect(aggregates.get('dep')).toMatchObject({ totalHeadcount: 5, totalBudget: 700_000 });
    expect(aggregates.get('div')).toMatchObject({ totalHeadcount: 10, totalBudget: 1_700_000 });
  });

  it('считает среднюю эффективность взвешенно по headcount, а не простым средним', () => {
    const nodes = [
      makeNode({ id: 'p', headcount: 0, performance: 0 }),
      makeNode({ id: 'big', parentId: 'p', headcount: 90, performance: 100 }),
      makeNode({ id: 'small', parentId: 'p', headcount: 10, performance: 0 }),
    ];

    const { aggregates } = buildModel(nodes);

    // Простое среднее [0, 100, 0] = 33; взвешенное = 90.
    expect(aggregates.get('p')?.avgPerformance).toBeCloseTo(90);
  });

  it('взвешенное среднее для примера: (5·80 + 3·60 + 2·90) / 10 = 76', () => {
    expect(buildModel(sample).aggregates.get('div')?.avgPerformance).toBeCloseTo(76);
  });

  it('возвращает 0 эффективности при нулевой численности', () => {
    const { aggregates } = buildModel([makeNode({ id: 'x', headcount: 0, performance: 50 })]);
    expect(aggregates.get('x')?.avgPerformance).toBe(0);
  });

  it('проставляет уровни от 1 у корней и строит children в порядке входа', () => {
    const model = buildModel(sample);

    expect(model.byId.get('div')?.level).toBe(1);
    expect(model.byId.get('dep')?.level).toBe(2);
    expect(model.byId.get('team')?.level).toBe(3);
    expect(model.roots.map((n) => n.id)).toEqual(['div', 'div2']);
    expect(model.byId.get('div')?.children.map((n) => n.id)).toEqual(['dep']);
  });

  it('узел с неизвестным parentId становится корнем (данные не теряются)', () => {
    const model = buildModel([makeNode({ id: 'orphan', parentId: 'missing', headcount: 1 })]);

    expect(model.roots.map((n) => n.id)).toEqual(['orphan']);
    expect(model.byId.get('orphan')?.level).toBe(1);
  });

  it('обрабатывает пустой список', () => {
    const model = buildModel([]);
    expect(model.roots).toEqual([]);
    expect(rowsFromModel(model)).toEqual([]);
  });
});

describe('rowsFromModel', () => {
  it('даёт одну строку на узел в порядке обхода в глубину', () => {
    const rows = rowsFromModel(buildModel(sample));

    expect(rows.map((r) => r.id)).toEqual(['div', 'dep', 'team', 'div2']);
    expect(rows[1]).toEqual({
      id: 'dep',
      name: 'dep',
      level: 2,
      totalHeadcount: 5,
      totalBudget: 700_000,
      avgPerformance: 72,
    });
  });
});

describe('getOrgModel', () => {
  it('мемоизирует модель по ссылке на массив узлов', () => {
    expect(getOrgModel(sample)).toBe(getOrgModel(sample));
    expect(getOrgModel([...sample])).not.toBe(getOrgModel(sample));
  });

  it('мемоизирует строки по ссылке на модель', () => {
    const model = getOrgModel(sample);
    expect(rowsFromModel(model)).toBe(rowsFromModel(model));
  });
});
