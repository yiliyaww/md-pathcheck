# Security

`md-pathcheck` reads local Markdown files and filesystem metadata. It makes no network requests. Destination paths outside the configured root and paths through symbolic links are rejected; symbolic links are skipped during directory traversal.

Choose a root that contains the documentation you intend to inspect. The tool is not a sandbox and is not designed to safely process a filesystem being modified by an untrusted process at the same time. Do not include credentials or confidential content in reports or diagnostic output you publish.

## Reporting a vulnerability

If this repository has GitHub private vulnerability reporting enabled, use its **Security → Report a vulnerability** flow. Otherwise, open an issue asking for a private reporting channel without including exploit details, sensitive files, credentials, or private filesystem paths. Wait for a maintainer to arrange a private channel before sharing those details.

Include the affected version, platform, a minimal reproduction, and the expected security boundary. Avoid accessing other people's files or systems when reproducing a problem.

This is an early project. There is no guaranteed response time or separate long-term support branch. Security fixes will be made in the current release line where practical.
