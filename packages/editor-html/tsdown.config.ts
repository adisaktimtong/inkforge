import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/browser.ts', 'src/server.ts', 'src/engine.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
});
