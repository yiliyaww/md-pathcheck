# md-pathcheck

Catch broken local Markdown links before they reach a pull request.

[简体中文](README.zh-CN.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md)

`md-pathcheck` is a small, offline command-line tool for documentation repositories. It checks local file links, image paths, and Markdown heading anchors without making network requests or installing dependencies.

This is the initial **0.1.0** release. It implements a useful subset of Markdown rather than a complete CommonMark parser.

## Quick start

Requires Node.js 20 or newer. Download or clone this repository, open its directory, and run:

```sh
node bin/md-pathcheck.mjs --root .
```

No `npm install` is needed. To scan only selected files or directories:

```sh
node bin/md-pathcheck.mjs --root . README.md examples
```

Paths after the options are relative to `--root`. The root defaults to the current directory. A target Markdown document can still be read to validate an anchor even when it is outside the selected scan paths, provided it is inside the root.

## What it catches

Suppose `docs/setup.md` links to a file that was renamed:

```md
[Installation](install.md#requirements)
![Screenshot](images/setup.png)
```

The checker verifies that each local destination exists. For links to `.md` or `.markdown` files, it also verifies a nonempty fragment against that document's generated heading anchors. Diagnostics include the source file and line:

```text
docs/setup.md:1 [missing-target] install.md#requirements — Target does not exist.
```

## CLI

```text
node bin/md-pathcheck.mjs [options] [files or directories...]

--root PATH  Project root; defaults to the current directory
--json       Print the report as JSON
--help, -h   Show help
--version    Show the version
--           Treat remaining arguments as paths
```

Without paths, all `.md` and `.markdown` files under the root are scanned recursively. Directory traversal skips `.git`, `node_modules`, `vendor`, `dist`, and symbolic links.

| Exit code | Meaning |
| --- | --- |
| `0` | No link issues found |
| `1` | At least one link issue found |
| `2` | Invalid arguments or an error reading the scan inputs |

## JSON and JavaScript API

```sh
node bin/md-pathcheck.mjs --root . --json
```

The report has numeric `files` and `links` counts and an `issues` array. `links` counts recognized local destinations; external URLs are excluded. Each issue has `file`, `line`, `href`, `code`, and `message` fields. File names are root-relative with `/` separators; line numbers start at 1.

```js
import { check } from './lib/check.mjs';

const report = await check({ root: process.cwd(), targets: ['README.md'] });
console.log(report.issues);
```

Omit `targets`, or pass an empty array, to scan the entire root. Invalid inputs and source-file read failures reject the promise. Broken destinations are returned as issues.

## Supported syntax and path rules

- Inline links and images, including angle-bracket destinations and optional titles.
- Full, collapsed, and defined shortcut reference links. Missing full or collapsed reference definitions are reported.
- ATX (`# Heading`) and setext headings, Unicode heading text, and duplicate heading suffixes such as `#setup-1`.
- Percent-encoded filenames and fragments. A path query is ignored when checking the local file.
- Paths relative to the source document. A leading `/` resolves from the configured project root.
- Same-document fragments such as `#quick-start`. An empty destination refers to the current document.
- Links in fenced code blocks, inline code, and HTML comments are ignored.
- URLs with a scheme, such as `https:`, `mailto:`, or `data:`, and protocol-relative URLs beginning `//` are skipped.

Links outside the root and links through symbolic links are reported as issues. Select the repository root when documents link between subdirectories.

## Limitations

The parser is intentionally small. It does not validate remote URLs, raw HTML links or IDs, MDX, custom renderer extensions, footnotes, indented code blocks, or every nested Markdown construct. Heading slugs are GitHub-style approximations and may differ from a particular documentation renderer. Undefined shortcut references cannot reliably be distinguished from ordinary bracketed text and are ignored.

A directory link is checked for existence only; the checker does not infer an `index.md` or `README.md`. Fragments on non-Markdown files and directories are not validated. A successful check means the supported local links passed these checks, not that the whole site will render correctly.

## Development

```sh
npm test
npm run check
npm pack
```

Tests use Node's built-in test runner and temporary fixture directories. `npm pack` runs tests and checks this repository's documentation before producing a local package archive. This repository does not require an npm registry release to use the CLI.

See [CONTRIBUTING.md](CONTRIBUTING.md) for changes and bug reports. Released under the [MIT license](LICENSE).
