# Example documentation

This small documentation tree passes the checker and can be copied into a test repository.

[![Works offline](assets/offline.svg)](guide/getting-started.md#getting-started)

The clickable badge above checks both its local image path and its documentation destination.

- [Getting started](guide/getting-started.md#getting-started)
- [Chinese heading](guide/getting-started.md#快速开始)
- [Repeated heading](guide/getting-started.md#example-1)
- [Project license](../LICENSE)

Run from the project root:

```sh
node bin/md-pathcheck.mjs examples
```

To see a failure, add a link to a file that does not exist, then run the command again.
