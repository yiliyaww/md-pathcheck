import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { check } from '../lib/check.mjs';

const cli = fileURLToPath(new URL('../bin/md-pathcheck.mjs', import.meta.url));
const tempPrefix = path.join(tmpdir(), 'md-pathcheck-test-');

async function fixture(t, files) {
  const root = await mkdtemp(tempPrefix);
  t.after(async () => {
    // Restrict recursive cleanup to the directory this test just created.
    assert.ok(path.resolve(root).startsWith(path.resolve(tempPrefix)));
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    await rm(root, { recursive: true, force: true });
  });
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  return root;
}

function runCli(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.ifError(result.error);
  return result;
}

test('accepts relative documents, image paths, and percent-encoded filenames', async (t) => {
  const root = await fixture(t, {
    'README.md': '# Start\n\n[Guide](docs/quick%20start.md#setup)\n![Icon](assets/icon.png)\n',
    'docs/quick start.md': '# Setup\n',
    'assets/icon.png': Buffer.from([137, 80, 78, 71]),
  });
  assert.deepEqual((await check({ root })).issues, []);
});

test('reports broken document and image links with exact source locations', async (t) => {
  const root = await fixture(t, {
    'README.md': '# Start\n\n[Missing](missing.md)\n\n![Icon](absent.png)\n',
  });
  const { issues } = await check({ root });
  assert.deepEqual(
    issues.map(({ file, line, href, code }) => ({ file, line, href, code })),
    [
      { file: 'README.md', line: 3, href: 'missing.md', code: 'missing-target' },
      { file: 'README.md', line: 5, href: 'absent.png', code: 'missing-target' },
    ],
  );
  assert.ok(issues.every((issue) => typeof issue.message === 'string' && issue.message.length > 0));
});

test('validates duplicate and Unicode heading fragments', async (t) => {
  const root = await fixture(t, {
    'README.md': '[First](guide.md#hello-world)\n[Second](guide.md#hello-world-1)\n[Unicode](guide.md#%E4%B8%AD%E6%96%87-%E6%A0%87%E9%A2%98)\n[Missing](guide.md#no-such-heading)\n',
    'guide.md': '# Hello World\n\n# Hello World\n\n# 中文 标题\n',
  });
  const { issues } = await check({ root });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'missing-anchor');
  assert.equal(issues[0].line, 4);
  assert.equal(issues[0].href, 'guide.md#no-such-heading');
});

test('checks same-document anchors and accepts an empty fragment', async (t) => {
  const root = await fixture(t, {
    'README.md': '# Intro\n\n[Here](#intro)\n[Top](#)\n[Missing](#nowhere)\n',
  });
  const { issues } = await check({ root });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'missing-anchor');
  assert.equal(issues[0].line, 5);
});

test('preserves inline code text when generating heading anchors', async (t) => {
  const root = await fixture(t, {
    'README.md': '# Use `npm install`\n\n[Instructions](#use-npm-install)\n',
  });
  assert.deepEqual((await check({ root })).issues, []);
});

test('resolves case-insensitive reference links and reference images', async (t) => {
  const root = await fixture(t, {
    'README.md': '[Guide][GUIDE]\n![Logo][logo]\n[Broken][missing]\n\n[guide]: docs/guide.md#setup\n[logo]: logo.png\n[missing]: gone.md\n',
    'docs/guide.md': '# Setup\n',
    'logo.png': 'image fixture',
  });
  const { issues } = await check({ root });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].href, 'gone.md');
  assert.equal(issues[0].line, 3);
});

test('reports an explicit undefined reference without treating ordinary brackets as links', async (t) => {
  const root = await fixture(t, {
    'README.md': 'An ordinary [note] in prose.\n\n[Guide][undefined]\n',
  });
  const { issues } = await check({ root });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'undefined-reference');
  assert.equal(issues[0].line, 3);
});

test('skips code, comments, and external URLs without making requests', async (t) => {
  const root = await fixture(t, {
    'README.md': [
      '[Real](ok.md)',
      '`[Inline](no-inline.md)`',
      '```markdown',
      '[Fenced](no-fence.md)',
      '```',
      '<!-- [Comment](no-comment.md) -->',
      '[Web](https://example.invalid/does-not-exist#heading)',
      '[Mail](mailto:team@example.invalid)',
      '[Telephone](tel:+1234)',
      '[Protocol relative](//example.invalid/file)',
      '[Data](data:text/plain,hello)',
      '',
    ].join('\n'),
    'ok.md': '# Okay\n',
  });
  assert.deepEqual((await check({ root })).issues, []);
});

test('comment-like text in a fence and fence-like text in a comment do not hide later links', async (t) => {
  const root = await fixture(t, {
    'comment-in-fence.md': '```\n<!-- unclosed\n```\n[Missing](missing.md)\n',
    'fence-in-comment.md': '<!--\n```\n-->\n[Missing](missing.md)\n',
  });
  const { issues } = await check({ root });
  assert.deepEqual(
    issues.map(({ file, line, code }) => ({ file, line, code })),
    [
      { file: 'comment-in-fence.md', line: 4, code: 'missing-target' },
      { file: 'fence-in-comment.md', line: 4, code: 'missing-target' },
    ],
  );
});

test('accepts existing directories and ignores fragments on non-Markdown files', async (t) => {
  const root = await fixture(t, {
    'README.md': '[Docs](docs/)\n[Text](docs/plain.txt#whatever)\n',
    'docs/plain.txt': 'plain text',
  });
  assert.deepEqual((await check({ root })).issues, []);
});

test('blocks links that escape the scan root', async (t) => {
  const root = await fixture(t, {
    'README.md': '[Outside](../outside.md)\n',
  });
  const { issues } = await check({ root });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'outside-root');
});

test('reports malformed percent escapes in paths and fragments', async (t) => {
  const root = await fixture(t, {
    'README.md': '[Bad path](bad%ZZ.md)\n[Bad fragment](#bad%ZZ)\n',
  });
  const { issues } = await check({ root });
  assert.equal(issues.length, 2);
  assert.ok(issues.every((issue) => issue.code === 'invalid-url'));
  assert.deepEqual(issues.map((issue) => issue.line), [1, 2]);
});

test('does not follow in-root or outside-root directory links', async (t) => {
  const root = await fixture(t, {
    'README.md': '[Alias](alias/guide.md)\n[Outside](external/secret.md)\n',
    'docs/guide.md': '# Guide\n',
  });
  const outside = await fixture(t, {
    'secret.md': '# Outside\n[Broken](not-present.md)\n',
  });
  try {
    const type = process.platform === 'win32' ? 'junction' : 'dir';
    await symlink(path.join(root, 'docs'), path.join(root, 'alias'), type);
    await symlink(outside, path.join(root, 'external'), type);
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('This account cannot create directory links.');
    throw error;
  }
  const { issues } = await check({ root });
  assert.equal(issues.length, 2);
  assert.ok(issues.every((issue) => issue.code === 'symlink-target'));
  assert.deepEqual(issues.map((issue) => issue.href), ['alias/guide.md', 'external/secret.md']);
  await assert.rejects(check({ root, targets: ['alias/guide.md'] }), /symbolic link|symlink/i);
});

test('limits scanning to selected directories and excludes generated directories', async (t) => {
  const root = await fixture(t, {
    'README.md': '[Broken](missing.md)\n',
    'docs/guide.markdown': '# Guide\n',
    'node_modules/package/README.md': '[Broken](missing.md)\n',
    '.git/README.md': '[Broken](missing.md)\n',
    'vendor/README.md': '[Broken](missing.md)\n',
    'dist/README.md': '[Broken](missing.md)\n',
  });
  assert.deepEqual((await check({ root, targets: ['docs'] })).issues, []);
  const { issues } = await check({ root });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].file, 'README.md');
});

test('CLI provides parseable JSON and useful success/failure exit statuses', async (t) => {
  const root = await fixture(t, {
    'README.md': '[Missing](missing.md)\n',
    'docs/guide.md': '# Guide\n',
  });
  const failure = runCli(['--root', root, '--json']);
  assert.equal(failure.status, 1);
  const report = JSON.parse(failure.stdout);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].code, 'missing-target');

  const success = runCli(['--root', root, '--json', 'docs']);
  assert.equal(success.status, 0);
  assert.deepEqual(JSON.parse(success.stdout).issues, []);
});

test('CLI rejects unknown options and missing roots with exit status 2', async (t) => {
  const root = await fixture(t, { 'README.md': '# Guide\n' });
  assert.equal(runCli(['--not-an-option']).status, 2);
  assert.equal(runCli(['--root', path.join(root, 'missing-root')]).status, 2);
});

test('CLI help and version work without a project', () => {
  const help = runCli(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /md-pathcheck/);
  const version = runCli(['--version']);
  assert.equal(version.status, 0);
  assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+(?:[-+].+)?$/);
});
