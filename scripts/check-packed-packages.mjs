import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicPackages = [
  'editor-core',
  'editor-html',
  'editor-checks',
  'editor-react',
  'editor-content',
];
const packed = mkdtempSync(join(tmpdir(), 'texteditor-packed-'));
const consumer = mkdtempSync(join(tmpdir(), 'texteditor-consumer-'));
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: 'inherit' });

try {
  for (const name of publicPackages)
    run('pnpm', ['--filter', name, 'pack', '--pack-destination', packed]);
  const tarballs = readdirSync(packed)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => join(packed, name));
  if (tarballs.length !== publicPackages.length)
    throw new Error('Every public package must produce exactly one tarball.');

  for (const tarball of tarballs) {
    const listing = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' });
    if (!listing.includes('package/package.json') || !listing.includes('package/dist/'))
      throw new Error(`${tarball} is missing package metadata or build output.`);
    if (/package\/(?:src|internal|apps)\//.test(listing))
      throw new Error(`${tarball} ships private source or workspace internals.`);
  }

  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'packed-consumer', private: true, type: 'module' }),
  );
  run('npm', ['install', '--ignore-scripts', '--no-package-lock', ...tarballs], consumer);
  const packageJson = JSON.parse(readFileSync(join(consumer, 'package.json'), 'utf8'));
  for (const name of publicPackages) {
    if (!packageJson.dependencies?.[name])
      throw new Error(`Packed consumer did not install ${name}.`);
    run(
      'node',
      ['--input-type=module', '--eval', `await import(${JSON.stringify(name)})`],
      consumer,
    );
  }
  for (const subpath of ['editor-html/browser', 'editor-html/server']) {
    run(
      'node',
      ['--input-type=module', '--eval', `await import(${JSON.stringify(subpath)})`],
      consumer,
    );
  }
  for (const specifier of [
    'editor-core/internal',
    'editor-html/dist/index.js',
    '@texteditor/editor-dom',
    '@texteditor/editor-source',
  ]) {
    try {
      run(
        'node',
        ['--input-type=module', '--eval', `await import(${JSON.stringify(specifier)})`],
        consumer,
      );
      throw new Error(`Prohibited consumer import resolved: ${specifier}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Prohibited')) throw error;
    }
  }
} finally {
  rmSync(packed, { recursive: true, force: true });
  rmSync(consumer, { recursive: true, force: true });
}
