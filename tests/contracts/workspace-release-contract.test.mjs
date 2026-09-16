import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const publicPackages = [
  '@inkforge/editor-core',
  '@inkforge/editor-html',
  '@inkforge/editor-checks',
  '@inkforge/editor-react',
  '@inkforge/editor-content',
];

describe('workspace and release contract', () => {
  test('pins the supported Node and pnpm install contract', () => {
    const manifest = json('package.json');
    const workspace = read('pnpm-workspace.yaml');

    assert.equal(manifest.engines.node, '>=22.18.0');
    assert.equal(manifest.engines.pnpm, '12.4.2');
    assert.equal(manifest.packageManager, 'pnpm@12.4.2');
    assert.match(workspace, /packages:\s*[\s\S]*- packages\/\*/);
    assert.match(read('pnpm-lock.yaml'), /lockfileVersion:/);
  });

  test('publishes only explicit ESM package exports', () => {
    for (const name of publicPackages) {
      const manifest = json(`packages/${name.replace('@inkforge/', '')}/package.json`);
      assert.equal(manifest.private, undefined, `${name} must be publishable`);
      assert.equal(manifest.type, 'module');
      assert.equal(manifest.license, 'MIT');
      assert.ok(manifest.exports, `${name} must declare exports`);
      assert.deepEqual(manifest.files, ['dist']);
      assert.ok(
        Object.keys(manifest.exports).every((entrypoint) =>
          ['.', './browser', './server', './editor.css', './content.css'].includes(entrypoint),
        ),
        `${name} must not expose a deep or internal entry point`,
      );
    }

    const htmlExports = json('packages/editor-html/package.json').exports;
    assert.deepEqual(Object.keys(htmlExports).sort(), ['.', './browser', './server']);

    const react = json('packages/editor-react/package.json');
    assert.equal(react.peerDependencies['@inkforge/editor-core'], 'workspace:*');
    assert.equal(react.peerDependencies.react, '>=18.2 <20');
    assert.equal(react.peerDependencies['react-dom'], '>=18.2 <20');
  });

  test('keeps adapters and demos private and release gated', () => {
    for (const path of [
      'internal/editor-dom/package.json',
      'internal/editor-source/package.json',
      'apps/react-playground/package.json',
      'apps/next-demo/package.json',
    ]) {
      assert.equal(json(path).private, true, `${path} must remain private`);
    }

    const changesets = json('.changeset/config.json');
    assert.deepEqual(changesets.fixed, []);
    assert.deepEqual(changesets.linked, []);

    const releasePr = read('.github/workflows/release-pr.yml');
    const publish = read('.github/workflows/publish.yml');
    assert.match(releasePr, /changesets\/action@v1\.9\.0/);
    assert.match(publish, /environment: npm-production/);
    assert.match(publish, /id-token: write/);
    assert.match(publish, /node-version: '24'/);
    assert.match(publish, /pnpm changeset publish/);
  });
});
