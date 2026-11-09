import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  esbuild: { jsx: 'automatic' },
  // setup.ts devolve o localStorage que o jsdom deveria ter: em Node 26+ o global
  // nativo experimental (undefined sem --localstorage-file) sombreia o do jsdom.
  test: { environment: 'jsdom', setupFiles: [path.resolve(__dirname, 'test/setup.ts')] },
});
