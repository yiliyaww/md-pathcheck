import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const IGNORED = new Set(['.git', 'node_modules', 'vendor', 'dist']);
const MARKDOWN = /\.(?:md|markdown)$/i;
const slash = (value) => value.split(path.sep).join('/');
const blank = (value) => value.replace(/[^\r\n]/g, ' ');
const escaped = (text, index) => {
  let count = 0;
  while (index > 0 && text[--index] === '\\') count++;
  return count % 2 === 1;
};
const unescape = (value) => value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, '$1');
const entities = (value) => value.replace(/&(?:#(x[\da-f]+|\d+)|(amp|lt|gt|quot|apos));/gi, (match, numeric, named) => {
  if (numeric) {
    const number = numeric[0].toLowerCase() === 'x' ? parseInt(numeric.slice(1), 16) : Number(numeric);
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
      ? String.fromCodePoint(number) : '\uFFFD';
  }
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named.toLowerCase()];
});

/** A small GitHub-style heading slugger; see README for Markdown limitations. */
export function slug(text) {
  return entities(unescape(text)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!?\[([^\]]*)\](?:\[[^\]]*\])/g, '$1')
    .replace(/<[^>]*>/g, ''))
    .trim().toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function withoutBlocks(text) {
  let marker = null;
  let comment = false;
  return text.split(/(?<=\n)/).map((line) => {
    const match = /^ {0,3}(`{3,}|~{3,})(.*?)(?:\r?\n)?$/.exec(line);
    if (marker) {
      if (match && match[1][0] === marker[0] && match[1].length >= marker.length && !match[2].trim()) marker = null;
      return blank(line);
    }
    if (!comment && match && (match[1][0] !== '`' || !match[2].includes('`'))) {
      marker = match[1];
      return blank(line);
    }
    let result = '';
    let from = 0;
    while (from < line.length) {
      let boundary = line.indexOf(comment ? '-->' : '<!--', from);
      if (!comment && boundary !== -1) {
        // A comment-looking marker in a matched inline code span is literal.
        const runs = /`+/g;
        runs.lastIndex = from;
        let opening;
        while ((opening = runs.exec(line)) && opening.index < boundary) {
          if (escaped(line, opening.index)) continue;
          let closing;
          while ((closing = runs.exec(line)) && closing[0].length !== opening[0].length);
          if (!closing) break;
          if (boundary < runs.lastIndex) boundary = line.indexOf('<!--', runs.lastIndex);
          if (boundary === -1) break;
        }
      }
      if (boundary === -1) return result + (comment ? blank(line.slice(from)) : line.slice(from));
      if (comment) {
        result += blank(line.slice(from, boundary + 3));
        from = boundary + 3;
      } else {
        result += line.slice(from, boundary) + '    ';
        from = boundary + 4;
      }
      comment = !comment;
    }
    return result;
  }).join('');
}

function withoutInlineCode(text) {
  let result = '';
  let previous = 0;
  const ticks = /`+/g;
  let match;
  while ((match = ticks.exec(text))) {
    if (escaped(text, match.index)) continue;
    let closing;
    while ((closing = ticks.exec(text))) {
      if (closing[0].length === match[0].length) break;
    }
    if (!closing) { ticks.lastIndex = match.index + match[0].length; continue; }
    result += text.slice(previous, match.index) + blank(text.slice(match.index, ticks.lastIndex));
    previous = ticks.lastIndex;
  }
  return result + text.slice(previous);
}

function headings(text) {
  const result = new Set();
  const occurrences = new Map();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    let heading = /^ {0,3}#{1,6}(?:\s+(.*?)\s*|\s*)$/.exec(lines[i]);
    let label = heading ? (heading[1] ?? '').replace(/\s+#+\s*$/, '') : null;
    if (label === null && i + 1 < lines.length && lines[i].trim() && /^ {0,3}(?:=+|-+)\s*$/.test(lines[i + 1])) {
      label = lines[i].trim();
      i++;
    }
    if (label === null) continue;
    const base = slug(label);
    let candidate = base;
    let count = occurrences.get(base) ?? 0;
    while (result.has(candidate)) candidate = `${base}-${++count}`;
    occurrences.set(base, count);
    result.add(candidate);
  }
  return result;
}

function closingBracket(text, start) {
  let depth = 1;
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === '[') depth++;
    if (text[i] === ']' && --depth === 0) return i;
    if (text[i] === ']' && depth < 0) return -1;
  }
  return -1;
}

function destination(text, start) {
  let i = start + 1;
  while (/\s/.test(text[i] ?? '') && i < text.length) i++;
  let href = '';
  if (text[i] === '<') {
    i++;
    const begin = i;
    for (; i < text.length; i++) {
      if (text[i] === '\\') { i++; continue; }
      if (text[i] === '\n' || text[i] === '\r') return null;
      if (text[i] === '>') break;
    }
    if (i === text.length) return null;
    href = text.slice(begin, i++);
  } else {
    const begin = i;
    let depth = 0;
    for (; i < text.length; i++) {
      if (text[i] === '\\') { i++; continue; }
      if (text[i] === '(') depth++;
      if (text[i] === ')') {
        if (!depth) break;
        depth--;
      }
      if (/\s/.test(text[i])) break;
    }
    if (depth) return null;
    href = text.slice(begin, i);
  }
  if (text[i] === ')') return { href, end: i + 1 };
  if (!/\s/.test(text[i] ?? '')) return null;
  while (i < text.length && /\s/.test(text[i])) i++;
  if (text[i] === ')') return { href, end: i + 1 };
  const open = text[i];
  const close = open === '(' ? ')' : open;
  if (!['"', "'", '('].includes(open)) return null;
  for (i++; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === close) break;
  }
  if (i === text.length) return null;
  for (i++; i < text.length && /\s/.test(text[i]); i++);
  return text[i] === ')' ? { href, end: i + 1 } : null;
}

const referenceKey = (value) => unescape(value).trim().replace(/\s+/g, ' ').toLowerCase();

function links(text) {
  const refs = new Map();
  const clean = withoutInlineCode(text).replace(/^ {0,3}\[([^\]\n]+)\]:[ \t]*(?:<([^>\n]*)>|([^\s]+))(?:[^\r\n]*)$/gm, (whole, label, angle, bare) => {
    const key = referenceKey(label);
    if (!refs.has(key)) refs.set(key, angle ?? bare);
    return blank(whole);
  });
  function readLink(start, limit) {
    const labelEnd = closingBracket(clean, start);
    if (labelEnd === -1 || labelEnd >= limit) return null;
    const label = clean.slice(start + 1, labelEnd);
    if (clean[labelEnd + 1] === '(') {
      const parsed = destination(clean, labelEnd + 1);
      if (parsed && parsed.end <= limit) return { href: parsed.href, end: parsed.end, labelEnd };
    }
    // Full and collapsed references may contain whitespace after the first label.
    let after = labelEnd + 1;
    while (after < limit && /[ \t]/.test(clean[after])) after++;
    if (after < limit && clean[after] === '[') {
      const refEnd = closingBracket(clean, after);
      if (refEnd !== -1 && refEnd < limit) {
        const key = referenceKey(clean.slice(after + 1, refEnd) || label);
        return { href: refs.get(key), reference: key, end: refEnd + 1, labelEnd };
      }
    }
    const key = referenceKey(label);
    return refs.has(key) ? { href: refs.get(key), end: labelEnd + 1, labelEnd } : null;
  }
  const found = [];
  const labels = [];
  const isImage = (start) => start > 0 && clean[start - 1] === '!' && !escaped(clean, start - 1);
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] !== '[' || escaped(clean, i)) continue;
    const link = readLink(i, clean.length);
    if (!link) continue;
    found.push({ ...link, index: i });
    if (!isImage(i)) labels.push({ start: i + 1, end: link.labelEnd });
    i = link.end - 1;
  }
  // Link labels may contain images; image alt text is plain text. Scan these
  // bounded ranges once, without descending into alt text, destinations or titles.
  for (const label of labels) {
    for (let i = label.start; i < label.end; i++) {
      if (clean[i] !== '[' || escaped(clean, i) || !isImage(i)) continue;
      const link = readLink(i, label.end);
      if (!link) continue;
      found.push({ ...link, index: i });
      i = link.end - 1;
    }
  }
  found.sort((a, b) => a.index - b.index);
  let line = 1;
  let nextLine = clean.indexOf('\n');
  return found.map(({ index, href, reference }) => {
    while (nextLine !== -1 && nextLine < index) {
      line++;
      nextLine = clean.indexOf('\n', nextLine + 1);
    }
    return { line, href, ...(reference === undefined ? {} : { reference }) };
  });
}

const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
};

async function inspect(root, target) {
  if (!inside(root, target)) return { code: 'outside-root', message: 'Target is outside the configured root.' };
  const relative = path.relative(root, target);
  let current = root;
  let info;
  try {
    info = await lstat(root);
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      info = await lstat(current);
      if (info.isSymbolicLink()) return { code: 'symlink-target', message: 'Symbolic link targets are not followed.' };
    }
    return { info };
  } catch (error) {
    return error.code === 'ENOENT' || error.code === 'ENOTDIR'
      ? { code: 'missing-target', message: 'Target does not exist.' }
      : { code: 'unreadable-target', message: `Cannot inspect target (${error.code ?? 'IO error'}).` };
  }
}

/** Check local Markdown destinations. This function never makes network requests. */
export async function check({ root = process.cwd(), targets = [] } = {}) {
  root = await realpath(path.resolve(root));
  if (!(await lstat(root)).isDirectory()) throw new Error('Root must be a directory.');
  if (!Array.isArray(targets) || targets.some((target) => typeof target !== 'string')) throw new TypeError('Targets must be an array of paths.');
  const sources = new Set();
  async function walk(target, explicit = false) {
    const inspected = await inspect(root, target);
    if (inspected.code === 'symlink-target' && !explicit) return;
    if (inspected.code) throw new Error(`${slash(path.relative(root, target)) || '.'}: ${inspected.message}`);
    if (inspected.info.isDirectory()) {
      const entries = await readdir(target, { withFileTypes: true });
      entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
      for (const entry of entries) {
        if (entry.isSymbolicLink() || (entry.isDirectory() && IGNORED.has(entry.name))) continue;
        await walk(path.join(target, entry.name));
      }
    } else if (inspected.info.isFile() && MARKDOWN.test(target)) sources.add(target);
    else if (explicit) throw new Error('Selected files must use the .md or .markdown extension.');
  }
  for (const target of targets.length ? targets : ['.']) await walk(path.resolve(root, target), true);
  const cache = new Map();
  async function document(file) {
    if (!cache.has(file)) cache.set(file, readFile(file, 'utf8').then((text) => {
      const clean = withoutBlocks(text.replace(/^\uFEFF/, ''));
      return { anchors: headings(clean), links: links(clean) };
    }));
    return cache.get(file);
  }
  const report = { files: sources.size, links: 0, issues: [] };
  for (const file of [...sources].sort()) {
    const parsed = await document(file);
    for (const link of parsed.links) {
      const context = { file: slash(path.relative(root, file)), line: link.line, href: link.href ?? `[${link.reference}]` };
      const issue = (code, message) => report.issues.push({ ...context, code, message });
      if (link.href === undefined) { issue('undefined-reference', 'Reference link has no definition.'); continue; }
      const href = entities(unescape(link.href));
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue;
      report.links++;
      let pathname;
      let fragment;
      try {
        const hash = href.indexOf('#');
        const beforeHash = hash === -1 ? href : href.slice(0, hash);
        pathname = decodeURIComponent(beforeHash.split('?')[0]);
        fragment = hash === -1 ? '' : decodeURIComponent(href.slice(hash + 1));
        if (pathname.includes('\0') || fragment.includes('\0')) throw new Error('NUL');
      } catch {
        issue('invalid-url', 'Invalid percent encoding or NUL in destination.');
        continue;
      }
      // A leading slash means a project-root-relative path, independent of OS.
      const target = pathname === '' ? file : pathname.startsWith('/')
        ? path.resolve(root, `.${pathname}`) : path.resolve(path.dirname(file), pathname);
      const inspected = await inspect(root, target);
      if (inspected.code) { issue(inspected.code, inspected.message); continue; }
      if (fragment && MARKDOWN.test(target) && inspected.info.isFile()) {
        try {
          if (!(await document(target)).anchors.has(fragment)) issue('missing-anchor', `Heading anchor #${fragment} does not exist.`);
        } catch (error) {
          issue('unreadable-target', `Cannot read Markdown target (${error.code ?? 'IO error'}).`);
        }
      }
    }
  }
  return report;
}
