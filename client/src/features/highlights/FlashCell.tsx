import { type ReactNode, useSyncExternalStore } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { type CellField, cellKey, highlightStore } from '@/features/highlights/cellHighlights';

const flash = keyframes`
  from { background-color: var(--flash-color); }
  to   { background-color: transparent; }
`;

const Flash = styled.span<{ $active: boolean }>`
  --flash-color: ${({ theme }) => theme.colors.flash};
  display: inline-block;
  margin: -2px -6px;
  padding: 2px 6px;
  border-radius: ${({ theme }) => theme.radius.sm};
  ${({ $active, theme }) =>
    $active &&
    css`
      animation: ${flash} ${theme.duration.flash} ease-out;
    `}

  /* Без анимаций подсветка держится статично, пока запись живёт в хранилище (~1.5 с). */
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background-color: ${({ $active }) => ($active ? 'var(--flash-color)' : 'transparent')};
  }
`;

interface FlashCellProps {
  nodeId: string;
  field: CellField;
  children: ReactNode;
}

/**
 * Обёртка ячейки, которая «вспыхивает» и затухает ~1.5 с после live-обновления.
 * Метка подсветки становится React-ключом: новое обновление той же ячейки
 * перемонтирует элемент и перезапускает CSS-анимацию.
 */
export function FlashCell({ nodeId, field, children }: FlashCellProps) {
  const key = cellKey(nodeId, field);
  const stamp = useSyncExternalStore(
    highlightStore.subscribe,
    () => highlightStore.getSnapshot().get(key),
    () => undefined,
  );

  return (
    <Flash
      key={stamp ?? 'idle'}
      $active={stamp !== undefined}
      data-flash={stamp !== undefined || undefined}
    >
      {children}
    </Flash>
  );
}
