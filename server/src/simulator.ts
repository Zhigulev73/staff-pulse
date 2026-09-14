import { type OrgStore } from './store.js';
import { type MutableField, type OrgNode } from './types.js';

export interface SimulatorOptions {
  /** Пауза между изменениями, мс. По умолчанию 2–5 с. */
  minIntervalMs?: number;
  maxIntervalMs?: number;
}

const FIELDS: MutableField[] = ['headcount', 'budget', 'performance'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Небольшой дрейф одного поля: численность ±1..3, бюджет ±8 %, эффективность ±8. */
function drift(node: OrgNode, field: MutableField): number {
  switch (field) {
    case 'headcount':
      return Math.max(1, node.headcount + Math.round(randomBetween(-3, 3)));
    case 'budget':
      return Math.max(0, Math.round(node.budget * (1 + randomBetween(-0.08, 0.08))));
    case 'performance':
      return clamp(Math.round(node.performance + randomBetween(-8, 8)), 0, 100);
  }
}

/**
 * Имитация «живых» изменений: раз в 2–5 с меняет 1–2 поля случайного узла.
 * Работает независимо от наличия подключённых клиентов, чтобы стор оставался
 * согласованным с тем, что вернёт GET /api/org-tree после переподключения.
 */
export function startSimulator(store: OrgStore, options: SimulatorOptions = {}): () => void {
  const min = options.minIntervalMs ?? 2000;
  const max = options.maxIntervalMs ?? 5000;
  let timer: NodeJS.Timeout | undefined;

  const tick = () => {
    const nodes = store.getNodes();
    const node = nodes[Math.floor(Math.random() * nodes.length)];
    if (node) {
      const fieldCount = Math.random() < 0.3 ? 2 : 1;
      const fields = [...FIELDS].sort(() => Math.random() - 0.5).slice(0, fieldCount);
      const changes: Partial<Pick<OrgNode, MutableField>> = {};
      for (const field of fields) {
        const next = drift(node, field);
        if (next !== node[field]) changes[field] = next;
      }
      if (Object.keys(changes).length > 0) {
        store.applyChange(node.id, changes);
      }
    }
    timer = setTimeout(tick, randomBetween(min, max));
  };

  timer = setTimeout(tick, randomBetween(min, max));
  return () => clearTimeout(timer);
}
