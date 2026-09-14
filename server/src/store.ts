import { generateOrgTree } from './generate.js';
import { type OrgNode } from './types.js';

export interface OrgStore {
  /** Текущий снимок узлов. Массив не мутируется снаружи. */
  getNodes(): readonly OrgNode[];
  /** Версия данных: растёт на 1 при каждом реальном изменении. */
  getVersion(): number;
}

/** In-memory хранилище орг-структуры. БД по заданию не нужна. */
export function createStore(seed?: number): OrgStore {
  const nodes = generateOrgTree({ seed });
  const version = 0;

  return {
    getNodes: () => nodes,
    getVersion: () => version,
  };
}
