import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicPackages = [
  '@inkforge/editor-core',
  '@inkforge/editor-html',
  '@inkforge/editor-checks',
  '@inkforge/editor-react',
  '@inkforge/editor-content',
];
const packed = mkdtempSync(join(tmpdir(), 'inkforge-packed-'));
const consumer = mkdtempSync(join(tmpdir(), 'inkforge-consumer-'));
const react18Consumer = mkdtempSync(join(tmpdir(), 'inkforge-react18-'));
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
  const renderSmoke = `
    import assert from 'node:assert/strict';
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { InkForgeEditor } from '@inkforge/editor-react';
    const html = renderToStaticMarkup(createElement(InkForgeEditor, {
      toolbar: true,
      value: '<p onclick=evil()>Packed <strong>editor</strong></p><script>evil()</script>',
      'aria-label': 'Packed editor',
    }));
    assert.ok(html.includes('role="toolbar"') && html.includes('aria-label="Bold"'));
    assert.ok(html.includes('Packed <strong>editor</strong>'));
    assert.ok(!html.includes('onclick') && !html.includes('<script'));
  `;
  run('node', ['--input-type=module', '--eval', renderSmoke], consumer);
  writeFileSync(
    join(react18Consumer, 'package.json'),
    JSON.stringify({ name: 'packed-react18', private: true, type: 'module' }),
  );
  run(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-package-lock',
      ...tarballs,
      'react@18.2.0',
      'react-dom@18.2.0',
    ],
    react18Consumer,
  );
  run(
    'node',
    [
      '--input-type=module',
      '--eval',
      renderSmoke +
        `
    assert.equal((await import('react')).version, '18.2.0');
    assert.equal((await import('react-dom')).version, '18.2.0');
  `,
    ],
    react18Consumer,
  );
  for (const subpath of ['@inkforge/editor-html/browser', '@inkforge/editor-html/server']) {
    run(
      'node',
      ['--input-type=module', '--eval', `await import(${JSON.stringify(subpath)})`],
      consumer,
    );
  }
  for (const specifier of [
    '@inkforge/editor-core/internal',
    '@inkforge/editor-html/dist/index.js',
    '@inkforge/editor-dom',
    '@inkforge/editor-source',
  ]) {
    run(
      'node',
      [
        '--input-type=module',
        '--eval',
        `
      import assert from 'node:assert/strict';
      try { await import(${JSON.stringify(specifier)}); assert.fail('Prohibited consumer import resolved'); }
      catch(error) { assert.ok(['ERR_PACKAGE_PATH_NOT_EXPORTED','ERR_MODULE_NOT_FOUND'].includes(error.code), String(error)); }
    `,
      ],
      consumer,
    );
  }
} finally {
  rmSync(packed, { recursive: true, force: true });
  rmSync(consumer, { recursive: true, force: true });
  rmSync(react18Consumer, { recursive: true, force: true });
}
