import { describe, expect, it } from 'vitest';
import { type OrgPatch } from '@/shared/api/schema';
import { applyPatch } from '@/shared/model/applyPatch';
import { buildModel, getOrgModel } from '@/shared/model/orgModel';
import { makeNode } from '@/shared/model/orgModel.test';

const nodes = [
  makeNode({ id: 'div', headcount: 5, budget: 100, performance: 80 }),
  makeNode({ id: 'dep', parentId: 'div', headcount: 3, budget: 50, performance: 60 }),
  makeNode({ id: 'team', parentId: 'dep', headcount: 2, budget: 20, performance: 90 }),
];

const patch = (overrides: Partial<OrgPatch> = {}): OrgPatch => ({
  seq: 1,
  nodeId: 'team',
  changes: { headcount: 4 },
  updatedAt: '2026-09-14T12:00:00.000Z',
  etag: '"v1"',
  ...overrides,
});

describe('applyPatch', () => {
  it('заменяет только объект изменённого узла и обновляет etag', () => {
    const cache = { nodes, etag: '"v0"' };

    const { cache: next, touchedIds, changedFields } = applyPatch(cache, patch());

    expect(next.etag).toBe('"v1"');
    expect(next.nodes).not.toBe(nodes);
    expect(next.nodes[0]).toBe(nodes[0]);
    expect(next.nodes[1]).toBe(nodes[1]);
    expect(next.nodes[2]).toMatchObject({ headcount: 4, updatedAt: '2026-09-14T12:00:00.000Z' });
    expect(touchedIds).toEqual(['team', 'dep', 'div']);
    expect(changedFields).toEqual(['headcount']);
  });

  it('регистрирует инкрементальную модель, совпадающую с полной сборкой', () => {
    const cache = { nodes, etag: null };
    const { cache: next } = applyPatch(cache, patch({ changes: { budget: 999, performance: 10 } }));

    const model = getOrgModel(next.nodes);
    const expected = buildModel(next.nodes);

    expect(model.aggregates.get('div')).toEqual(expected.aggregates.get('div'));
    expect(model.byId.get('team')).toMatchObject({ budget: 999, performance: 10 });
  });

  it('игнорирует патч для неизвестного узла', () => {
    const cache = { nodes, etag: '"v0"' };
    const result = applyPatch(cache, patch({ nodeId: 'ghost' }));

    expect(result.cache).toBe(cache);
    expect(result.touchedIds).toEqual([]);
  });

  it('патч без реальных изменений сохраняет ссылки на узлы', () => {
    const cache = { nodes, etag: '"v0"' };
    const result = applyPatch(cache, patch({ changes: { headcount: 2 } }));

    expect(result.cache.nodes).toBe(nodes);
    expect(result.cache.etag).toBe('"v1"');
    expect(result.changedFields).toEqual([]);
  });
});
