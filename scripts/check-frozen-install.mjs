import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = join(root, '.artifacts');
mkdirSync(output, { recursive: true });
const pin = JSON.parse(readFileSync(join(root, 'contracts/private-build-inputs.json'))).commonUi;
const work = mkdtempSync(join(tmpdir(), 'inkforge-u08-install-'));
const source = join(work, 'source');
const artifact = resolve(process.env.INKFORGE_UI_INPUT_ARTIFACT ?? join(root, pin.destination));
const store = resolve(process.env.INKFORGE_PNPM_STORE ?? join(tmpdir(), 'inkforge-pnpm-store'));
const env = { ...process.env, CI: '1', NEXT_TELEMETRY_DISABLED: '1' };
const digest = (data) => createHash('sha256').update(data).digest('hex');
const sha = (file) => digest(readFileSync(file));
const report = {
  scope:
    'U08-A private input preparation and clean frozen owner install/build; no package release or full library certification',
  result: 'running',
  workDirectory: work,
  runtime: { node: process.version },
  checks: {},
};
const run = (bin, args, name, failure = false, cwd = source) => {
  console.log('> ' + bin + ' ' + args.join(' '));
  let result;
  try {
    const stdout = execFileSync(bin, args, {
      cwd,
      env,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    result = { status: 0, stdout };
  } catch (error) {
    result = {
      status: error.status ?? -1,
      stdout: String(error.stdout ?? ''),
      stderr: String(error.stderr ?? ''),
    };
  }
  writeFileSync(join(work, name + '.log'), result.stdout + (result.stderr ?? ''));
  assert.equal(result.status === 0, !failure, name + ': ' + result.stdout + (result.stderr ?? ''));
  return result.stdout;
};
try {
  assert(existsSync(artifact), 'Prepare the pinned UI input before running this verifier');
  const names = [
    ...new Set(
      execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
      })
        .split('\0')
        .filter(Boolean),
    ),
  ].sort();
  const before = Object.fromEntries(names.map((name) => [name, sha(join(root, name))]));
  for (const name of names) {
    assert(!lstatSync(join(root, name)).isSymbolicLink(), 'Source export must not follow links');
    mkdirSync(dirname(join(source, name)), { recursive: true });
    cpSync(join(root, name), join(source, name));
  }
  report.sourceSha256 = before;
  const node = process.execPath;
  const helper = 'scripts/prepare-ui-peer.mjs';
  const dest = join(source, pin.destination);
  const bad = join(work, 'bad.tgz');
  run(node, [helper, '--artifact', join(work, 'missing.tgz')], 'missing-input', true);
  assert(!existsSync(dest));
  writeFileSync(bad, 'invalid');
  run(node, [helper, '--artifact', bad], 'wrong-size', true);
  assert(!existsSync(dest));
  const corrupt = Buffer.from(readFileSync(artifact));
  corrupt[corrupt.length - 1] ^= 1;
  writeFileSync(bad, corrupt);
  run(node, [helper, '--artifact', bad], 'wrong-integrity', true);
  assert(!existsSync(dest));
  run(node, [helper, '--artifact', artifact], 'stage-input');
  assert.equal(sha(dest), sha(artifact));
  const stamp = lstatSync(dest).mtimeMs;
  const again = JSON.parse(run(node, [helper, '--artifact', artifact], 'idempotent-input'));
  assert.equal(again.unchanged, true);
  assert.equal(lstatSync(dest).mtimeMs, stamp);
  run(node, [helper, '--artifact', bad], 'retain-input-on-failure', true);
  assert.equal(sha(dest), sha(artifact));
  const protectedFile = join(work, 'protected-file');
  writeFileSync(protectedFile, 'user-owned');
  unlinkSync(dest);
  symlinkSync(protectedFile, dest);
  run(node, [helper, '--artifact', artifact], 'reject-destination-link', true);
  assert.equal(readFileSync(protectedFile, 'utf8'), 'user-owned');
  unlinkSync(dest);
  run(node, [helper, '--artifact', artifact], 'restore-input');
  const parent = dirname(dest),
    held = join(work, 'held-inputs');
  renameSync(parent, held);
  symlinkSync(held, parent, 'dir');
  run(node, [helper, '--artifact', artifact], 'reject-parent-link', true);
  assert.equal(sha(join(held, 'ui-component-0.1.0.tgz')), sha(artifact));
  unlinkSync(parent);
  renameSync(held, parent);
  report.checks.actualInputPreparationCases = 8;
  const frozenInputs = Object.fromEntries(
    names
      .filter((name) => /(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)$/.test(name))
      .map((name) => [name, sha(join(source, name))]),
  );
  report.runtime.pnpm = run('pnpm', ['--version'], 'pnpm-version').trim();
  assert.equal(report.runtime.pnpm, '12.4.2');
  const install = ['install', '--frozen-lockfile', '--ignore-scripts', '--store-dir', store];
  run(
    'pnpm',
    [...install, ...(process.env.INKFORGE_INSTALL_OFFLINE === '1' ? ['--offline'] : [])],
    'clean-frozen-install',
  );
  run('pnpm', [...install, '--offline'], 'repeat-offline-frozen-install');
  for (const [name, hash] of Object.entries(frozenInputs))
    assert.equal(sha(join(source, name)), hash, name);
  report.checks.cleanFrozenInstall = true;
  report.checks.repeatedOfflineFrozenInstallWithoutInputChanges = true;
  const peers = run('pnpm', ['peers', 'check'], 'peer-cohort');
  assert.match(peers, /No peer dependency issues found/);
  report.checks.matchingDevelopmentPeerCohort = true;
  run('pnpm', ['run', 'build:packages'], 'owner-package-build');
  report.checks.actualOwnerPackageBuild = true;
  const tap = run(node, ['scripts/test-owner-contracts.mjs'], 'owner-contract-tests');
  const pass = Number(tap.match(/# pass (\d+)/)?.[1]);
  assert(pass > 0);
  assert.match(tap, /# fail 0\b/);
  assert.match(tap, /# skipped 0\b/);
  report.checks.actualOwnerContractCases = pass;
  report.inputIntegrity = pin.integrity;
  report.inputSourceCommit = pin.sourceCommit;
  report.frozenInputSha256 = frozenInputs;
  report.runtime.npm = run('npm', ['--version'], 'npm-version').trim();
  for (const [name, hash] of Object.entries(before))
    assert.equal(sha(join(root, name)), hash, 'Source changed during qualification: ' + name);
  report.result = 'passedForU08AFrozenInstallAndBuildOnly';
} catch (error) {
  report.result = 'failed';
  report.error = String(error);
  throw error;
} finally {
  writeFileSync(join(output, 'u08a-install-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Report: ' + join(output, 'u08a-install-report.json'));
}
