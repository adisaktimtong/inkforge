import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/browser.ts', 'src/server.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
});
