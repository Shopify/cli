---
'@shopify/cli-kit': patch
---

Fix `installNodeModules()` using the wrong subcommand for yarn, pnpm, and bun when adding specific packages. The function now accepts an optional `packages: string[]` parameter; when provided, yarn, pnpm, and bun use their `add` subcommand (required for adding new packages) while npm continues to use `install`. Existing call sites that pass only `args` are unaffected.
