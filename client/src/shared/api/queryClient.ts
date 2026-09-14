import { QueryClient } from '@tanstack/react-query';

/** Данные считаются свежими 5 секунд: повторное монтирование в этом окне не порождает запрос. */
export const ORG_TREE_STALE_TIME_MS = 5_000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: ORG_TREE_STALE_TIME_MS,
        retry: 1,
        retryDelay: 1_000,
        // Актуальность после первой загрузки поддерживает live-канал,
        // поэтому рефетч по фокусу окна и восстановлению сети не нужен.
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
}

export const queryClient = createQueryClient();
