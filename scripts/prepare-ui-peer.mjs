import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'contracts/private-build-inputs.json')));
const pin = manifest.commonUi;
assert.equal(pin.name, '@adisaktimtong/ui-component');
assert.equal(pin.version, '0.1.0');
assert.equal(pin.destination, 'artifacts/build-inputs/ui-component-0.1.0.tgz');
assert.match(pin.sourceCommit, /^[a-f0-9]{40}$/);
assert.match(pin.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
assert(Number.isSafeInteger(pin.bytes) && pin.bytes > 0 && pin.bytes <= 2 ** 20);
const integrity = (bytes) => 'sha512-' + createHash('sha512').update(bytes).digest('base64');

export function stageUiPeer(artifact) {
  const source = resolve(artifact);
  assert.equal(lstatSync(source).isFile(), true, 'UI_INPUT_MUST_BE_A_REGULAR_FILE');
  assert.equal(lstatSync(source).size, pin.bytes, 'UI_INPUT_SIZE_MISMATCH');
  const bytes = readFileSync(source);
  assert.equal(integrity(bytes), pin.integrity, 'UI_INPUT_INTEGRITY_MISMATCH');
  // The checked-in manifest owns this fixed build-output path. Do not follow
  // an existing directory/file link into another checkout or user file.
  for (const relative of ['artifacts', 'artifacts/build-inputs', pin.destination]) {
    const stat = lstatSync(join(root, relative), { throwIfNoEntry: false });
    assert(!stat?.isSymbolicLink(), 'UI_INPUT_DESTINATION_SYMLINK');
  }
  const destination = join(root, pin.destination);
  const existing = lstatSync(destination, { throwIfNoEntry: false });
  assert(!existing || existing.isFile(), 'UI_INPUT_DESTINATION_NOT_FILE');
  if (existing?.size === pin.bytes && integrity(readFileSync(destination)) === pin.integrity)
    return Object.freeze({ destination, integrity: pin.integrity, unchanged: true });
  mkdirSync(dirname(destination), { recursive: true });
  const temporary = mkdtempSync(join(dirname(destination), '.ui-peer-'));
  try {
    const file = join(temporary, 'input.tgz');
    writeFileSync(file, bytes, { flag: 'wx', mode: 0o644 });
    renameSync(file, destination);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  return Object.freeze({ destination, integrity: pin.integrity, unchanged: false });
}

export function buildUiPeer(repository) {
  assert.equal(Number(process.versions.node.split('.')[0]), 24, 'UI_BUILD_REQUIRES_NODE_24');
  const npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
  assert.equal(
    Number(npmVersion.split('.')[0]),
    manifest.runtime.npmMajor,
    'UI_BUILD_REQUIRES_NPM_11',
  );
  const repositoryPath = resolve(repository);
  const commit = execFileSync('git', ['rev-parse', '--verify', pin.sourceCommit + '^{commit}'], {
    cwd: repositoryPath,
    encoding: 'utf8',
  }).trim();
  assert.equal(commit, pin.sourceCommit, 'UI_BUILD_SOURCE_MISMATCH');
  const temporary = mkdtempSync(join(tmpdir(), 'inkforge-ui-input-'));
  try {
    const source = join(temporary, 'source');
    mkdirSync(source);
    const archive = execFileSync('git', ['archive', '--format=tar', commit], {
      cwd: repositoryPath,
      maxBuffer: 32 * 1024 * 1024,
    });
    execFileSync('tar', ['-xf', '-', '--no-same-owner', '-C', source], { input: archive });
    const cache = process.env.UI_NPM_CACHE
      ? resolve(process.env.UI_NPM_CACHE)
      : join(temporary, 'npm-cache');
    const npm = (args, capture = false) =>
      execFileSync('npm', args, {
        cwd: source,
        encoding: 'utf8',
        stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
        maxBuffer: 16 * 1024 * 1024,
      });
    npm([
      'ci',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--cache',
      cache,
      ...(process.env.UI_NPM_OFFLINE === '1' ? ['--offline'] : []),
    ]);
    npm(['run', 'build']);
    const packed = JSON.parse(
      npm(
        ['pack', '--json', '--ignore-scripts', '--cache', cache, '--pack-destination', temporary],
        true,
      ),
    );
    assert.equal(packed.length, 1);
    assert.equal(packed[0].name, pin.name);
    assert.equal(packed[0].version, pin.version);
    assert.equal(packed[0].integrity, pin.integrity, 'UI_BUILD_ARTIFACT_MISMATCH');
    return Object.freeze({
      ...stageUiPeer(join(temporary, packed[0].filename)),
      sourceCommit: commit,
      npmVersion,
    });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [mode, input, ...extra] = process.argv.slice(2);
    assert(
      input && extra.length === 0 && ['--artifact', '--repository'].includes(mode),
      'Usage: node scripts/prepare-ui-peer.mjs --artifact <tarball> | --repository <ui-repository>',
    );
    const result = mode === '--artifact' ? stageUiPeer(input) : buildUiPeer(input);
    console.log(JSON.stringify({ result: 'preparedPrivateBuildInput', name: pin.name, ...result }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
