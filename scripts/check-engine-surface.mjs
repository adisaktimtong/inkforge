import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..'),
  ui = resolve(root, '../ui-component'),
  output = join(root, '.artifacts');
mkdirSync(output, { recursive: true });
const env = {
  ...process.env,
  UI_NPM_OFFLINE: '1',
  UI_U07_WORKSPACE: resolve(root, '..'),
  NEXT_TELEMETRY_DISABLED: '1',
  CI: '1',
};
const run = (bin, args, cwd, capture = false, extra = {}) => {
  console.log(`> ${bin} ${args.join(' ')} [${cwd}]`);
  return execFileSync(bin, args, {
    cwd,
    env: { ...env, ...extra },
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 32 * 1024 * 1024,
  });
};
const report = {
  scope: 'U07-C controller-owned DOM/React/Common UI; CMS host acknowledgment remains gated',
  result: 'running',
  runtime: { node: process.version },
  checks: {},
};
try {
  const fast = process.env.INKFORGE_ENGINE_FAST === '1';
  if (!fast) run(process.execPath, [join(ui, 'scripts/test-owner-adapters.mjs')], ui);
  const owner = JSON.parse(readFileSync(join(ui, '.artifacts/u07-consumer-report.json')));
  assert.equal(owner.result, 'passedForU07APresentationOnly');
  const consumer = join(owner.workDirectory, 'examples/owner-adapters'),
    headless = join(owner.workDirectory, 'headless');
  report.workDirectory = owner.workDirectory;
  report.artifacts = owner.artifacts;
  report.presentationRegressions = owner.checks;
  if (fast) {
    report.fastIterationOnly = true;
    report.presentationRegressions = { result: 'notRerunForCurrentFastIteration' };
    for (const name of ['core', 'react']) {
      const dir = join(root, 'packages/editor-' + name);
      run(join(root, 'node_modules/.bin/tsc'), ['--noEmit'], dir);
      run(join(root, 'node_modules/.bin/tsdown'), [], dir);
      if (name === 'react') cpSync(join(dir, 'src/editor.css'), join(dir, 'dist/editor.css'));
      run('pnpm', ['pack', '--pack-destination', join(owner.workDirectory, 'artifacts')], dir);
      const artifact = owner.artifacts.find((a) => a.name === '@inkforge/editor-' + name);
      const buffer = readFileSync(join(owner.workDirectory, 'artifacts', artifact.file));
      artifact.integrity = 'sha512-' + createHash('sha512').update(buffer).digest('base64');
      artifact.bytes = buffer.length;
    }
    for (const dir of [
      consumer,
      headless,
      join(owner.workDirectory, 'examples/owner-adapters-legacy'),
    ]) {
      const lockPath = join(dir, 'package-lock.json'),
        lock = JSON.parse(readFileSync(lockPath));
      for (const artifact of owner.artifacts)
        if (lock.packages['node_modules/' + artifact.name])
          lock.packages['node_modules/' + artifact.name].integrity = artifact.integrity;
      writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
      run(
        'npm',
        [
          'ci',
          '--offline',
          '--ignore-scripts',
          '--cache',
          '/tmp/u01-npm-cache',
          '--no-audit',
          '--no-fund',
          ...(dir === consumer ? [] : ['--omit=peer']),
        ],
        dir,
      );
    }
  }

  for (const [file, expected] of [
    ['controller.test.mjs', 54],
    ['controller-dom-commands.test.mjs', 2],
  ]) {
    const code = readFileSync(join(root, 'tests/contracts', file), 'utf8').replace(
      "'../../packages/editor-core/dist/index.mjs'",
      "'@inkforge/editor-core'",
    );
    writeFileSync(join(headless, file), code);
    const tap = run(
      process.execPath,
      ['--test', '--test-isolation=none', '--test-reporter=tap', file],
      headless,
      true,
    );
    assert.match(tap, new RegExp('# pass ' + expected + '\\b'));
    assert.match(tap, /# fail 0\b/);
    writeFileSync(join(output, 'u07c-' + file + '.tap'), tap);
  }
  report.checks.packedPureController = { previousCases: 54, newAtomicCommands: 2 };
  mkdirSync(join(consumer, 'app/engine'), { recursive: true });
  cpSync(join(root, 'examples/engine-surface/page.tsx'), join(consumer, 'app/engine/page.tsx'));
  const typesPath = join(consumer, 'engine-public-types.tsx'),
    originalTypes = readFileSync(join(root, 'examples/engine-surface/public-types.tsx'), 'utf8');
  writeFileSync(typesPath, originalTypes);
  // Local development packages reuse a version; Webpack treats node_modules versions as immutable.
  // A new tarball must therefore get a clean build cache in this scratch consumer.
  rmSync(join(consumer, '.next'), { recursive: true, force: true });
  run('npm', ['run', 'build'], consumer);
  report.checks.nextProductionBuild = true;
  const ssr = run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict'; import {createElement as h} from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
    import {createEngine,createDocument,createParagraph,createText} from '@inkforge/editor-core'; import {InkforgeEngineEditor} from '@inkforge/editor-react/engine';
    const e=createEngine({instanceId:'ssr',origin:'persisted',clock:()=>0,document:createDocument([createParagraph([createText('<script>safe</script>')])])});
    const html=renderToStaticMarkup(h(InkforgeEngineEditor,{controller:e,'aria-label':'Engine'}));
    assert.ok(html.includes('contentEditable="false"')||html.includes('contenteditable="false"'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;safe'));
    assert.equal(e.getSnapshot().revision,0);assert.equal(e.getSnapshot().disposed,false);console.log('SSR assertions passed');
  `,
    ],
    consumer,
    true,
  );
  assert.match(ssr, /SSR assertions passed/);
  report.checks.ssr = true;
  const legacy = join(owner.workDirectory, 'examples/owner-adapters-legacy');
  run(
    process.execPath,
    ['--input-type=module', '-e', `await import('@inkforge/editor-react/engine');`],
    legacy,
  );
  report.checks.engineEntryWithoutUiPeer = true;
  let invalid;
  try {
    writeFileSync(typesPath, originalTypes.replace(/^\s*\/\/ @ts-expect-error.*\n/gm, ''));
    try {
      run(
        process.execPath,
        ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
        consumer,
        true,
      );
    } catch (error) {
      invalid = error;
    }
  } finally {
    writeFileSync(typesPath, originalTypes);
  }
  assert(invalid?.status > 0);
  const diagnostics = String(invalid.stdout) + String(invalid.stderr),
    lines = [...diagnostics.matchAll(/^engine-public-types\.tsx\((\d+),\d+\): error TS/gm)];
  assert.equal(new Set(lines.map((x) => x[1])).size, 10);
  writeFileSync(join(output, 'u07c-negative-types.txt'), diagnostics);
  report.checks.publicNegativeExamples = 10;
  run(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.engine.config.mjs'],
    root,
    false,
    { INKFORGE_ENGINE_CONSUMER: consumer },
  );
  const production = JSON.parse(readFileSync(join(output, 'u07c-browser.json')));
  assert.equal(production.stats.unexpected, 0);
  assert.equal(production.stats.skipped, 0);
  assert.equal(production.stats.expected, 24);
  report.checks.productionBrowser = 24;
  run(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.engine.config.mjs'],
    root,
    false,
    { INKFORGE_ENGINE_CONSUMER: consumer, INKFORGE_ENGINE_DEV: '1' },
  );
  const development = JSON.parse(readFileSync(join(output, 'u07c-development.json')));
  assert.equal(development.stats.unexpected, 0);
  assert.equal(development.stats.expected, 2);
  report.checks.actualDevelopmentReplay = 2;
  report.result = fast ? 'passedForFastEngineSurfaceOnly' : 'passedForU07CEngineSurfaceOnly';
} catch (error) {
  report.result = 'failed';
  report.error = String(error);
  throw error;
} finally {
  writeFileSync(
    join(output, 'u07c-engine-surface-report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log('Report: ' + join(output, 'u07c-engine-surface-report.json'));
}
