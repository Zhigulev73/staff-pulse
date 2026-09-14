import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { fetchOrgTree } from '@/shared/api/orgTreeApi';
import { type OrgNode } from '@/shared/api/schema';

export const ORG_TREE_KEY = ['org-tree'] as const;

/** Значение в кэше: узлы + ETag, с которым они были получены. */
export interface OrgTreeCache {
  nodes: OrgNode[];
  etag: string | null;
}

/**
 * Единственный источник правды об орг-структуре.
 * - staleTime 5 с задан в QueryClient;
 * - AbortSignal от react-query отменяет запрос при размонтировании;
 * - при 304 возвращается прежний объект кэша — ссылки не меняются, перерендера нет.
 */
export function useOrgTree(): UseQueryResult<OrgTreeCache> {
  const client = useQueryClient();

  return useQuery({
    queryKey: ORG_TREE_KEY,
    queryFn: async ({ signal }) => {
      const previous = client.getQueryData<OrgTreeCache>(ORG_TREE_KEY);
      const result = await fetchOrgTree({ etag: previous?.etag ?? null, signal });
      if (result.kind === 'not-modified' && previous) {
        return previous;
      }
      if (result.kind === 'not-modified') {
        // 304 без данных в кэше быть не должно; на всякий случай перезапрашиваем без ETag.
        const fresh = await fetchOrgTree({ etag: null, signal });
        return fresh.kind === 'fresh'
          ? { nodes: fresh.nodes, etag: fresh.etag }
          : { nodes: [], etag: null };
      }
      return { nodes: result.nodes, etag: result.etag };
    },
  });
}
