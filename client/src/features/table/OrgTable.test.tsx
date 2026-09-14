import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrgTable } from '@/features/table/OrgTable';
import { type AggregatedRow } from '@/shared/model/orgModel';
import { theme } from '@/shared/theme/theme';

const rows: AggregatedRow[] = [
  {
    id: 'div',
    name: 'Дивизион «Продажи»',
    level: 1,
    totalHeadcount: 30,
    totalBudget: 12_345_678,
    avgPerformance: 71.4,
  },
  {
    id: 'dep',
    name: 'Отдел «Розница»',
    level: 2,
    totalHeadcount: 12,
    totalBudget: 4_000_000,
    avgPerformance: 60,
  },
  {
    id: 'team',
    name: 'Команда роста',
    level: 3,
    totalHeadcount: 5,
    totalBudget: 9_000_000,
    avgPerformance: 90,
  },
];

const plain = (value: string | null) => (value ?? '').replace(/[\u00A0\u202F]/g, ' ');

function renderTable(props: Partial<Parameters<typeof OrgTable>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <OrgTable rows={rows} selectedId={null} onSelect={onSelect} {...props} />
    </ThemeProvider>,
  );
  return { onSelect };
}

const bodyRowNames = () =>
  within(screen.getAllByRole('rowgroup')[1]!)
    .getAllByRole('row')
    .map((r) => within(r).getAllByRole('gridcell')[0]!.textContent);

describe('OrgTable', () => {
  it('показывает столбцы и форматирует бюджет как «12 345 678 руб.»', () => {
    renderTable();

    for (const label of [
      'Подразделение',
      'Уровень',
      'Всего сотрудников',
      'Бюджет суммарный',
      'Средняя эффективность',
    ]) {
      expect(screen.getByRole('columnheader', { name: new RegExp(label) })).toBeInTheDocument();
    }
    const first = within(screen.getAllByRole('rowgroup')[1]!).getAllByRole('row')[0]!;
    const cells = within(first)
      .getAllByRole('gridcell')
      .map((c) => plain(c.textContent));
    expect(cells).toEqual(['Дивизион «Продажи»', '1', '30', '12 345 678 руб.', '71']);
  });

  it('по умолчанию сохраняет порядок дерева и не помечает столбцы отсортированными', () => {
    renderTable();

    expect(bodyRowNames()).toEqual(['Дивизион «Продажи»', 'Отдел «Розница»', 'Команда роста']);
    expect(screen.getByRole('columnheader', { name: /Подразделение/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it('клик по заголовку сортирует по возрастанию, двойной клик — в обратном порядке', async () => {
    const user = userEvent.setup();
    renderTable();
    const header = screen.getByRole('button', { name: /Бюджет суммарный/ });

    await user.click(header);
    expect(bodyRowNames()).toEqual(['Отдел «Розница»', 'Команда роста', 'Дивизион «Продажи»']);
    expect(screen.getByRole('columnheader', { name: /Бюджет/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await user.dblClick(header);
    expect(bodyRowNames()).toEqual(['Дивизион «Продажи»', 'Команда роста', 'Отдел «Розница»']);
    expect(screen.getByRole('columnheader', { name: /Бюджет/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('клик по строке выбирает узел и помечает его aria-selected', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderTable({ selectedId: 'dep' });

    expect(screen.getByRole('row', { name: /Розница/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByText('Команда роста'));
    expect(onSelect).toHaveBeenCalledWith('team');
  });

  describe('фильтр', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('применяется через 250 мс после ввода и показывает счётчик', () => {
      renderTable();

      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'розн' } });
      // До истечения дебаунса список не менялся.
      expect(bodyRowNames()).toHaveLength(3);

      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(bodyRowNames()).toEqual(['Отдел «Розница»']);
      expect(screen.getByText('Показано 1 из 3')).toBeInTheDocument();
    });

    it('при отсутствии совпадений показывает сообщение', () => {
      renderTable();

      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'нет такого' } });
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
    });
  });
});
