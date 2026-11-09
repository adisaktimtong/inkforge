import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '..');
for (const directory of readdirSync(join(root, 'packages')).sort()) {
  const path = join(root, 'packages', directory);
  const manifest = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
  if (manifest.private) continue;
  // ATTW analyzes JS/declarations. CSS is checked by publint and the packed
  // Next.js consumer, rather than pretending a stylesheet is a Node JS module.
  const cssEntries = Object.keys(manifest.exports).filter((entry) => entry.endsWith('.css'));
  // The CLIs accept one package path. A shell glob silently checked only the first package.
  for (const args of [
    ['exec', 'publint', path],
    [
      'exec',
      'attw',
      path,
      '--pack',
      '--profile',
      'esm-only',
      ...(cssEntries.length ? ['--exclude-entrypoints', ...cssEntries] : []),
    ],
  ])
    execFileSync('pnpm', args, { cwd: root, stdio: 'inherit' });
}
