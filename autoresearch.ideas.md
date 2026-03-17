# Autoresearch Ideas

- **isolate: false** — drops collect from 415s to 99s but breaks 458 tests. If test isolation issues could be fixed (shared state, mock leaks), this would be a huge win. Would need systematic cleanup of global state in tests.
- **Break up barrel exports** — `@shopify/cli-kit/node/ui` imports the entire UI library (React, Ink, all components). 30+ tests import this. Splitting into granular exports (e.g., `@shopify/cli-kit/node/ui/prompts`, `@shopify/cli-kit/node/ui/output`) could massively reduce collect time. Similarly `@shopify/cli-kit/node/fs` imports fs-extra, tempy, find-up, minimatch, fast-glob — 60+ test files pull all of this.
- **Replace `inTemporaryDirectory` with in-memory fs** — Top slow tests (extension.test.ts, link.test.ts, app-context.test.ts, loader.test.ts) spend most time on temp dir I/O. Using memfs or mock fs could save seconds.
- **Pre-compile test dependencies** — Use vitest's `deps.optimizer` to pre-bundle heavy node_modules (zod, fs-extra, ink, react) into faster ESM bundles.
- **Split extension.test.ts** (7.5s, 24 tests) into 2-3 files to improve parallelism
