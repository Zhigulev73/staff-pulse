import styled from 'styled-components';
import { FlashCell } from '@/features/highlights/FlashCell';
import { labelId } from '@/features/tree/treeIds';
import { type TreeNode } from '@/shared/model/orgModel';
import { PerformanceDot } from '@/shared/ui/PerformanceDot';

const Row = styled.div<{ $level: number; $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.sm};
  padding: 6px ${({ theme }) => theme.space.sm};
  padding-left: ${({ $level }) => 8 + ($level - 1) * 22}px;
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;
  background: ${({ theme, $selected }) => ($selected ? theme.colors.accentSoft : 'transparent')};
  box-shadow: ${({ theme, $selected }) => ($selected ? `inset 0 0 0 1px ${theme.colors.accent}` : 'none')};

  &:hover {
    background: ${({ theme, $selected }) =>
      $selected ? theme.colors.accentSoft : theme.colors.surfaceRaised};
  }
`;

const Toggle = styled.button<{ $expanded: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: transparent;
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;
  transform: rotate(${({ $expanded }) => ($expanded ? 90 : 0)}deg);
  transition: transform ${({ theme }) => theme.duration.expand} ease;

  &:hover {
    background: ${({ theme }) => theme.colors.border};
  }
`;

const ToggleSpacer = styled.span`
  width: 20px;
  flex-shrink: 0;
`;

const Name = styled.span<{ $level: number }>`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: ${({ $level }) => ($level === 1 ? 600 : 400)};
`;

const Headcount = styled.span`
  min-width: 56px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textMuted};
`;

interface TreeItemProps {
  node: TreeNode;
  expanded: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}

/** Строка узла: стрелка раскрытия, название, численность, индикатор эффективности. */
export function TreeItem({ node, expanded, selected, onToggle, onSelect }: TreeItemProps) {
  const hasChildren = node.children.length > 0;

  return (
    <Row $level={node.level} $selected={selected} onClick={() => onSelect(node.id)}>
      {hasChildren ? (
        <Toggle
          type="button"
          $expanded={expanded}
          aria-label={`${expanded ? 'Свернуть' : 'Развернуть'} ${node.name}`}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(node.id);
          }}
        >
          ▸
        </Toggle>
      ) : (
        <ToggleSpacer aria-hidden="true" />
      )}
      <Name id={labelId(node.id)} $level={node.level}>
        {node.name}
      </Name>
      <Headcount>
        <FlashCell nodeId={node.id} field="headcount">
          {node.headcount} чел.
        </FlashCell>
      </Headcount>
      <FlashCell nodeId={node.id} field="performance">
        <PerformanceDot value={node.performance} />
      </FlashCell>
    </Row>
  );
}
