import { useState } from 'react';
import styled from 'styled-components';
import { OrgTree } from '@/features/tree/OrgTree';
import { useExpansion } from '@/features/tree/useExpansion';
import { useOrgTree } from '@/shared/api/useOrgTree';
import { getOrgModel } from '@/shared/model/orgModel';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StatusPanel';

const Page = styled.main`
  max-width: 1440px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.space.xl};
`;

const Header = styled.header`
  display: flex;
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

const Panel = styled.section`
  padding: ${({ theme }) => theme.space.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.surface};
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
  const model = query.data ? getOrgModel(query.data.nodes) : null;
  const { expandedIds, toggle } = useExpansion(model);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  let content;
  if (query.isPending) {
    content = <LoadingState />;
  } else if (query.isError) {
    content = <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  } else if (!model || model.roots.length === 0) {
    content = <EmptyState />;
  } else {
    content = (
      <Panel>
        <PanelTitle>Дерево</PanelTitle>
        <OrgTree
          model={model}
          expandedIds={expandedIds}
          selectedId={selectedId}
          onToggle={toggle}
          onSelect={setSelectedId}
        />
      </Panel>
    );
  }

  return (
    <Page>
      <Header>
        <div>
          <Title>Staff Pulse</Title>
          <Subtitle>Орг-структура компании: дивизионы → отделы → команды</Subtitle>
        </div>
      </Header>
      {content}
    </Page>
  );
}
