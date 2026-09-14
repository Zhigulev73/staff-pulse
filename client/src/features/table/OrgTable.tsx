import { type KeyboardEvent, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  COLUMNS,
  type ColumnKey,
  filterRows,
  type SortState,
  sortRows,
} from '@/features/table/columns';
import { FlashCell } from '@/features/highlights/FlashCell';
import { useDebouncedValue } from '@/features/table/useDebouncedValue';
import { formatBudget, formatHeadcount, formatPerformance } from '@/shared/model/format';
import { type AggregatedRow } from '@/shared/model/orgModel';
import { PerformanceDot } from '@/shared/ui/PerformanceDot';

export const FILTER_DEBOUNCE_MS = 250;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.sm};
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.md};
`;

const FilterInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surface};

  &::placeholder {
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const Counter = styled.span`
  white-space: nowrap;
  font-size: ${({ theme }) => theme.font.small};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Scroll = styled.div`
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
`;

const Th = styled.th<{ $align: 'left' | 'right' }>`
  padding: 0;
  text-align: ${({ $align }) => $align};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  vertical-align: bottom;
`;

const HeaderButton = styled.button<{ $active: boolean; $align: 'left' | 'right' }>`
  display: flex;
  width: 100%;
  justify-content: ${({ $align }) => ($align === 'right' ? 'flex-end' : 'flex-start')};
  align-items: flex-end;
  gap: ${({ theme }) => theme.space.xs};
  padding: 8px 10px;
  border: none;
  background: transparent;
  font-size: ${({ theme }) => theme.font.small};
  font-weight: 600;
  line-height: 1.2;
  text-align: ${({ $align }) => $align};
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textMuted)};
  cursor: pointer;
  user-select: none;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const SortMark = styled.span`
  width: 1em;
  display: inline-block;
`;

const Tr = styled.tr<{ $selected: boolean }>`
  cursor: pointer;
  outline-offset: -2px;
  background: ${({ theme, $selected }) => ($selected ? theme.colors.accentSoft : 'transparent')};
  box-shadow: ${({ theme, $selected }) =>
    $selected ? `inset 2px 0 0 ${theme.colors.accent}` : 'none'};

  &:hover {
    background: ${({ theme, $selected }) =>
      $selected ? theme.colors.accentSoft : theme.colors.surfaceRaised};
  }
`;

const Td = styled.td<{ $align: 'left' | 'right' }>`
  padding: 6px 10px;
  text-align: ${({ $align }) => $align};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;

const NameCell = styled.span<{ $level: number }>`
  display: inline-block;
  padding-left: ${({ $level }) => ($level - 1) * 16}px;
  font-weight: ${({ $level }) => ($level === 1 ? 600 : 400)};
`;

const Empty = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.space.xl};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
`;

interface OrgTableProps {
  rows: AggregatedRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Аналитическая таблица. По умолчанию строки идут в порядке дерева.
 * Сортировка: клик по заголовку — по возрастанию,
 * двойной клик — в обратном порядке. Фильтр по названию с дебаунсом 250 мс.
 */
export function OrgTable({ rows, selectedId, onSelect }: OrgTableProps) {
  const [filter, setFilter] = useState('');
  const debouncedFilter = useDebouncedValue(filter, FILTER_DEBOUNCE_MS);
  // null — порядок обхода дерева (иерархия читается по отступам), пока пользователь не выбрал столбец.
  const [sort, setSort] = useState<SortState | null>(null);

  const visibleRows = useMemo(() => {
    const filtered = filterRows(rows, debouncedFilter);
    return sort ? sortRows(filtered, sort) : filtered;
  }, [rows, debouncedFilter, sort]);

  const sortBy = (key: ColumnKey) => {
    // Одиночный клик выбирает столбец; направление уже активного столбца не трогаем,
    // иначе два клика двойного клика сбивали бы его.
    setSort((prev) => (prev?.key === key ? prev : { key, direction: 'asc' }));
  };

  const reverseSort = (key: ColumnKey) => {
    setSort((prev) => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Клавиатура: roving tabindex — в Tab-порядке одна строка, стрелки двигают фокус.
  const [focusedIndex, setFocusedIndex] = useState(0);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const activeIndex = Math.min(focusedIndex, Math.max(0, visibleRows.length - 1));

  const focusRow = (index: number) => {
    const row = visibleRows[index];
    if (!row) return;
    setFocusedIndex(index);
    rowRefs.current.get(row.id)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    const last = visibleRows.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        focusRow(Math.min(activeIndex + 1, last));
        break;
      case 'ArrowUp':
        focusRow(Math.max(activeIndex - 1, 0));
        break;
      case 'Home':
        focusRow(0);
        break;
      case 'End':
        focusRow(last);
        break;
      case 'Enter':
      case ' ': {
        const row = visibleRows[activeIndex];
        if (row) onSelect(row.id);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <Wrapper>
      <Toolbar>
        <FilterInput
          type="search"
          placeholder="Фильтр по названию…"
          aria-label="Фильтр по названию подразделения"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <Counter aria-live="polite">
          Показано {visibleRows.length} из {rows.length}
        </Counter>
      </Toolbar>

      {visibleRows.length === 0 ? (
        <Empty>Ничего не найдено</Empty>
      ) : (
        <Scroll>
          <Table role="grid" aria-label="Аналитическая таблица подразделений">
            <thead>
              <tr>
                {COLUMNS.map((column) => {
                  const active = sort?.key === column.key;
                  return (
                    <Th
                      key={column.key}
                      $align={column.align}
                      aria-sort={
                        active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                      }
                    >
                      <HeaderButton
                        type="button"
                        $active={active}
                        $align={column.align}
                        title="Клик — сортировать, двойной клик — в обратном порядке"
                        onClick={() => sortBy(column.key)}
                        onDoubleClick={() => reverseSort(column.key)}
                      >
                        {column.label}
                        <SortMark aria-hidden="true">
                          {active ? (sort?.direction === 'asc' ? '↑' : '↓') : ''}
                        </SortMark>
                      </HeaderButton>
                    </Th>
                  );
                })}
              </tr>
            </thead>
            <tbody onKeyDown={handleKeyDown}>
              {visibleRows.map((row, index) => (
                <Tr
                  key={row.id}
                  ref={(element) => {
                    if (element) rowRefs.current.set(row.id, element);
                    else rowRefs.current.delete(row.id);
                  }}
                  tabIndex={index === activeIndex ? 0 : -1}
                  $selected={row.id === selectedId}
                  aria-selected={row.id === selectedId}
                  data-row-id={row.id}
                  onFocus={() => setFocusedIndex(index)}
                  onClick={() => {
                    setFocusedIndex(index);
                    onSelect(row.id);
                  }}
                >
                  <Td $align="left" role="gridcell">
                    <NameCell $level={row.level}>{row.name}</NameCell>
                  </Td>
                  <Td $align="right" role="gridcell">
                    {row.level}
                  </Td>
                  <Td $align="right" role="gridcell">
                    <FlashCell nodeId={row.id} field="totalHeadcount">
                      {formatHeadcount(row.totalHeadcount)}
                    </FlashCell>
                  </Td>
                  <Td $align="right" role="gridcell">
                    <FlashCell nodeId={row.id} field="totalBudget">
                      {formatBudget(row.totalBudget)}
                    </FlashCell>
                  </Td>
                  <Td $align="right" role="gridcell">
                    <FlashCell nodeId={row.id} field="avgPerformance">
                      <PerformanceDot value={row.avgPerformance} withValue={false} />
                      {formatPerformance(row.avgPerformance)}
                    </FlashCell>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Scroll>
      )}
    </Wrapper>
  );
}
