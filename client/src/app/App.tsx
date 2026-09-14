import { useCallback, useState } from 'react';
import styled from 'styled-components';
import { OrgTable } from '@/features/table/OrgTable';
import { OrgTree } from '@/features/tree/OrgTree';
import { useExpansion } from '@/features/tree/useExpansion';
import { useOrgTree } from '@/shared/api/useOrgTree';
import { useOrgTreeLive } from '@/shared/live/useOrgTreeLive';
import { getOrgModel, rowsFromModel } from '@/shared/model/orgModel';
import { ConnectionIndicator } from '@/shared/ui/ConnectionIndicator';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StatusPanel';
import { ViewToggle, type ViewMode } from '@/shared/ui/ViewToggle';

const Page = styled.main`
  max-width: 1600px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.space.xl};
`;

const Header = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.lg};
  margin-bottom: ${({ theme }) => theme.space.lg};
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.heading};
  font-weight: 650;
`;

const Subtitle = styled.p`
  margin: 2px 0 0;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.lg};
`;

/** До 1280px — одна панель по переключателю, от 1280px — split-view. */
const Layout = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.lg};
  align-items: start;

  @media (min-width: ${({ theme }) => theme.breakpoints.split}) {
    grid-template-columns: minmax(380px, 5fr) minmax(0, 7fr);
  }
`;

const Panel = styled.section<{ $visible: boolean }>`
  display: ${({ $visible }) => ($visible ? 'block' : 'none')};
  min-width: 0;
  padding: ${({ theme }) => theme.space.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.surface};

  @media (min-width: ${({ theme }) => theme.breakpoints.split}) {
    display: block;
  }
`;

const PanelTitle = styled.h2`
  margin: 0 0 ${({ theme }) => theme.space.sm};
  font-size: ${({ theme }) => theme.font.small};
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export function App() {
  const query = useOrgTree();
  const live = useOrgTreeLive();
  const model = query.data ? getOrgModel(query.data.nodes) : null;
  const rows = model ? rowsFromModel(model) : null;

  const { expandedIds, toggle, reveal } = useExpansion(model);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('tree');

  /** Выбор из таблицы: выделить узел, раскрыть его ветку и показать в дереве. */
  const selectFromTable = useCallback(
    (id: string) => {
      setSelectedId(id);
      reveal(id);
    },
    [reveal],
  );

  const hasData = model !== null && rows !== null && model.roots.length > 0;

  let content;
  if (query.isPending) {
    content = <LoadingState />;
  } else if (query.isError) {
    content = <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  } else if (!hasData) {
    content = <EmptyState />;
  } else {
    content = (
      <Layout>
        <Panel $visible={view === 'tree'} aria-label="Дерево орг-структуры">
          <PanelTitle>Дерево</PanelTitle>
          <OrgTree
            model={model}
            expandedIds={expandedIds}
            selectedId={selectedId}
            onToggle={toggle}
            onSelect={setSelectedId}
          />
        </Panel>
        <Panel $visible={view === 'table'} aria-label="Аналитическая таблица">
          <PanelTitle>Аналитическая таблица</PanelTitle>
          <OrgTable rows={rows} selectedId={selectedId} onSelect={selectFromTable} />
        </Panel>
      </Layout>
    );
  }

  return (
    <Page>
      <Header>
        <div>
          <Title>Staff Pulse</Title>
          <Subtitle>Орг-структура компании: дивизионы → отделы → команды</Subtitle>
        </div>
        <Controls>
          {hasData && <ViewToggle value={view} onChange={setView} />}
          <ConnectionIndicator info={live} />
        </Controls>
      </Header>
      {content}
    </Page>
  );
}
