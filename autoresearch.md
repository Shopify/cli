# Autoresearch: Reduce Shopify CLI Bundle Size

## Objective
Reduce the total size of `packages/cli/dist` after running `pnpm bundle-for-release`. The bundle is built with esbuild (see `packages/cli/bin/bundle.js`), which bundles all CLI packages (app, theme, cli-kit, hydrogen) into a single output directory with code splitting.

## Metrics
- **Primary**: bundle_kb (KB, lower is better) — total size of `packages/cli/dist` via `du -sk`
- **Secondary**: js_kb (JS files only), maps_kb (source maps), assets_kb (non-JS/non-map files)

## How to Run
`./autoresearch.sh` — outputs `METRIC name=number` lines.

## Files in Scope
Everything in the repo. Key files:

- `packages/cli/bin/bundle.js` — esbuild bundle config (entry points, plugins, externals, splitting, copy assets)
- `packages/cli-kit/package.json` — dependencies of cli-kit (the largest source of bundled deps)
- `packages/cli-kit/src/` — cli-kit source code
- `packages/app/` — app package (bundled into CLI)
- `packages/theme/` — theme package (bundled into CLI)
- `packages/cli/package.json` — CLI package deps
- `bin/bundling/` — esbuild plugins (stacktracey, vscode, graphiql, dedup-cli-kit)

## Off Limits
- Don't break existing CLI functionality
- Don't remove features users depend on

## Constraints
- `pnpm test:unit`, `pnpm type-check`, `pnpm lint` must pass
- Keep current functionality intact
- Can remove unused deps or replace with lighter alternatives

## Bundle Analysis (Baseline ~131,236 KB)

### Size breakdown
- JS: ~48,772 KB (37%)
- Source maps: ~77,696 KB (59%)
- Assets: ~4,768 KB (4%)

### Top input modules by size (pre-bundle):
1. **@ts-morph/common**: 9,957 KB — used by Hydrogen for code generation
2. **typescript**: 8,899 KB — dependency of ts-morph
3. **prettier**: 3,966 KB — code formatting
4. **vscode-css-languageservice**: 1,484 KB — theme language server
5. **brotli**: 1,398 KB — JS brotli implementation (there's also a .wasm)
6. **react-dom**: 1,339 KB — needed for ink terminal UI
7. **@shopify/polaris-icons**: 1,182 KB — icon library in a CLI?
8. **react-reconciler (x2)**: 1,837 KB — two versions bundled (0.32.0 + 0.29.2)
9. **@shopify/polaris**: 939 KB — UI component library in a CLI?
10. **@opentelemetry/otlp-transformer**: 838 KB
11. **lodash**: 699 KB — full lodash bundle
12. **graphql**: 610 KB
13. **@oclif/core**: 592 KB
14. **ohm-js**: 389 KB
15. **iconv-lite**: 314 KB
16. **@vscode/web-custom-data**: 321 KB

### Quick wins to investigate:
- Source maps are 59% of bundle — can we disable or make them smaller?
- Two react-reconciler versions (ink v5 + ink v6?) — dedup
- polaris-icons (1.2MB) in a CLI tool seems wasteful
- lodash → es-toolkit or specific imports
- prettier is huge — can it be externalized or lazy-loaded?
- brotli JS impl may be unnecessary if native zlib is available
- typescript bundled just for ts-morph

## What's Been Tried
(Nothing yet — baseline measurement)
