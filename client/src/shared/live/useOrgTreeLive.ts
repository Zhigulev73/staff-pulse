import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { highlightStore, keysForPatch } from '@/features/highlights/cellHighlights';
import { ORG_TREE_KEY, type OrgTreeCache } from '@/shared/api/useOrgTree';
import { createLiveClient, type LiveStatusInfo } from '@/shared/live/liveClient';
import { type ApplyPatchResult, applyPatch } from '@/shared/model/applyPatch';

export const LIVE_URL = '/api/org-tree/events';

const INITIAL_STATUS: LiveStatusInfo = { status: 'connecting', attempt: 0, retryInMs: null };

/**
 * Подписка на live-обновления. Патчи применяются прямо в кэш react-query
 * (`setQueryData`) без рефетча; полный рефетч (`invalidateQueries`) происходит
 * только когда сервер сообщает, что снимок клиента отстал и дослать патчи нельзя.
 */
export function useOrgTreeLive(): LiveStatusInfo {
  const queryClient = useQueryClient();
  const [info, setInfo] = useState<LiveStatusInfo>(INITIAL_STATUS);
  /** Последний seq, полученный по каналу; для контроля непрерывности. */
  const lastSeqRef = useRef<number | null>(null);

  useEffect(() => {
    const resync = () => {
      // Один рефетч на «отставание»: если уже идёт — не дёргаем повторно.
      if (queryClient.isFetching({ queryKey: ORG_TREE_KEY }) > 0) return;
      void queryClient.invalidateQueries({ queryKey: ORG_TREE_KEY });
    };

    const client = createLiveClient({
      url: LIVE_URL,
      onStatus: setInfo,

      onHello(hello) {
        if (hello.replay) return; // патчи сейчас догонят снимок
        lastSeqRef.current = hello.version;
        const cache = queryClient.getQueryData<OrgTreeCache>(ORG_TREE_KEY);
        // Данные изменились, пока канала не было (или между GET и подключением).
        if (cache && cache.etag !== hello.etag) resync();
      },

      onPatch(patch) {
        const previous = lastSeqRef.current;
        lastSeqRef.current = patch.seq;
        if (previous !== null && patch.seq !== previous + 1) {
          resync(); // пропуск в нумерации — снимок ненадёжен
          return;
        }

        let result: ApplyPatchResult | undefined;
        queryClient.setQueryData<OrgTreeCache>(ORG_TREE_KEY, (cache) => {
          if (!cache) return cache; // данных ещё нет — придут уже с этим изменением
          result = applyPatch(cache, patch);
          return result.cache;
        });

        if (result && result.touchedIds.length > 0) {
          highlightStore.flash(keysForPatch(result.touchedIds, result.changedFields));
        }
      },

      onResync(version) {
        lastSeqRef.current = version;
        resync();
      },
    });

    client.start();
    return () => {
      client.stop();
      highlightStore.clear();
    };
  }, [queryClient]);

  return info;
}
