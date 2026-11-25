import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // относительные пути — обязательно для iframe Яндекс Игр
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 900, assetsInlineLimit: 8192 },
  server: { host: true },
});
