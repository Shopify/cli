# Autoresearch: Shopify CLI Faster Startup

## Objective
Optimize the wall-clock startup time of the Shopify CLI (`shopify version` command). The main bottleneck is that `packages/cli/src/index.ts` statically imports ALL command modules from ALL packages (@shopify/app ~730ms, @shopify/cli-hydrogen ~90ms, @shopify/theme, etc.) even though only one command will run. The oclif manifest exists (106 commands cached) but isn't leveraged because `bin/dev.js` imports `index.ts` directly for the `runShopifyCLI` function, triggering the entire module graph.

## Metrics
- **Primary**: total_ms (ms, lower is better) — wall-clock time for `node packages/cli/bin/dev.js version`
- **Secondary**: import_ms — time to import the entry module

## How to Run
`./autoresearch.sh` — outputs `METRIC name=number` lines.

## Key Architecture
- `bin/dev.js` → imports `../dist/index.js` (default export = `runShopifyCLI`)
- `index.ts` statically imports 28 modules including @shopify/app (1s+), @shopify/theme, @shopify/cli-hydrogen
- `index.ts` exports: `COMMANDS` object, hook identifiers, `runShopifyCLI` (default)
- oclif explicit strategy: loads `./dist/index.js`, reads `COMMANDS` export
- `oclif.manifest.json` exists (298KB, 106 commands) — oclif can use it for metadata without importing
- `ShopifyConfig` extends oclif `Config`, loaded in `cli-launcher.ts`
- Hooks point to `./dist/index.js` with named identifiers — also trigger full import

## Files in Scope
- `packages/cli/src/index.ts` — main entry, all static imports live here
- `packages/cli/bin/dev.js` — development entry point
- `packages/cli/bin/run.js` — production entry point
- `packages/cli/package.json` — oclif config (commands, hooks)
- `packages/cli-kit/src/public/node/cli.ts` — runCLI function
- `packages/cli-kit/src/public/node/cli-launcher.ts` — launchCLI, creates ShopifyConfig
- `packages/cli-kit/src/public/node/custom-oclif-loader.ts` — ShopifyConfig class
- `packages/cli-kit/src/public/node/base-command.ts` — base command class (~400ms import)
- Any new files we create for lazy loading

## Off Limits
Nothing explicitly off limits, but changes should be compatible with existing tests.

## Constraints
- Tests must pass
- Lint must pass
- Type-check must pass
- Can add/remove dependencies and override oclif behavior

## Strategy
1. **Separate bootstrap from commands**: Create `bootstrap.ts` with only `runShopifyCLI` + side effects. `bin/dev.js` imports this instead of `index.ts`.
2. **Move hooks to separate files**: Each hook gets its own file so oclif config can point directly to it.
3. **Lazy command loading**: Override oclif's plugin loading in ShopifyConfig to dynamically import only the needed command.
4. **Reduce base-command weight**: Investigate what makes `@shopify/cli-kit/node/base-command` cost ~400ms.

## What's Been Tried
(nothing yet — starting baseline)
