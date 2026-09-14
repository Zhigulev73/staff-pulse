export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_MAX_MS = 30_000;
export const BACKOFF_JITTER_MS = 500;

/**
 * Экспоненциальная задержка переподключения: 1с, 2с, 4с … с потолком 30с
 * и случайным джиттером, чтобы клиенты не переподключались синхронно.
 */
export function computeBackoff(attempt: number, random: () => number = Math.random): number {
  const exponential = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt));
  return exponential + Math.floor(random() * BACKOFF_JITTER_MS);
}
