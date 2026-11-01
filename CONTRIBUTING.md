# Contributing

Thanks for helping improve `md-pathcheck`. Small, reproducible improvements are welcome. The project aims to stay offline, dependency-free, and easy to run on Node.js 20 or newer.

## Report a bug

Open an issue with the Node.js version, operating system, command, expected result, and actual result. Include a minimal Markdown example and the relevant directory layout. Remove private paths, credentials, and confidential content first. For a suspected security issue, see [SECURITY.md](SECURITY.md).

If an anchor differs from your renderer, name the renderer and provide a small example. The current parser supports a documented Markdown subset; please discuss larger syntax additions before implementing them.

## Make a change

1. Create a branch for one focused change.
2. Update the implementation and add a regression test when behavior changes.
3. Update the English and Chinese README files if public behavior changes.
4. Run the checks below and describe the result in your pull request.

```sh
npm test
npm run check
```

No dependency installation is required. Tests use Node's built-in test runner. Keep fixtures local and temporary; tests must not depend on network services.

## Review expectations

Explain the problem, give a before-and-after example, and mention any parsing limitations or compatibility changes. Preserve deterministic diagnostics, root-relative paths, and the rule that checking never follows links outside the configured root.

By contributing, you agree that your contribution may be distributed under the project's [MIT license](LICENSE).
