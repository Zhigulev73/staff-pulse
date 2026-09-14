import http from 'node:http';
import path from 'node:path';
import { createApp } from './app.js';
import { createStore } from './store.js';

const PORT = Number(process.env.PORT ?? 4000);
const STATIC_DIR = path.resolve(import.meta.dirname, '../../client/dist');

const store = createStore();
const app = createApp(store, { staticDir: STATIC_DIR });
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(
    `[server] http://localhost:${PORT}  (GET /api/org-tree, узлов: ${store.getNodes().length})`,
  );
});

// Корректная остановка по Ctrl+C: закрываем сервер, не оставляя висящих соединений.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  });
}
