import { type MutableField, type OrgNode, type OrgPatch } from '@/shared/api/schema';
import { type OrgTreeCache } from '@/shared/api/useOrgTree';
import { getOrgModel, registerModel } from '@/shared/model/orgModel';
import { patchModel } from '@/shared/model/patchModel';

export interface ApplyPatchResult {
  cache: OrgTreeCache;
  /** Изменённый узел и его предки (см. patchModel). Пусто, если патч не применён. */
  touchedIds: string[];
  /** Поля, значения которых реально изменились. */
  changedFields: MutableField[];
}

const FIELDS: MutableField[] = ['headcount', 'budget', 'performance'];

/**
 * Применяет live-патч к значению кэша react-query.
 *
 * Возвращает новый массив узлов, в котором заменён только объект изменённого
 * узла; остальные ссылки сохранены. Модель для нового массива регистрируется
 * сразу, инкрементально (`patchModel`), поэтому `getOrgModel(nextNodes)` не
 * будет пересобирать дерево с нуля. Если узел неизвестен или значения не
 * изменились, возвращается прежний объект кэша.
 */
export function applyPatch(cache: OrgTreeCache, patch: OrgPatch): ApplyPatchResult {
  const index = cache.nodes.findIndex((node) => node.id === patch.nodeId);
  if (index === -1) {
    return { cache, touchedIds: [], changedFields: [] };
  }

  const current = cache.nodes[index]!;
  const changedFields = FIELDS.filter(
    (field) => patch.changes[field] !== undefined && patch.changes[field] !== current[field],
  );
  if (changedFields.length === 0) {
    return { cache: { ...cache, etag: patch.etag }, touchedIds: [], changedFields: [] };
  }

  const next: OrgNode = { ...current, updatedAt: patch.updatedAt };
  for (const field of changedFields) {
    next[field] = patch.changes[field]!;
  }

  const nodes = cache.nodes.slice();
  nodes[index] = next;

  const { model, touchedIds } = patchModel(getOrgModel(cache.nodes), next);
  registerModel(nodes, model);

  return { cache: { nodes, etag: patch.etag }, touchedIds, changedFields };
}
