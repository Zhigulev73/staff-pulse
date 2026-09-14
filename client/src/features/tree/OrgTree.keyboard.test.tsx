import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import { OrgTree } from '@/features/tree/OrgTree';
import { type OrgNode } from '@/shared/api/schema';
import { buildModel } from '@/shared/model/orgModel';
import { theme } from '@/shared/theme/theme';

const node = (id: string, name: string, parentId: string | null = null): OrgNode => ({
  id,
  name,
  parentId,
  headcount: 1,
  budget: 1,
  performance: 50,
  updatedAt: '2026-09-14T10:00:00.000Z',
});

const model = buildModel([
  node('div', 'Дивизион'),
  node('dep', 'Отдел', 'div'),
  node('team', 'Команда', 'dep'),
  node('div2', 'Дивизион 2'),
]);

function renderTree(expandedIds: Set<string>, selectedId: string | null = null) {
  const onToggle = vi.fn();
  const onSelect = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <OrgTree
        model={model}
        expandedIds={expandedIds}
        selectedId={selectedId}
        onToggle={onToggle}
        onSelect={onSelect}
      />
    </ThemeProvider>,
  );
  return { onToggle, onSelect };
}

const item = (name: string) => screen.getByRole('treeitem', { name });

describe('OrgTree: клавиатура', () => {
  it('в Tab-порядке ровно один узел — первый корень', async () => {
    renderTree(new Set(['div']));

    await userEvent.tab();
    expect(item('Дивизион')).toHaveFocus();
    expect(item('Отдел')).toHaveAttribute('tabindex', '-1');
  });

  it('стрелки вниз/вверх ходят по видимым узлам, Home/End — к краям', async () => {
    renderTree(new Set(['div']));
    await userEvent.tab();

    await userEvent.keyboard('{ArrowDown}');
    expect(item('Отдел')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}'); // team скрыт — переходим к div2
    expect(item('Дивизион 2')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(item('Отдел')).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(item('Дивизион')).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(item('Дивизион 2')).toHaveFocus();
  });

  it('→ раскрывает свёрнутый узел, ← сворачивает раскрытый или уводит к родителю', async () => {
    const { onToggle } = renderTree(new Set(['div']));
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}'); // Отдел (свёрнут)

    await userEvent.keyboard('{ArrowRight}');
    expect(onToggle).toHaveBeenLastCalledWith('dep');

    await userEvent.keyboard('{ArrowLeft}'); // всё ещё свёрнут (controlled) → к родителю
    expect(item('Дивизион')).toHaveFocus();

    await userEvent.keyboard('{ArrowLeft}'); // раскрыт → свернуть
    expect(onToggle).toHaveBeenLastCalledWith('div');
  });

  it('Enter и пробел выбирают узел', async () => {
    const { onSelect } = renderTree(new Set(['div']));
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('dep');
    await userEvent.keyboard(' ');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('выбранный снаружи узел становится точкой входа для Tab', async () => {
    renderTree(new Set(['div']), 'dep');
    await userEvent.tab();
    expect(item('Отдел')).toHaveFocus();
  });
});
