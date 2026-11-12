import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const owned = [
  'cms-profile.test.mjs',
  'content-checks.test.mjs',
  'controller-dom-commands.test.mjs',
  'controller.test.mjs',
  'editor-engine.test.mjs',
  'editor-html.test.mjs',
  'editor-react.test.mjs',
  'workspace-release-contract.test.mjs',
];
const packedIntegration = ['host-boundary.test.mjs', 'host-parent-observation.test.mjs'];
const actual = readdirSync(resolve(root, 'tests/contracts'))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort();
assert.deepEqual(
  actual,
  [...owned, ...packedIntegration].sort(),
  'Classify every new contract fixture explicitly',
);
console.log(
  '# Owner-only contracts; two public-package integration fixtures require pnpm test:integration.',
);
execFileSync(
  process.execPath,
  ['--test', '--test-reporter=tap', ...owned.map((name) => 'tests/contracts/' + name)],
  {
    cwd: root,
    stdio: 'inherit',
  },
);
