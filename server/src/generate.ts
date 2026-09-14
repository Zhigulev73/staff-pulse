import { createIntPicker, createRng } from './rng.js';
import { type OrgNode } from './types.js';

const DIVISIONS = ['Продажи', 'Разработка', 'Маркетинг', 'Операции'];

const DEPARTMENTS: Record<string, string[]> = {
  Продажи: ['Корпоративные клиенты', 'Розница', 'Партнёрская сеть', 'Клиентский сервис'],
  Разработка: ['Платформа', 'Мобильные продукты', 'Инфраструктура', 'Данные и ML'],
  Маркетинг: ['Бренд', 'Performance-маркетинг', 'Контент', 'Исследования'],
  Операции: ['Логистика', 'Закупки', 'Качество', 'Поддержка'],
};

const TEAM_NAMES = [
  'Команда роста',
  'Команда интеграций',
  'Команда автоматизации',
  'Команда аналитики',
  'Команда UX',
  'Команда регионов',
  'Команда партнёрств',
  'Команда качества',
  'Команда онбординга',
  'Команда сопровождения',
];

export interface GenerateOptions {
  seed?: number;
  now?: () => string;
}

/**
 * Генерирует плоский список узлов: 4 дивизиона × 3–4 отдела × 2–4 команды
 * (≈60 узлов, ровно три уровня). Результат детерминирован по seed.
 */
export function generateOrgTree(options: GenerateOptions = {}): OrgNode[] {
  const rng = createRng(options.seed ?? 20260914);
  const int = createIntPicker(rng);
  const now = options.now ?? (() => new Date().toISOString());
  const nodes: OrgNode[] = [];
  const teamNameUses = new Map<string, number>();
  let counter = 0;

  const push = (
    name: string,
    parentId: string | null,
    headcount: [number, number],
    perCapita: [number, number],
  ): OrgNode => {
    counter += 1;
    const hc = int(...headcount);
    const node: OrgNode = {
      id: `n${counter}`,
      name,
      parentId,
      headcount: hc,
      budget: hc * int(...perCapita) * 1000,
      performance: int(38, 98),
      updatedAt: now(),
    };
    nodes.push(node);
    return node;
  };

  for (const divisionName of DIVISIONS) {
    const division = push(`Дивизион «${divisionName}»`, null, [6, 14], [1200, 1800]);
    const departmentNames = [...(DEPARTMENTS[divisionName] ?? [])];
    const departmentCount = int(3, departmentNames.length);

    for (let d = 0; d < departmentCount; d += 1) {
      const departmentName = departmentNames.splice(int(0, departmentNames.length - 1), 1)[0];
      const department = push(`Отдел «${departmentName}»`, division.id, [4, 10], [900, 1400]);
      const teamCount = int(2, 4);
      const teamNames = [...TEAM_NAMES];

      for (let t = 0; t < teamCount; t += 1) {
        const baseName = teamNames.splice(int(0, teamNames.length - 1), 1)[0] ?? 'Команда';
        // Одинаковые названия в разных отделах получают порядковый номер, чтобы
        // строки таблицы различались без обращения к дереву.
        const uses = (teamNameUses.get(baseName) ?? 0) + 1;
        teamNameUses.set(baseName, uses);
        push(uses === 1 ? baseName : `${baseName} ${uses}`, department.id, [3, 16], [600, 1100]);
      }
    }
  }

  return nodes;
}
