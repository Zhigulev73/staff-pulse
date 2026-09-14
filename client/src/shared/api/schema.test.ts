import { describe, expect, it } from 'vitest';
import { orgTreeSchema, parseOrgTree } from '@/shared/api/schema';

const validNode = {
  id: 'n1',
  name: 'Дивизион «Продажи»',
  parentId: null,
  headcount: 10,
  budget: 1_000_000,
  performance: 75,
  updatedAt: '2026-09-14T10:00:00.000Z',
};

describe('orgTreeSchema', () => {
  it('принимает валидный массив узлов', () => {
    const result = orgTreeSchema.safeParse([validNode, { ...validNode, id: 'n2', parentId: 'n1' }]);
    expect(result.success).toBe(true);
  });

  it('принимает пустой массив', () => {
    expect(orgTreeSchema.safeParse([]).success).toBe(true);
  });

  it('отклоняет performance вне диапазона 0..100', () => {
    expect(orgTreeSchema.safeParse([{ ...validNode, performance: 150 }]).success).toBe(false);
  });

  it('отклоняет отрицательную численность и нецелые значения', () => {
    expect(orgTreeSchema.safeParse([{ ...validNode, headcount: -1 }]).success).toBe(false);
    expect(orgTreeSchema.safeParse([{ ...validNode, headcount: 1.5 }]).success).toBe(false);
  });

  it('отклоняет узел без name и не-массив', () => {
    const { name: _name, ...withoutName } = validNode;
    expect(orgTreeSchema.safeParse([withoutName]).success).toBe(false);
    expect(orgTreeSchema.safeParse({ nodes: [] }).success).toBe(false);
  });

  it('parseOrgTree бросает InvalidResponseError с описанием проблемы', () => {
    expect(() => parseOrgTree([{ ...validNode, performance: 150 }])).toThrowError(/performance/);
  });
});
