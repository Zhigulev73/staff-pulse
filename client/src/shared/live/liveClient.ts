import { type OrgPatch, orgPatchSchema } from '@/shared/api/schema';
import { z } from 'zod';
import { computeBackoff } from '@/shared/live/backoff';

const helloSchema = z.object({
  version: z.int().min(0),
  etag: z.string().min(1),
  replay: z.boolean(),
});

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface LiveStatusInfo {
  status: LiveStatus;
  /** Номер попытки переподключения (0 — первое соединение). */
  attempt: number;
  /** Через сколько мс следующая попытка; null, если не запланирована. */
  retryInMs: number | null;
}

/** Минимальный интерфейс EventSource — чтобы подменять его в тестах. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
}

export interface LiveHello {
  version: number;
  etag: string;
  /** true — сервер сейчас дошлёт пропущенные патчи. */
  replay: boolean;
}

export interface LiveClientOptions {
  url: string;
  onHello: (hello: LiveHello) => void;
  onPatch: (patch: OrgPatch) => void;
  /** Сервер не может дослать пропущенное — нужен полный рефетч. */
  onResync: (version: number) => void;
  onStatus: (info: LiveStatusInfo) => void;
  createEventSource?: (url: string) => EventSourceLike;
  /** Если за это время не пришло ни события, ни heartbeat — соединение считается мёртвым. */
  watchdogMs?: number;
  isOnline?: () => boolean;
  random?: () => number;
}

export interface LiveClient {
  start(): void;
  stop(): void;
  getLastEventId(): number | null;
}

const DEFAULT_WATCHDOG_MS = 45_000;

/**
 * Клиент SSE-потока с ручным управлением переподключением.
 *
 * Нативный EventSource переподключается сам, но с фиксированной паузой и без
 * индикации попыток. Здесь при любой ошибке соединение закрывается, а новое
 * открывается по экспоненциальному backoff; последний полученный id передаётся
 * в `?lastEventId=`, чтобы сервер дослал пропущенные патчи.
 */
export function createLiveClient(options: LiveClientOptions): LiveClient {
  const {
    url,
    onHello,
    onPatch,
    onResync,
    onStatus,
    createEventSource = (target) => new EventSource(target),
    watchdogMs = DEFAULT_WATCHDOG_MS,
    isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine),
    random = Math.random,
  } = options;

  let source: EventSourceLike | null = null;
  let stopped = false;
  let attempt = 0;
  let lastEventId: number | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let watchdogTimer: ReturnType<typeof setTimeout> | undefined;

  const emit = (status: LiveStatus, retryInMs: number | null = null) => {
    onStatus({ status, attempt, retryInMs });
  };

  const clearTimers = () => {
    clearTimeout(reconnectTimer);
    clearTimeout(watchdogTimer);
    reconnectTimer = undefined;
    watchdogTimer = undefined;
  };

  const closeSource = () => {
    source?.close();
    source = null;
  };

  const armWatchdog = () => {
    clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(handleFailure, watchdogMs);
  };

  const parseJson = (raw: string): unknown => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  };

  function handleFailure(): void {
    closeSource();
    clearTimers();
    if (stopped) return;

    if (!isOnline()) {
      emit('offline');
      return; // ждём события online
    }

    const delay = computeBackoff(attempt, random);
    attempt += 1;
    emit('reconnecting', delay);
    reconnectTimer = setTimeout(connect, delay);
  }

  function connect(): void {
    if (stopped) return;
    clearTimers();
    emit(attempt === 0 ? 'connecting' : 'reconnecting');

    const target =
      lastEventId === null
        ? url
        : `${url}${url.includes('?') ? '&' : '?'}lastEventId=${lastEventId}`;
    source = createEventSource(target);
    armWatchdog();

    source.addEventListener('open', () => {
      attempt = 0;
      emit('live');
      armWatchdog();
    });

    source.addEventListener('ping', armWatchdog);

    source.addEventListener('hello', (event) => {
      armWatchdog();
      const parsed = helloSchema.safeParse(parseJson(event.data));
      if (!parsed.success) return;
      // Без досылки продолжать нужно с текущей версии сервера, иначе первый же
      // реконнект до первого патча ушёл бы без lastEventId.
      if (!parsed.data.replay) lastEventId = parsed.data.version;
      onHello(parsed.data);
    });

    source.addEventListener('patch', (event) => {
      armWatchdog();
      const parsed = orgPatchSchema.safeParse(parseJson(event.data));
      if (!parsed.success) return; // битый кадр игнорируем, соединение не рвём
      lastEventId = parsed.data.seq;
      onPatch(parsed.data);
    });

    source.addEventListener('resync', (event) => {
      armWatchdog();
      const data = parseJson(event.data) as { version?: unknown } | undefined;
      const version = typeof data?.version === 'number' ? data.version : 0;
      // После полного рефетча продолжаем с текущей версии сервера.
      lastEventId = version;
      onResync(version);
    });

    source.addEventListener('error', handleFailure);
  }

  const handleOnline = () => {
    if (stopped || source) return;
    attempt = 0;
    connect();
  };

  return {
    start() {
      stopped = false;
      if (typeof window !== 'undefined') {
        window.addEventListener('online', handleOnline);
      }
      if (!isOnline()) {
        emit('offline');
        return;
      }
      connect();
    },
    stop() {
      stopped = true;
      clearTimers();
      closeSource();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
    },
    getLastEventId: () => lastEventId,
  };
}
