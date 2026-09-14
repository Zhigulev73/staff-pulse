import { type Request, type Response } from 'express';
import { formatEtag, type OrgStore } from './store.js';

/** Интервал heartbeat-комментариев: клиент считает соединение мёртвым, если тишина дольше ~3 интервалов. */
export const HEARTBEAT_INTERVAL_MS = 15_000;

function writeEvent(res: Response, event: string, data: unknown, id?: number): void {
  if (id !== undefined) res.write(`id: ${id}\n`);
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function readLastEventId(req: Request): number | null {
  const raw = req.headers['last-event-id'] ?? req.query.lastEventId;
  if (typeof raw !== 'string' || raw === '') return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * GET /api/org-tree/events — поток Server-Sent Events.
 *
 * События:
 *   hello  { version, etag, replay }              — при подключении; replay=true: сейчас
 *                                                    будут досланы пропущенные патчи
 *   patch  { seq, nodeId, changes, updatedAt, etag } — id события = seq
 *   resync { version, etag }                       — история для Last-Event-ID потеряна,
 *                                                    клиенту нужен полный рефетч
 *   ping   { t }                                   — heartbeat каждые 15 с
 *
 * При переподключении браузер (или клиент вручную) передаёт Last-Event-ID:
 * все пропущенные патчи досылаются по порядку, поэтому полный рефетч нужен
 * только когда пропуск не помещается в буфер сервера.
 */
export function createSseHandler(store: OrgStore) {
  return (req: Request, res: Response): void => {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Nginx и подобные прокси не должны буферизовать поток.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const version = store.getVersion();
    const lastEventId = readLastEventId(req);
    const missed = lastEventId === null ? null : store.getPatchesAfter(lastEventId);

    // replay: true — сейчас будут досланы пропущенные патчи, снимок клиента догонит версию.
    // replay: false — досылки не будет; если etag клиента отличается, ему нужен рефетч.
    writeEvent(res, 'hello', { version, etag: formatEtag(version), replay: missed !== null });

    if (lastEventId !== null && missed === null) {
      writeEvent(res, 'resync', { version, etag: formatEtag(version) });
    }
    for (const patch of missed ?? []) {
      writeEvent(res, 'patch', patch, patch.seq);
    }

    const unsubscribe = store.subscribe((patch) => {
      writeEvent(res, 'patch', patch, patch.seq);
    });

    // Heartbeat — именно событие, а не комментарий: EventSource не показывает комментарии
    // клиенту, а клиенту нужно замечать «молчащее» соединение.
    const heartbeat = setInterval(() => {
      writeEvent(res, 'ping', { t: Date.now() });
    }, HEARTBEAT_INTERVAL_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  };
}
