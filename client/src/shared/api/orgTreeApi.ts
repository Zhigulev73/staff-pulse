import { type OrgNode, parseOrgTree } from '@/shared/api/schema';

export const ORG_TREE_URL = '/api/org-tree';

/** Параметры dev-сценариев мок-сервера, которые можно задать в адресе страницы. */
const FORWARDED_PARAMS = ['scenario', 'delay'] as const;

/**
 * URL запроса. Для ручной проверки состояний `?scenario=error|empty|invalid`
 * и `?delay=2000` из адреса страницы пробрасываются в запрос к API.
 */
export function buildOrgTreeUrl(search: string = globalThis.location?.search ?? ''): string {
  const pageParams = new URLSearchParams(search);
  const apiParams = new URLSearchParams();
  for (const key of FORWARDED_PARAMS) {
    const value = pageParams.get(key);
    if (value) apiParams.set(key, value);
  }
  const query = apiParams.toString();
  return query ? `${ORG_TREE_URL}?${query}` : ORG_TREE_URL;
}

/** HTTP-ответ со статусом вне 2xx. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Сервер ответил ошибкой ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export interface FetchOrgTreeParams {
  /** ETag предыдущего успешного ответа — отправляется как If-None-Match. */
  etag: string | null;
  signal?: AbortSignal;
}

export type FetchOrgTreeResult =
  { kind: 'fresh'; nodes: OrgNode[]; etag: string | null } | { kind: 'not-modified' };

/**
 * Загружает плоский список узлов и валидирует его схемой.
 * При совпадении ETag сервер отвечает 304 — данные не менялись, кэш остаётся.
 */
export async function fetchOrgTree({
  etag,
  signal,
}: FetchOrgTreeParams): Promise<FetchOrgTreeResult> {
  const headers = new Headers({ Accept: 'application/json' });
  if (etag) {
    headers.set('If-None-Match', etag);
  }

  const response = await fetch(buildOrgTreeUrl(), { headers, signal });

  if (response.status === 304) {
    return { kind: 'not-modified' };
  }
  if (!response.ok) {
    throw new HttpError(response.status);
  }

  const json: unknown = await response.json();
  return { kind: 'fresh', nodes: parseOrgTree(json), etag: response.headers.get('ETag') };
}
