import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOrgTreeUrl, fetchOrgTree, HttpError } from '@/shared/api/orgTreeApi';
import { InvalidResponseError } from '@/shared/api/schema';

const node = {
  id: 'n1',
  name: 'Дивизион',
  parentId: null,
  headcount: 3,
  budget: 100,
  performance: 50,
  updatedAt: '2026-09-14T10:00:00.000Z',
};

function mockFetch(response: Response) {
  const spy = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildOrgTreeUrl', () => {
  it('без параметров страницы даёт базовый адрес', () => {
    expect(buildOrgTreeUrl('')).toBe('/api/org-tree');
  });

  it('пробрасывает только scenario и delay', () => {
    expect(buildOrgTreeUrl('?scenario=error&delay=500&foo=bar')).toBe(
      '/api/org-tree?scenario=error&delay=500',
    );
  });
});

describe('fetchOrgTree', () => {
  it('возвращает свежие данные и ETag при 200', async () => {
    mockFetch(new Response(JSON.stringify([node]), { status: 200, headers: { ETag: '"v3"' } }));

    const result = await fetchOrgTree({ etag: null });

    expect(result).toEqual({ kind: 'fresh', nodes: [node], etag: '"v3"' });
  });

  it('отправляет If-None-Match и возвращает not-modified при 304', async () => {
    const spy = mockFetch(new Response(null, { status: 304 }));

    const result = await fetchOrgTree({ etag: '"v3"' });

    expect(result).toEqual({ kind: 'not-modified' });
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get('If-None-Match')).toBe('"v3"');
  });

  it('бросает HttpError при 500', async () => {
    mockFetch(new Response('{}', { status: 500 }));

    await expect(fetchOrgTree({ etag: null })).rejects.toBeInstanceOf(HttpError);
  });

  it('бросает InvalidResponseError, если ответ не проходит схему', async () => {
    mockFetch(new Response(JSON.stringify([{ ...node, performance: 150 }]), { status: 200 }));

    await expect(fetchOrgTree({ etag: null })).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('пробрасывает AbortSignal в fetch', async () => {
    const spy = mockFetch(new Response('[]', { status: 200 }));
    const controller = new AbortController();

    await fetchOrgTree({ etag: null, signal: controller.signal });

    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });
});
