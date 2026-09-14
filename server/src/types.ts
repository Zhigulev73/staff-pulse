/** Узел орг-структуры в плоском ответе API. */
export interface OrgNode {
  id: string;
  name: string;
  /** null у корневых узлов (дивизионов). */
  parentId: string | null;
  /** Собственная численность узла, без потомков. */
  headcount: number;
  /** Собственный бюджет узла в рублях, без потомков. */
  budget: number;
  /** Эффективность 0..100. */
  performance: number;
  /** ISO-8601. */
  updatedAt: string;
}

/** Поля узла, которые могут меняться live-патчем. */
export type MutableField = 'headcount' | 'budget' | 'performance';

/** Патч, который сервер рассылает по SSE после изменения одного узла. */
export interface OrgPatch {
  /** Монотонный номер события; совпадает с версией стора после применения. */
  seq: number;
  nodeId: string;
  changes: Partial<Pick<OrgNode, MutableField>>;
  updatedAt: string;
  /** ETag снимка после применения патча — клиент обновляет им свой If-None-Match. */
  etag: string;
}
