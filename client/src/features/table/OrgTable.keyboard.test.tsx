import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import { OrgTable } from '@/features/table/OrgTable';
import { type AggregatedRow } from '@/shared/model/orgModel';
import { theme } from '@/shared/theme/theme';

const rows: AggregatedRow[] = ['Альфа', 'Бета', 'Гамма'].map((name, i) => ({
  id: `r${i}`,
  name,
  level: 1,
  totalHeadcount: i,
  totalBudget: i,
  avgPerformance: 50,
}));

function renderTable() {
  const onSelect = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <OrgTable rows={rows} selectedId={null} onSelect={onSelect} />
    </ThemeProvider>,
  );
  return { onSelect };
}

const row = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('OrgTable: клавиатура', () => {
  it('стрелки и Home/End двигают фокус по строкам', async () => {
    renderTable();
    expect(row('Альфа')).toHaveAttribute('tabindex', '0');
    row('Альфа').focus();
    expect(row('Альфа')).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(row('Бета')).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(row('Гамма')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}'); // на краю остаёмся
    expect(row('Гамма')).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(row('Альфа')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(row('Альфа')).toHaveFocus();
  });

  it('Enter выбирает строку в фокусе', async () => {
    const { onSelect } = renderTable();
    row('Бета').focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('r1');
  });

  it('только одна строка в Tab-порядке', () => {
    renderTable();
    const tabbable = screen.getAllByRole('row').filter((r) => r.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
  });
});
