# Changelog

## 0.1.0 — 2026-11-01

Initial release.

- Check local Markdown file links and image paths without network access or third-party dependencies.
- Validate Markdown heading anchors, including Unicode text and duplicate heading suffixes.
- Read inline and reference links while ignoring fenced code, inline code, and HTML comments.
- Provide file-and-line diagnostics, JSON output, and a JavaScript API.
- Limit link resolution to the configured root and reject symbolic-link targets.
- Include automated tests and English and Chinese usage documentation.

See [README.md](README.md) for the supported syntax and current limitations.
