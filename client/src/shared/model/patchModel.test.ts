import { describe, expect, it } from 'vitest';
import { type OrgNode } from '@/shared/api/schema';
import { buildModel, rowsFromModel } from '@/shared/model/orgModel';
import { patchModel } from '@/shared/model/patchModel';
import { makeNode } from '@/shared/model/orgModel.test';

/** Детерминированный PRNG для воспроизводимых «случайных» патчей. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate(rand: () => number): OrgNode[] {
  const nodes: OrgNode[] = [];
  let counter = 0;
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const push = (parentId: string | null) => {
    counter += 1;
    const node = makeNode({
      id: `n${counter}`,
      parentId,
      headcount: int(0, 20),
      budget: int(0, 1_000_000),
      performance: int(0, 100),
    });
    nodes.push(node);
    return node;
  };
  for (let d = 0; d < 3; d += 1) {
    const division = push(null);
    for (let p = 0; p < int(2, 4); p += 1) {
      const department = push(division.id);
      for (let t = 0; t < int(1, 4); t += 1) push(department.id);
    }
  }
  return nodes;
}

const sample: OrgNode[] = [
  makeNode({ id: 'div', headcount: 5, budget: 1_000_000, performance: 80 }),
  makeNode({ id: 'dep', parentId: 'div', headcount: 3, budget: 500_000, performance: 60 }),
  makeNode({ id: 'team', parentId: 'dep', headcount: 2, budget: 200_000, performance: 90 }),
  makeNode({ id: 'dep2', parentId: 'div', headcount: 1, budget: 10, performance: 10 }),
  makeNode({ id: 'div2', headcount: 4, budget: 40, performance: 40 }),
];

describe('patchModel', () => {
  it('пересчитывает агрегаты изменённого узла и всех его предков', () => {
    const prev = buildModel(sample);
    const changed = { ...sample[2]!, headcount: 12, performance: 100 };

    const { model, touchedIds } = patchModel(prev, changed);

    expect(touchedIds).toEqual(['team', 'dep', 'div']);
    expect(model.aggregates.get('team')).toMatchObject({ totalHeadcount: 12, avgPerformance: 100 });
    expect(model.aggregates.get('dep')).toMatchObject({ totalHeadcount: 15 });
    expect(model.aggregates.get('div')?.totalHeadcount).toBe(21);
    // (5·80 + 3·60 + 12·100 + 1·10) / 21
    expect(model.aggregates.get('div')?.avgPerformance).toBeCloseTo(1790 / 21);
  });

  it('не трогает соседние поддеревья: их узлы, агрегаты и строки — те же объекты', () => {
    const prev = buildModel(sample);
    const prevRows = rowsFromModel(prev);
    const changed = { ...sample[2]!, budget: 999 };

    const { model } = patchModel(prev, changed);
    const rows = rowsFromModel(model);

    expect(model.byId.get('dep2')).toBe(prev.byId.get('dep2'));
    expect(model.byId.get('div2')).toBe(prev.byId.get('div2'));
    expect(model.roots[1]).toBe(prev.roots[1]);
    expect(model.aggregates.get('div2')).toBe(prev.aggregates.get('div2'));
    expect(rows[3]).toBe(prevRows[3]); // dep2
    expect(rows[4]).toBe(prevRows[4]); // div2
    expect(rows[2]).not.toBe(prevRows[2]); // team
    expect(rows[0]).not.toBe(prevRows[0]); // div
    expect(model.order).toBe(prev.order);
  });

  it('не мутирует предыдущую модель', () => {
    const prev = buildModel(sample);
    const before = prev.aggregates.get('div')?.totalBudget;

    patchModel(prev, { ...sample[2]!, budget: 0 });

    expect(prev.aggregates.get('div')?.totalBudget).toBe(before);
    expect(prev.byId.get('team')?.budget).toBe(200_000);
  });

  it('совпадает с полной пересборкой на 300 случайных патчах', () => {
    const rand = mulberry32(42);
    let nodes = generate(rand);
    let model = buildModel(nodes);

    for (let i = 0; i < 300; i += 1) {
      const index = Math.floor(rand() * nodes.length);
      const changed: OrgNode = {
        ...nodes[index]!,
        headcount: Math.floor(rand() * 30),
        budget: Math.floor(rand() * 2_000_000),
        performance: Math.floor(rand() * 101),
      };
      nodes = nodes.map((n, j) => (j === index ? changed : n));
      model = patchModel(model, changed).model;

      const expected = buildModel(nodes);
      for (const id of expected.order) {
        const a = model.aggregates.get(id)!;
        const e = expected.aggregates.get(id)!;
        expect(a.totalHeadcount).toBe(e.totalHeadcount);
        expect(a.totalBudget).toBe(e.totalBudget);
        expect(a.avgPerformance).toBeCloseTo(e.avgPerformance, 9);
      }
      expect(model.order).toEqual(expected.order);
    }
  });

  it('патч для неизвестного узла возвращает ту же модель без затронутых id', () => {
    const prev = buildModel(sample);
    const result = patchModel(prev, makeNode({ id: 'ghost', headcount: 1 }));
    expect(result.model).toBe(prev);
    expect(result.touchedIds).toEqual([]);
  });
});
