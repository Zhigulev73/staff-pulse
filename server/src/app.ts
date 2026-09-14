import express, { type Express, type Request } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createSseHandler } from './sse.js';
import { formatEtag, type OrgStore } from './store.js';

export interface AppOptions {
  /** Каталог со собранным клиентом; если существует — раздаём статику (prod-режим). */
  staticDir?: string;
}

function readScenario(req: Request): string | undefined {
  const value = req.query.scenario;
  return typeof value === 'string' ? value : undefined;
}

function readDelay(req: Request): number {
  const value = Number(req.query.delay ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 30_000) : 0;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createApp(store: OrgStore, options: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);

  /**
   * GET /api/org-tree — плоский список узлов.
   *
   * Dev-параметры для ручной проверки состояний клиента:
   *   ?scenario=empty   → []
   *   ?scenario=error   → 500
   *   ?scenario=invalid → ответ, не проходящий валидацию схемы на клиенте
   *   ?delay=2000       → искусственная задержка в мс
   *
   * ETag = версия стора. Клиент шлёт If-None-Match и получает 304, если данные
   * не менялись — так кэш инвалидируется только при реальном изменении.
   */
  app.get('/api/org-tree', async (req, res) => {
    await wait(readDelay(req));

    switch (readScenario(req)) {
      case 'error':
        res.status(500).json({ error: 'Внутренняя ошибка сервера (сценарий error)' });
        return;
      case 'empty':
        res.json([]);
        return;
      case 'invalid':
        res.json([{ id: 'broken', parentId: null, headcount: -1, performance: 150 }]);
        return;
      default:
        break;
    }

    const etag = formatEtag(store.getVersion());
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('ETag', etag);

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.json(store.getNodes());
  });

  app.get('/api/org-tree/events', createSseHandler(store));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, version: store.getVersion() });
  });

  const staticDir = options.staticDir;
  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    // SPA-fallback: любой не-API путь отдаёт index.html.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  return app;
}
