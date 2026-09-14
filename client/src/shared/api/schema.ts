import { z } from 'zod';

/**
 * Схема узла орг-структуры. Валидируется на клиенте: любое расхождение с
 * контрактом (лишний/отсутствующий атрибут, значение вне диапазона) —
 * это ошибка запроса, а не тихо испорченные данные в UI.
 */
export const orgNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  headcount: z.int().min(0),
  budget: z.number().min(0),
  performance: z.number().min(0).max(100),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const orgTreeSchema = z.array(orgNodeSchema);

export type OrgNode = z.infer<typeof orgNodeSchema>;

/** Ответ API не соответствует контракту. */
export class InvalidResponseError extends Error {
  constructor(details: string) {
    super(`Ответ API не соответствует схеме: ${details}`);
    this.name = 'InvalidResponseError';
  }
}

/** Компактное описание первых проблем валидации: `[0].performance: Too big…`. */
function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.message}`)
    .join('; ');
}

export function parseOrgTree(json: unknown): OrgNode[] {
  const result = orgTreeSchema.safeParse(json);
  if (!result.success) {
    throw new InvalidResponseError(describeIssues(result.error));
  }
  return result.data;
}
