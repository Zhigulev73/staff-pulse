import { ServerResponse } from 'node:http';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const API_TARGET = process.env.API_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Абсолютные импорты: `@/shared/...` → `src/shared/...`
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // SSE-стрим тоже идёт через этот прокси: Vite не буферизует ответ.
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        configure(proxy) {
          // При падении бэкенда http-proxy оставляет ответ клиенту открытым —
          // EventSource не узнал бы об обрыве. Завершаем ответ, чтобы клиент
          // сразу перешёл к переподключению с backoff.
          proxy.on('error', (_error, _req, res) => {
            if (res instanceof ServerResponse && !res.writableEnded) {
              if (!res.headersSent) res.writeHead(502);
              res.end();
            }
          });
          // Обрыв потока со стороны бэкенда (aborted) http-proxy тоже не транслирует.
          proxy.on('proxyRes', (proxyRes, _req, res) => {
            proxyRes.once('close', () => {
              if (!res.writableEnded) res.end();
            });
          });
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
