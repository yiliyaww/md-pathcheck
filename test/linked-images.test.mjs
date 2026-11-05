import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { check } from '../lib/check.mjs';

const tempPrefix = path.join(tmpdir(), 'md-pathcheck-images-');

async function fixture(t, files) {
  const root = await mkdtemp(tempPrefix);
  t.after(async () => {
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

test('checks the local image in a badge linked to an external page', async (t) => {
  const root = await fixture(t, {
    'README.md': '# Badges\n\n[![Build](missing.svg)](https://example.invalid/build)\n',
  });
  const report = await check({ root });
  assert.equal(report.links, 1);
  assert.deepEqual(report.issues.map(({ line, href, code }) => ({ line, href, code })), [
    { line: 3, href: 'missing.svg', code: 'missing-target' },
  ]);
});

test('reports both the outer local link and its image exactly once', async (t) => {
  const root = await fixture(t, {
    'README.md': '[![Screenshot](missing.png)](missing-guide.md)\n',
  });
  const report = await check({ root });
  assert.equal(report.links, 2);
  assert.deepEqual(report.issues.map(({ href, code }) => ({ href, code })), [
    { href: 'missing-guide.md', code: 'missing-target' },
    { href: 'missing.png', code: 'missing-target' },
  ]);
});

test('supports inline, full, collapsed, and shortcut reference images in links', async (t) => {
  const root = await fixture(t, {
    'README.md': [
      '[![Inline](badge.svg)](guide.md#guide)',
      '[![Reference][logo]][guide]',
      '[![Logo][]](guide.md)',
      '[![logo]](guide.md)',
      '',
      '[logo]: badge.svg',
      '[guide]: guide.md#guide',
      '',
    ].join('\n'),
    'guide.md': '# Guide\n',
    'badge.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  });
  const report = await check({ root });
  assert.equal(report.links, 8);
  assert.deepEqual(report.issues, []);
});

test('reports an undefined full reference used by a linked image', async (t) => {
  const root = await fixture(t, {
    'README.md': '[![Build][missing]](https://example.invalid/build)\n',
  });
  const report = await check({ root });
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].line, 1);
  assert.equal(report.issues[0].href, '[missing]');
  assert.equal(report.issues[0].code, 'undefined-reference');
});

test('keeps original line numbers and source order for multiline linked images', async (t) => {
  const root = await fixture(t, {
    'README.md': '[\n  Status\n  ![Build](missing.svg)\n](https://example.invalid/build)\n[After](missing-after.md)\n',
  });
  const report = await check({ root });
  assert.deepEqual(report.issues.map(({ line, href }) => ({ line, href })), [
    { line: 3, href: 'missing.svg' },
    { line: 5, href: 'missing-after.md' },
  ]);
});

test('leaves ordinary bracket text and image alt text out of link checking', async (t) => {
  const root = await fixture(t, {
    'README.md': '[Guide [note]](guide.md)\n[![A [fake] and [link](not-a-target.md)](badge.svg)](guide.md)\n\n[fake]: not-a-reference-target.md\n',
    'guide.md': '# Guide\n',
    'badge.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  });
  const report = await check({ root });
  assert.equal(report.links, 3);
  assert.deepEqual(report.issues, []);
});

test('continues ignoring linked images inside code, comments, and link titles', async (t) => {
  const root = await fixture(t, {
    'README.md': [
      '`[![Code](code.svg)](code.md)`',
      '```md',
      '[![Fence](fence.svg)](fence.md)',
      '```',
      '<!-- [![Comment](comment.svg)](comment.md) -->',
      '[Guide](guide.md "[![Title](title.svg)](title.md)")',
      '[![Real](missing.svg)](https://example.invalid/build)',
      '',
    ].join('\n'),
    'guide.md': '# Guide\n',
  });
  const report = await check({ root });
  assert.equal(report.links, 2);
  assert.deepEqual(report.issues.map(({ line, href }) => ({ line, href })), [
    { line: 7, href: 'missing.svg' },
  ]);
});

test('applies root confinement to linked image paths', async (t) => {
  const root = await fixture(t, {
    'README.md': '[![Outside](../outside.svg)](https://example.invalid/build)\n',
  });
  const report = await check({ root });
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].href, '../outside.svg');
  assert.equal(report.issues[0].code, 'outside-root');
});
