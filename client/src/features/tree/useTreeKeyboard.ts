import { type KeyboardEvent, type RefObject, useState } from 'react';
import { type OrgModel, type TreeNode } from '@/shared/model/orgModel';

/** Видимые узлы дерева в порядке сверху вниз (дети только у раскрытых узлов). */
export function visibleNodes(model: OrgModel, expandedIds: ReadonlySet<string>): TreeNode[] {
  const result: TreeNode[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      result.push(node);
      if (expandedIds.has(node.id)) walk(node.children);
    }
  };
  walk(model.roots);
  return result;
}

interface TreeKeyboardParams {
  model: OrgModel;
  expandedIds: ReadonlySet<string>;
  selectedId: string | null;
  rootRef: RefObject<HTMLElement | null>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}

/**
 * Клавиатурная навигация по дереву (roving tabindex):
 * ↑/↓ — по видимым узлам, → раскрыть или перейти к первому ребёнку,
 * ← свернуть или перейти к родителю, Home/End, Enter/Space — выбрать.
 */
export function useTreeKeyboard({
  model,
  expandedIds,
  selectedId,
  rootRef,
  onToggle,
  onSelect,
}: TreeKeyboardParams) {
  // Фокус запоминается вместе с selectedId, для которого он выставлен: смена выбора
  // (например, из таблицы) делает запись устаревшей, и активным становится выбранный узел.
  const [focus, setFocus] = useState<{ id: string; forSelected: string | null } | null>(null);
  const focusedId = focus && focus.forSelected === selectedId ? focus.id : null;
  const activeId = focusedId ?? selectedId ?? model.roots[0]?.id ?? null;

  const moveFocusTo = (id: string) => {
    setFocus({ id, forSelected: selectedId });
    rootRef.current?.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-node-id]');
    const currentId = target?.dataset.nodeId ?? activeId;
    if (!currentId) return;
    const current = model.byId.get(currentId);
    if (!current) return;

    const visible = visibleNodes(model, expandedIds);
    const index = visible.findIndex((node) => node.id === currentId);
    const expanded = expandedIds.has(currentId);
    const hasChildren = current.children.length > 0;

    switch (event.key) {
      case 'ArrowDown':
        if (index < visible.length - 1) moveFocusTo(visible[index + 1]!.id);
        break;
      case 'ArrowUp':
        if (index > 0) moveFocusTo(visible[index - 1]!.id);
        break;
      case 'ArrowRight':
        if (hasChildren && !expanded) onToggle(currentId);
        else if (hasChildren) moveFocusTo(current.children[0]!.id);
        break;
      case 'ArrowLeft':
        if (hasChildren && expanded) onToggle(currentId);
        else if (current.parentId) moveFocusTo(current.parentId);
        break;
      case 'Home':
        if (visible[0]) moveFocusTo(visible[0].id);
        break;
      case 'End':
        if (visible.length > 0) moveFocusTo(visible[visible.length - 1]!.id);
        break;
      case 'Enter':
      case ' ':
        onSelect(currentId);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const handleItemFocus = (id: string) => {
    if (id !== focusedId) setFocus({ id, forSelected: selectedId });
  };

  return { activeId, handleKeyDown, handleItemFocus };
}
