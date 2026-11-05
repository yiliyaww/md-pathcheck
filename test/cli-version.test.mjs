import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../bin/md-pathcheck.mjs', import.meta.url));
const checker = fileURLToPath(new URL('../lib/check.mjs', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const tempPrefix = 'md-pathcheck-cli-version-';

function runVersionCommand(file, option) {
  const result = spawnSync(process.execPath, [file, option], {
    cwd: tmpdir(),
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return result.stdout;
}

test('version and help match package metadata when run outside the project', () => {
  assert.equal(runVersionCommand(cli, '--version'), `${manifest.version}\n`);
  assert.ok(runVersionCommand(cli, '--help').startsWith(`md-pathcheck ${manifest.version} `));
});

test('an installed copy reports its own manifest version', async (t) => {
  const installedRoot = await mkdtemp(path.join(tmpdir(), tempPrefix));
  t.after(async () => {
    // Delete only this test's uniquely created temporary package directory.
    assert.equal(path.dirname(path.resolve(installedRoot)), path.resolve(tmpdir()));
    assert.ok(path.basename(installedRoot).startsWith(tempPrefix));
    await rm(installedRoot, { recursive: true, force: true });
  });
  await mkdir(path.join(installedRoot, 'bin'));
  await mkdir(path.join(installedRoot, 'lib'));
  const installedCli = path.join(installedRoot, 'bin', 'md-pathcheck.mjs');
  await copyFile(cli, installedCli);
  await copyFile(checker, path.join(installedRoot, 'lib', 'check.mjs'));
  const installedVersion = '9.8.7-regression';
  await writeFile(path.join(installedRoot, 'package.json'), JSON.stringify({ ...manifest, version: installedVersion }));

  assert.equal(runVersionCommand(installedCli, '--version'), `${installedVersion}\n`);
  assert.ok(runVersionCommand(installedCli, '--help').startsWith(`md-pathcheck ${installedVersion} `));
});
