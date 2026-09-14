import styled from 'styled-components';

export type ViewMode = 'tree' | 'table';

const Group = styled.div`
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.surfaceRaised};

  /* На широких экранах обе панели видны одновременно — переключатель не нужен. */
  @media (min-width: ${({ theme }) => theme.breakpoints.split}) {
    display: none;
  }
`;

const Option = styled.button<{ $active: boolean }>`
  padding: 6px 14px;
  border: none;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme, $active }) => ($active ? theme.colors.surface : 'transparent')};
  box-shadow: ${({ $active }) => ($active ? '0 1px 2px rgba(0, 0, 0, 0.12)' : 'none')};
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textMuted)};
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  cursor: pointer;
`;

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

/** Переключатель «Дерево / Таблица». Скрыт от 1280px, где включается split-view. */
export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <Group role="tablist" aria-label="Режим просмотра">
      <Option
        type="button"
        role="tab"
        aria-selected={value === 'tree'}
        $active={value === 'tree'}
        onClick={() => onChange('tree')}
      >
        Дерево
      </Option>
      <Option
        type="button"
        role="tab"
        aria-selected={value === 'table'}
        $active={value === 'table'}
        onClick={() => onChange('table')}
      >
        Таблица
      </Option>
    </Group>
  );
}
