# Changelog

## 0.1.1 — 2026-11-05

- Check image destinations inside linked Markdown labels, including inline and reference-style badge images. An external outer link no longer hides a broken local image.
- Preserve the inner image's source line and report each destination once.
- Read the CLI version from package metadata so help and `--version` stay in sync and work from any current directory.
- Add regression tests for linked images and CLI version reporting; update English and Chinese documentation.

## 0.1.0 — 2026-11-01

Initial release.

- Check local Markdown file links and image paths without network access or third-party dependencies.
- Validate Markdown heading anchors, including Unicode text and duplicate heading suffixes.
- Read inline and reference links while ignoring fenced code, inline code, and HTML comments.
- Provide file-and-line diagnostics, JSON output, and a JavaScript API.
- Limit link resolution to the configured root and reject symbolic-link targets.
- Include automated tests and English and Chinese usage documentation.

See [README.md](README.md) for the supported syntax and current limitations.
