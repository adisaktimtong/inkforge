import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: ['src/index.ts', 'src/common-ui.ts', 'src/engine.ts', 'src/host.ts'],
  format: ['esm'],
  dts: { tsconfig: fileURLToPath(new URL('../../tsconfig.engine-react.json', import.meta.url)) },
  // RSC directives belong to JavaScript chunks, never ambient declarations.
  banner: (chunk) => (/\.d\.[cm]?ts$/.test(chunk.fileName) ? '' : '"use client";'),
  sourcemap: true,
  clean: true,
  deps: {
    neverBundle: [
      /^@adisaktimtong\/ui-component(?:\/|$)/,
      /^@inkforge\//,
      /^react(?:-dom)?(?:\/|$)/,
    ],
  },
});
