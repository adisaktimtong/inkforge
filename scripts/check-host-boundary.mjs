import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'),
  output = join(root, '.artifacts');
mkdirSync(output, { recursive: true });
const env = { ...process.env, UI_NPM_OFFLINE: '1', NEXT_TELEMETRY_DISABLED: '1', CI: '1' };
const run = (bin, args, cwd, capture = false, extra = {}) =>
  execFileSync(bin, args, {
    cwd,
    env: { ...env, ...extra },
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
const report = {
  scope:
    'U07-D exact controller/profile/standalone and actual Builder field delivery, not server Save',
  result: 'running',
  runtime: { node: process.version },
  checks: {},
};
try {
  // A quick diagnostic may reuse the current installed cohort; it is never final acceptance.
  const reuse = process.env.INKFORGE_HOST_REUSE === '1';
  if (!reuse) run(process.execPath, [join(root, 'scripts/check-engine-surface.mjs')], root);
  const prior = JSON.parse(readFileSync(join(output, 'u07c-engine-surface-report.json')));
  assert.equal(prior.result, 'passedForU07CEngineSurfaceOnly');
  report.artifacts = prior.artifacts;
  report.workDirectory = prior.workDirectory;
  report.previousSurfaceRegression = reuse ? 'notRerunForDiagnostic' : prior.checks;
  report.legacyPresentationRegression = reuse
    ? 'notRerunForDiagnostic'
    : prior.presentationRegressions;
  const consumer = join(prior.workDirectory, 'examples/owner-adapters');
  const headless = join(prior.workDirectory, 'host-headless');
  mkdirSync(headless, { recursive: true });
  const deps = Object.fromEntries(
    prior.artifacts
      .filter((a) => a.name !== '@adisaktimtong/ui-component')
      .map((a) => [a.name, 'file:../artifacts/' + a.file]),
  );
  writeFileSync(
    join(headless, 'package.json'),
    JSON.stringify({ private: true, type: 'module', dependencies: deps }, null, 2) + '\n',
  );
  run(
    'npm',
    [
      'install',
      '--package-lock-only',
      '--offline',
      '--ignore-scripts',
      '--omit=peer',
      '--cache',
      '/tmp/u01-npm-cache',
      '--no-audit',
      '--no-fund',
    ],
    headless,
  );
  run(
    'npm',
    [
      'ci',
      '--offline',
      '--ignore-scripts',
      '--omit=peer',
      '--cache',
      '/tmp/u01-npm-cache',
      '--no-audit',
      '--no-fund',
    ],
    headless,
  );
  run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import assert from 'node:assert/strict'; for(const p of ['react','@adisaktimtong/ui-component']){assert.throws(()=>import.meta.resolve(p));} await import('@inkforge/editor-react/host'); await import('@pagebuilder/headless/editor/field-binding'); console.log('Headless host imports passed');`,
    ],
    headless,
  );
  cpSync(
    join(root, 'tests/contracts/host-boundary.test.mjs'),
    join(headless, 'host-boundary.test.mjs'),
  );
  const tap = run(
    process.execPath,
    ['--test', '--test-isolation=none', '--test-reporter=tap', 'host-boundary.test.mjs'],
    headless,
    true,
  );
  writeFileSync(join(output, 'u07d-host.tap'), tap);
  assert.match(tap, /# pass 20\b/);
  assert.match(tap, /# fail 0\b/);
  report.checks.packedHeadlessCases = 20;
  report.checks.hostImportsWithoutReactOrUi = true;
  mkdirSync(join(consumer, 'app/host'), { recursive: true });
  cpSync(join(root, 'examples/host-boundary/page.tsx'), join(consumer, 'app/host/page.tsx'));
  const typeFile = join(consumer, 'host-public-types.ts'),
    types = readFileSync(join(root, 'examples/host-boundary/public-types.ts'), 'utf8');
  writeFileSync(typeFile, types);
  rmSync(join(consumer, '.next'), { force: true, recursive: true });
  run('npm', ['run', 'build'], consumer);
  report.checks.nextBuildAndStrictActualDeclarations = true;
  let failure;
  try {
    writeFileSync(typeFile, types.replace(/^\s*\/\/ @ts-expect-error.*\n/gm, ''));
    try {
      run(
        process.execPath,
        ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
        consumer,
        true,
      );
    } catch (error) {
      failure = error;
    }
  } finally {
    writeFileSync(typeFile, types);
  }
  assert(failure?.status > 0);
  const diagnostics = String(failure.stdout) + String(failure.stderr);
  const lines = [...diagnostics.matchAll(/^host-public-types\.ts\((\d+),\d+\): error TS/gm)];
  assert.equal(new Set(lines.map((x) => x[1])).size, 6);
  writeFileSync(join(output, 'u07d-negative-types.txt'), diagnostics);
  report.checks.actualNegativeTypeExamples = 6;
  run(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.host.config.mjs'],
    root,
    false,
    { INKFORGE_HOST_CONSUMER: consumer },
  );
  const native = JSON.parse(readFileSync(join(output, 'u07d-browser.json')));
  assert.equal(native.stats.expected, 8);
  for (const k of ['unexpected', 'skipped', 'flaky']) assert.equal(native.stats[k], 0);
  report.checks.nativeBrowserCases = 8;
  report.result = reuse ? 'passedForDiagnosticOnly' : 'passedForU07DFieldBoundaryOnly';
} catch (error) {
  report.result = 'failed';
  report.error = String(error);
  throw error;
} finally {
  writeFileSync(join(output, 'u07d-host-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Report: ' + join(output, 'u07d-host-report.json'));
}
