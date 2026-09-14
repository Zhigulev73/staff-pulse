import { generateOrgTree } from './generate.js';
import { type MutableField, type OrgNode, type OrgPatch } from './types.js';

/** Сколько последних патчей помним для досылки переподключившимся клиентам. */
export const PATCH_BUFFER_SIZE = 200;

export interface OrgStore {
  /** Текущий снимок узлов. Массив не мутируется снаружи. */
  getNodes(): readonly OrgNode[];
  /** Версия данных = seq последнего применённого патча; растёт на 1 при каждом изменении. */
  getVersion(): number;
  /** Применяет изменение к узлу, возвращает патч для рассылки. null — узел не найден. */
  applyChange(nodeId: string, changes: Partial<Pick<OrgNode, MutableField>>): OrgPatch | null;
  /**
   * Патчи с seq > afterSeq. null — история уже вытеснена из буфера
   * (или afterSeq из «будущего»): клиенту нужен полный рефетч.
   */
  getPatchesAfter(afterSeq: number): OrgPatch[] | null;
  /** Подписка на новые патчи; возвращает функцию отписки. */
  subscribe(listener: (patch: OrgPatch) => void): () => void;
}

/** ETag снимка данных для заданной версии. Единственное место, где задан формат. */
export const formatEtag = (version: number): string => `"v${version}"`;

/** In-memory хранилище орг-структуры. БД по заданию не нужна. */
export function createStore(seed?: number): OrgStore {
  const nodes = generateOrgTree({ seed });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const listeners = new Set<(patch: OrgPatch) => void>();
  const patches: OrgPatch[] = [];
  let version = 0;

  return {
    getNodes: () => nodes,
    getVersion: () => version,

    applyChange(nodeId, changes) {
      const node = byId.get(nodeId);
      if (!node) return null;

      version += 1;
      const updatedAt = new Date().toISOString();
      Object.assign(node, changes, { updatedAt });

      const patch: OrgPatch = {
        seq: version,
        nodeId,
        changes,
        updatedAt,
        etag: formatEtag(version),
      };
      patches.push(patch);
      if (patches.length > PATCH_BUFFER_SIZE) {
        patches.shift();
      }
      for (const listener of listeners) {
        listener(patch);
      }
      return patch;
    },

    getPatchesAfter(afterSeq) {
      if (afterSeq > version) return null;
      if (afterSeq === version) return [];
      const oldest = patches[0];
      // Буфер должен содержать патч afterSeq + 1, иначе часть истории потеряна.
      if (!oldest || oldest.seq > afterSeq + 1) return null;
      return patches.filter((patch) => patch.seq > afterSeq);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
