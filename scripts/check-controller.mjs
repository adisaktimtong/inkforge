import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'),
  ui = resolve(process.env.UI_U07_WORKSPACE ?? join(root, '..'), 'ui-component');
const output = join(root, '.artifacts');
mkdirSync(output, { recursive: true });
const env = {
  ...process.env,
  UI_U07_WORKSPACE: resolve(root, '..'),
  UI_NPM_OFFLINE: process.env.UI_NPM_OFFLINE ?? '1',
};
const run = (cmd, args, cwd, capture = false) => {
  console.log(`> ${cmd} ${args.join(' ')} [${cwd}]`);
  return execFileSync(cmd, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 16 * 1024 * 1024,
  });
};
const report = {
  scope: 'U07-B pure granular controller; DOM/host binding remains gated',
  result: 'running',
  runtime: { node: process.version, icu: process.versions.icu },
  checks: {},
};
try {
  // The existing U07-A verifier builds actual source, packs five packages, uses locked consumers,
  // proves absence of optional React/UI dependencies and runs its native legacy schedules.
  const reuse = process.env.UI_U07B_REUSE_PACKED === '1';
  if (!reuse) run(process.execPath, [join(ui, 'scripts/test-owner-adapters.mjs')], ui);
  else {
    run(
      join(root, 'node_modules/.bin/tsc'),
      ['--noEmit', '-p', 'packages/editor-core/tsconfig.json'],
      root,
    );
    run(join(root, 'node_modules/.bin/tsdown'), [], join(root, 'packages/editor-core'));
  }
  const owner = JSON.parse(readFileSync(join(ui, '.artifacts/u07-consumer-report.json')));
  assert.equal(owner.result, 'passedForU07APresentationOnly');
  if (reuse) {
    const destination = join(output, 'u07b-repack');
    mkdirSync(destination, { recursive: true });
    run('pnpm', ['pack', '--pack-destination', destination], join(root, 'packages/editor-core'));
    const current = readFileSync(join(destination, 'inkforge-editor-core-0.0.2.tgz'));
    const integrity = 'sha512-' + createHash('sha512').update(current).digest('base64');
    assert.equal(
      integrity,
      owner.artifacts.find((a) => a.name === '@inkforge/editor-core').integrity,
      'Current rebuilt source differs from the already exercised cohort; run without reuse',
    );
    report.reusedVerifiedPresentationCohort = true;
  }

  report.ownerPresentationRegressions = owner.checks;
  const packedRoot = owner.workDirectory,
    headless = join(packedRoot, 'headless'),
    consumer = join(packedRoot, 'examples/owner-adapters');
  const requireHeadless = createRequire(join(headless, 'package.json'));
  for (const name of ['react', 'react-dom', '@adisaktimtong/ui-component'])
    assert.throws(() => requireHeadless.resolve(name));
  const source = readFileSync(join(root, 'tests/contracts/controller.test.mjs'), 'utf8');
  const packedTests = source.replace(
    "'../../packages/editor-core/dist/index.mjs'",
    "'@inkforge/editor-core'",
  );
  assert.notEqual(source, packedTests);
  writeFileSync(join(headless, 'controller.test.mjs'), packedTests);
  const tap = run(
    process.execPath,
    ['--test', '--test-isolation=none', '--test-reporter=tap', 'controller.test.mjs'],
    headless,
    true,
  );
  console.log(tap);
  assert.match(tap, /# tests 54\b/);
  assert.match(tap, /# pass 54\b/);
  assert.match(tap, /# fail 0\b/);
  assert.match(tap, /# skipped 0\b/);
  writeFileSync(join(output, 'u07b-controller.tap'), tap);
  report.checks.packedController = {
    tests: 54,
    randomizedEdits: 500,
    randomizedFormattingCommands: 150,
    normativeVectors: 6,
    reactInstalled: false,
    commonUiInstalled: false,
  };
  run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    for (const key of ['window','document','navigator']) Object.defineProperty(globalThis,key,{get(){throw Error(key+' accessed')},configurable:true});
    const {createEngine,createDocument}=await import('@inkforge/editor-core');
    const e=createEngine({document:createDocument(),instanceId:'no-dom',origin:'unsaved',clock:()=>0});
    const s=e.getSnapshot();assert.equal(e.dispatch({kind:'insertText',range:s.selection,text:'ไทย'},{expected:s.token}).status,'committed');
    assert.equal(e.getSnapshot().document.children[0].children[0].text,'ไทย');
    await assert.rejects(import('@inkforge/editor-core/dist/index.mjs'),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
  `,
    ],
    headless,
  );
  report.checks.noBrowserGlobals = true;
  const typesPath = join(consumer, 'controller-types.ts'),
    original = readFileSync(join(root, 'tests/public/controller-types.ts'), 'utf8');
  writeFileSync(typesPath, original);
  run(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
    consumer,
  );
  let error;
  try {
    writeFileSync(typesPath, original.replace(/^\s*\/\/ @ts-expect-error.*\n/gm, ''));
    try {
      run(
        process.execPath,
        ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
        consumer,
        true,
      );
    } catch (caught) {
      error = caught;
    }
  } finally {
    writeFileSync(typesPath, original);
  }
  assert(error?.status > 0);
  const diagnostics = String(error.stdout) + String(error.stderr);
  const matches = [...diagnostics.matchAll(/^controller-types\.ts\((\d+),\d+\): error TS/gm)];
  assert.equal(new Set(matches.map((match) => match[1])).size, 12);
  assert.equal(matches.length, 13);
  report.checks.publicNegativeDiagnostics = matches.length;
  writeFileSync(join(output, 'u07b-controller-negative-types.txt'), diagnostics);
  report.checks.publicNegativeTypes = 12;
  const packagePath = run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import {fileURLToPath} from 'node:url'; console.log(fileURLToPath(import.meta.resolve('@inkforge/editor-core')));",
    ],
    headless,
    true,
  ).trim();
  assert(realpathSync(packagePath).startsWith(realpathSync(join(headless, 'node_modules'))));
  report.package = owner.artifacts.find((a) => a.name === '@inkforge/editor-core');
  report.workDirectory = packedRoot;
  const legacyTap = run(
    process.execPath,
    [
      '--test',
      '--test-isolation=none',
      '--test-reporter=tap',
      'tests/contracts/editor-engine.test.mjs',
    ],
    root,
    true,
  );
  assert.match(legacyTap, /# fail 0\b/);
  assert(!legacyTap.includes('# tests 0'));
  writeFileSync(join(output, 'u07b-legacy-engine.tap'), legacyTap);
  report.checks.legacyPrototypeRegressions = Number(legacyTap.match(/# pass (\d+)/)[1]);
  report.sourceTestSha256 = createHash('sha256').update(source).digest('hex');
  report.result = 'passedForU07BControllerOnly';
} catch (error) {
  report.result = 'failed';
  report.error = String(error);
  throw error;
} finally {
  writeFileSync(
    join(output, 'u07b-controller-report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(`Report: ${join(output, 'u07b-controller-report.json')}`);
}
