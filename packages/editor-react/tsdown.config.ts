import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  banner: '"use client";',
  sourcemap: true,
  clean: true,
  external: ['@inkforge/editor-core', '@inkforge/editor-html', 'react', 'react-dom'],
});
