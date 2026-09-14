import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKOFF_MAX_MS } from '@/shared/live/backoff';
import {
  createLiveClient,
  type EventSourceLike,
  type LiveStatusInfo,
} from '@/shared/live/liveClient';

/** Управляемый EventSource: тест сам «присылает» события. */
class FakeEventSource implements EventSourceLike {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>();
  closed = false;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: unknown = ''): void {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: payload } as MessageEvent<string>);
    }
  }
}

const patch = (seq: number) => ({
  seq,
  nodeId: 'n1',
  changes: { headcount: 5 },
  updatedAt: '2026-09-14T10:00:00.000Z',
  etag: `"v${seq}"`,
});

const clients: Array<{ stop(): void }> = [];

function setup(overrides: Partial<Parameters<typeof createLiveClient>[0]> = {}) {
  const onPatch = vi.fn();
  const onResync = vi.fn();
  const onHello = vi.fn();
  const statuses: LiveStatusInfo[] = [];
  const client = createLiveClient({
    url: '/events',
    onHello,
    onPatch,
    onResync,
    onStatus: (info) => statuses.push(info),
    createEventSource: (url) => new FakeEventSource(url),
    random: () => 0,
    isOnline: () => true,
    ...overrides,
  });
  clients.push(client);
  return {
    client,
    onPatch,
    onResync,
    onHello,
    statuses,
    last: () => FakeEventSource.instances.at(-1)!,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  FakeEventSource.instances = [];
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.stop());
  vi.useRealTimers();
});

describe('createLiveClient', () => {
  it('подключается, сообщает статус live и передаёт валидные патчи', () => {
    const { client, onPatch, statuses, last } = setup();

    client.start();
    expect(statuses.at(-1)?.status).toBe('connecting');

    last().emit('open');
    expect(statuses.at(-1)?.status).toBe('live');

    last().emit('patch', patch(1));
    expect(onPatch).toHaveBeenCalledWith(patch(1));
    expect(client.getLastEventId()).toBe(1);
  });

  it('игнорирует невалидный патч, не разрывая соединение', () => {
    const { client, onPatch, last } = setup();
    client.start();
    last().emit('open');

    last().emit('patch', { seq: 'x' });
    last().emit('patch', 'не json');

    expect(onPatch).not.toHaveBeenCalled();
    expect(last().closed).toBe(false);
  });

  it('при ошибке переподключается с экспоненциальным backoff и передаёт lastEventId', () => {
    const { client, statuses, last } = setup();
    client.start();
    last().emit('open');
    last().emit('patch', patch(7));

    const first = last();
    first.emit('error');
    expect(first.closed).toBe(true);
    expect(statuses.at(-1)).toMatchObject({ status: 'reconnecting', attempt: 1, retryInMs: 1000 });

    vi.advanceTimersByTime(999);
    expect(FakeEventSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(last().url).toBe('/events?lastEventId=7');

    last().emit('error');
    expect(statuses.at(-1)).toMatchObject({ attempt: 2, retryInMs: 2000 });
    vi.advanceTimersByTime(2000);
    last().emit('error');
    expect(statuses.at(-1)).toMatchObject({ attempt: 3, retryInMs: 4000 });
  });

  it('ограничивает задержку 30 секундами', () => {
    const { client, statuses, last } = setup();
    client.start();
    for (let i = 0; i < 8; i += 1) {
      last().emit('error');
      vi.advanceTimersByTime(BACKOFF_MAX_MS);
    }
    expect(statuses.filter((s) => s.retryInMs !== null).at(-1)?.retryInMs).toBe(BACKOFF_MAX_MS);
  });

  it('сбрасывает счётчик попыток после успешного открытия', () => {
    const { client, statuses, last } = setup();
    client.start();
    last().emit('error');
    vi.advanceTimersByTime(1000);
    last().emit('open');
    last().emit('error');

    expect(statuses.at(-1)).toMatchObject({ attempt: 1, retryInMs: 1000 });
  });

  it('считает молчащее соединение мёртвым по watchdog и переподключается', () => {
    const { client, statuses, last } = setup({ watchdogMs: 5000 });
    client.start();
    last().emit('open');

    vi.advanceTimersByTime(4000);
    last().emit('ping', { t: 1 }); // heartbeat продлевает срок
    vi.advanceTimersByTime(4000);
    expect(FakeEventSource.instances).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
    expect(statuses.at(-1)?.status).toBe('reconnecting');
  });

  it('hello без досылки задаёт lastEventId версией сервера', () => {
    const { client, onHello, last } = setup();
    client.start();
    last().emit('open');

    last().emit('hello', { version: 12, etag: '"v12"', replay: false });
    expect(onHello).toHaveBeenCalledWith({ version: 12, etag: '"v12"', replay: false });
    expect(client.getLastEventId()).toBe(12);

    last().emit('error');
    vi.advanceTimersByTime(1000);
    expect(last().url).toBe('/events?lastEventId=12');
  });

  it('hello с досылкой не трогает lastEventId — его обновят патчи', () => {
    const { client, last } = setup();
    client.start();
    last().emit('patch', patch(3));
    last().emit('hello', { version: 9, etag: '"v9"', replay: true });
    expect(client.getLastEventId()).toBe(3);
  });

  it('на resync вызывает onResync и продолжает с версии сервера', () => {
    const { client, onResync, last } = setup();
    client.start();
    last().emit('open');

    last().emit('resync', { version: 42 });

    expect(onResync).toHaveBeenCalledWith(42);
    expect(client.getLastEventId()).toBe(42);
  });

  it('в офлайне не пытается переподключаться, пока не появится сеть', () => {
    let online = false;
    const { client, statuses } = setup({ isOnline: () => online });
    client.start();

    expect(statuses.at(-1)?.status).toBe('offline');
    expect(FakeEventSource.instances).toHaveLength(0);

    online = true;
    window.dispatchEvent(new Event('online'));
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('stop закрывает соединение и отменяет запланированное переподключение', () => {
    const { client, last } = setup();
    client.start();
    last().emit('error');
    client.stop();

    vi.advanceTimersByTime(60_000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
