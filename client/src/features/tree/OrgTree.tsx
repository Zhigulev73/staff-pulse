import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { TreeItem } from '@/features/tree/TreeItem';
import { labelId } from '@/features/tree/treeIds';
import { type OrgModel, type TreeNode } from '@/shared/model/orgModel';

/** Длительность анимации раскрытия; должна совпадать с theme.duration.expand. */
export const EXPAND_DURATION_MS = 220;

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;

/**
 * Анимация раскрытия через height transition без измерения в JS:
 * grid-template-rows 0fr ↔ 1fr плавно меняет высоту контента любой длины.
 * Внутренняя обёртка с min-height: 0 позволяет grid-ячейке схлопнуться.
 */
const Branch = styled.div<{ $expanded: boolean }>`
  display: grid;
  grid-template-rows: ${({ $expanded }) => ($expanded ? '1fr' : '0fr')};
  transition: grid-template-rows ${({ theme }) => theme.duration.expand} ease;
`;

const BranchInner = styled.div`
  min-height: 0;
  overflow: hidden;
`;

interface OrgTreeProps {
  model: OrgModel;
  expandedIds: ReadonlySet<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}

interface BranchProps extends Omit<OrgTreeProps, 'model'> {
  nodes: TreeNode[];
}

function TreeLevel({ nodes, expandedIds, selectedId, onToggle, onSelect }: BranchProps) {
  return (
    <List role="group">
      {nodes.map((node) => {
        const expanded = expandedIds.has(node.id);
        const hasChildren = node.children.length > 0;
        return (
          <li
            key={node.id}
            role="treeitem"
            aria-level={node.level}
            aria-labelledby={labelId(node.id)}
            aria-expanded={hasChildren ? expanded : undefined}
            aria-selected={node.id === selectedId}
            data-node-id={node.id}
          >
            <TreeItem
              node={node}
              expanded={expanded}
              selected={node.id === selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
            {hasChildren && (
              // inert убирает свёрнутую ветку из фокуса и дерева доступности,
              // при этом DOM остаётся на месте — иначе высота не анимируется.
              <Branch $expanded={expanded} inert={!expanded} aria-hidden={!expanded}>
                <BranchInner>
                  <TreeLevel
                    nodes={node.children}
                    expandedIds={expandedIds}
                    selectedId={selectedId}
                    onToggle={onToggle}
                    onSelect={onSelect}
                  />
                </BranchInner>
              </Branch>
            )}
          </li>
        );
      })}
    </List>
  );
}

const Root = styled.div`
  font-size: ${({ theme }) => theme.font.base};

  /* Корневой список — без роли group: у него роль tree. */
  & > ul {
    padding: 0;
  }
`;

/** Интерактивное дерево орг-структуры (controlled: раскрытие и выбор хранит родитель). */
export function OrgTree({ model, expandedIds, selectedId, onToggle, onSelect }: OrgTreeProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Выбранный узел (в т.ч. выбранный из таблицы) прокручивается в видимую область.
  // Второй вызов — после окончания анимации раскрытия ветки, когда высота уже финальная.
  useEffect(() => {
    if (!selectedId) return;
    const scroll = () => {
      const item = rootRef.current?.querySelector<HTMLElement>(`[data-node-id="${selectedId}"]`);
      item?.firstElementChild?.scrollIntoView?.({ block: 'nearest' });
    };
    scroll();
    const timer = setTimeout(scroll, EXPAND_DURATION_MS + 20);
    return () => clearTimeout(timer);
  }, [selectedId]);

  return (
    <Root ref={rootRef} role="tree" aria-label="Орг-структура">
      <TreeLevel
        nodes={model.roots}
        expandedIds={expandedIds}
        selectedId={selectedId}
        onToggle={onToggle}
        onSelect={onSelect}
      />
    </Root>
  );
}
