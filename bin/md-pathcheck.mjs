#!/usr/bin/env node
import { check } from '../lib/check.mjs';

const help = `md-pathcheck 0.1.0 — check local Markdown links and heading anchors

Usage: node bin/md-pathcheck.mjs [options] [files or directories...]

Options:
  --root PATH  Project root; targets are relative to it (default: current directory)
  --json       Print a JSON report
  --help, -h   Show this help
  --version    Show version
  --           Treat remaining arguments as paths

No paths scans the root recursively. Ignores .git, node_modules, vendor, dist,
and symlinks while walking. Links never leave the root or follow symlinks.
Exit codes: 0 = no issues, 1 = broken links, 2 = usage or filesystem error.
`;

async function main() {
  const args = process.argv.slice(2);
  const targets = [];
  let root = process.cwd();
  let json = false;
  let positional = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (positional) { targets.push(arg); continue; }
    if (arg === '--') positional = true;
    else if (arg === '--help' || arg === '-h') { process.stdout.write(help); return; }
    else if (arg === '--version') { process.stdout.write('0.1.0\n'); return; }
    else if (arg === '--json') json = true;
    else if (arg === '--root') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--root requires a path.');
      root = args[++i];
    } else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else targets.push(arg);
  }
  const report = await check({ root, targets });
  if (json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    for (const issue of report.issues) process.stdout.write(`${issue.file}:${issue.line} [${issue.code}] ${issue.href} — ${issue.message}\n`);
    process.stdout.write(`${report.files} Markdown files, ${report.links} local links, ${report.issues.length} issues\n`);
  }
  process.exitCode = report.issues.length ? 1 : 0;
}

main().catch((error) => {
  process.stderr.write(`md-pathcheck: ${error.message}\n`);
  process.exitCode = 2;
});
