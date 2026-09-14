import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import { OrgTree } from '@/features/tree/OrgTree';
import { type OrgNode } from '@/shared/api/schema';
import { buildModel } from '@/shared/model/orgModel';
import { theme } from '@/shared/theme/theme';

function node(overrides: Partial<OrgNode> & { id: string; name: string }): OrgNode {
  return {
    parentId: null,
    headcount: 5,
    budget: 100,
    performance: 80,
    updatedAt: '2026-09-14T10:00:00.000Z',
    ...overrides,
  };
}

const model = buildModel([
  node({ id: 'div', name: 'Дивизион' }),
  node({ id: 'dep', name: 'Отдел', parentId: 'div', headcount: 7, performance: 65 }),
  node({ id: 'team', name: 'Команда', parentId: 'dep', performance: 40 }),
]);

function renderTree(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('OrgTree', () => {
  it('показывает второй уровень, а третий держит свёрнутым', () => {
    renderTree(
      <OrgTree
        model={model}
        expandedIds={new Set(['div'])}
        selectedId={null}
        onToggle={() => {}}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByRole('treeitem', { name: /Дивизион/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('treeitem', { name: /Отдел/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    // Свёрнутая ветка исключена из дерева доступности и недоступна для фокуса.
    expect(screen.queryByRole('treeitem', { name: /Команда/ })).not.toBeInTheDocument();
    expect(screen.getByText('Команда').closest('[inert]')).not.toBeNull();
  });

  it('выводит численность и индикатор эффективности', () => {
    renderTree(
      <OrgTree
        model={model}
        expandedIds={new Set(['div'])}
        selectedId={null}
        onToggle={() => {}}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText('7 чел.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Эффективность 80 из 100' })).toBeInTheDocument();
  });

  it('кнопка раскрытия вызывает onToggle, клик по строке — onSelect', async () => {
    const onToggle = vi.fn();
    const onSelect = vi.fn();
    renderTree(
      <OrgTree
        model={model}
        expandedIds={new Set(['div'])}
        selectedId={null}
        onToggle={onToggle}
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Развернуть Отдел' }));
    expect(onToggle).toHaveBeenCalledWith('dep');
    expect(onSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Отдел'));
    expect(onSelect).toHaveBeenCalledWith('dep');
  });

  it('помечает выбранный узел через aria-selected', () => {
    renderTree(
      <OrgTree
        model={model}
        expandedIds={new Set(['div'])}
        selectedId="dep"
        onToggle={() => {}}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByRole('treeitem', { name: /Отдел/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('treeitem', { name: /Дивизион/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });
});
