# Lazy Loading Refactor: Option B → Option C Implementation Plan

> **Context document:** [`docs/lazy-loading-options.md`](lazy-loading-options.md)
> **Current branch:** `faster-startup` (has Option A implemented)
> **Goal:** Establish baseline measurements, implement Option B on a new branch, measure performance, then extend to Option C on a second branch. Both branches must pass CI (type-check, lint, bundle, tests, oclif-checks, knip).

---

## Phase 0: Measure `main` baseline

**Purpose:** Establish the baseline startup performance of `main` (no lazy loading). This is the number every other option is measured against.

### Step 1: Build and measure

```bash
git checkout main
pnpm build
hyperfine --warmup 3 --runs 20 'node packages/cli/bin/run.js version'
```

Record the full hyperfine output. This is the **worst-case baseline** — every command package (`@shopify/app`, `@shopify/theme`, `@shopify/cli-hydrogen`) is eagerly imported on every CLI invocation.

### Step 2: Record baseline in `docs/lazy-loading-options.md`

Add a baseline row at the top of each option's performance table. The `main` numbers will be reused in all subsequent phases — no need to re-measure.

| Metric | `main` (no lazy loading) |
|--------|--------------------------|
| **Mean** | _Xs ± Ys_ |
| **Median** | _Xs_ |
| **Range** | _Xs … Xs_ |

---

## Phase 1: Measure `faster-startup` branch (Option A)

**Purpose:** Measure the current `faster-startup` branch (Option A — custom command registry) against the `main` baseline.

### Step 1: Build and measure

```bash
git checkout faster-startup
pnpm build
hyperfine --warmup 3 --runs 20 'node packages/cli/bin/run.js version'
```

### Step 2: Side-by-side comparison (preferred)

If both branches are built in separate worktrees:

```bash
hyperfine --warmup 3 --runs 20 \
  -n 'main (no lazy loading)' 'node /path/to/main/packages/cli/bin/run.js version' \
  -n 'faster-startup (Option A)' 'node /path/to/faster-startup/packages/cli/bin/run.js version'
```

### Step 3: Record in `docs/lazy-loading-options.md`

Fill in the Option A performance table:

| Metric | `main` (no lazy loading) | `faster-startup` (Option A) | Delta |
|--------|--------------------------|----------------------------|-------|
| **Mean** | _from Phase 0_ | _Xs ± Ys_ | _-X%_ |
| **Median** | _from Phase 0_ | _Xs_ | _-X%_ |
| **Range** | _from Phase 0_ | _Xs … Xs_ | |

---

## Phase 2: Option B — Pattern Strategy with Thin Re-exports

**Branch:** `lazy-loading-option-b` (based off `main`)

### Step 1: Switch oclif strategy from `explicit` to `pattern`

**File:** `packages/cli/package.json`

Change:
```json
"commands": {
  "strategy": "explicit",
  "target": "./dist/index.js",
  "identifier": "COMMANDS"
}
```
To:
```json
"commands": {
  "strategy": "pattern",
  "target": "./dist/commands"
}
```

### Step 2: Create `packages/cli/src/commands/` directory with re-export files

Create one file per command. Each file is a thin re-export that maps to the real command class.

#### CLI-local commands (17 files) — move or re-export from `src/cli/commands/`

These already live in the monorepo. Each file re-exports the default from its current location:

```
commands/version.ts          → export {default} from '../cli/commands/version.js'
commands/search.ts           → export {default} from '../cli/commands/search.js'
commands/upgrade.ts          → export {default} from '../cli/commands/upgrade.js'
commands/help.ts             → export {default} from '../cli/commands/help.js'
commands/auth/logout.ts      → export {default} from '../../cli/commands/auth/logout.js'
commands/auth/login.ts       → export {default} from '../../cli/commands/auth/login.js'
commands/debug/command-flags.ts
commands/kitchen-sink/index.ts
commands/kitchen-sink/async.ts
commands/kitchen-sink/prompts.ts
commands/kitchen-sink/static.ts
commands/doctor-release/doctor-release.ts  ← NOTE: command ID is "doctor-release", file must match
commands/doctor-release/theme/index.ts
commands/docs/generate.ts
commands/notifications/list.ts
commands/notifications/generate.ts
commands/cache/clear.ts
```

**Important:** oclif's pattern strategy derives command IDs from file paths. `commands/app/dev.ts` → `app:dev`. The path must match the command ID exactly.

**Edge case — `doctor-release` command:** The command ID is `doctor-release`, but the implementation file is `doctor-release.ts`. With pattern strategy, `commands/doctor-release.ts` would produce command ID `doctor-release`. If the implementation is at `commands/doctor-release/doctor-release.ts`, the ID would be `doctor-release:doctor-release`. Need to verify: does the current command have ID `doctor-release` or is it nested? Check the manifest. The manifest shows `"id": "doctor-release"` — so the file should be `commands/doctor-release.ts` (not in a subdirectory), OR we use `commands/doctor-release/index.ts` which oclif resolves to `doctor-release`.

**Edge case — `webhook:trigger` (deprecated alias):** This command lives under app commands but its ID doesn't start with `app:`. It needs `commands/webhook/trigger.ts` re-exporting from `@shopify/app`.

**Edge case — `demo:watcher` and `organization:list`:** Same situation — app commands with non-`app:` prefixes. Need `commands/demo/watcher.ts` and `commands/organization/list.ts`.

#### App commands (34 files) — re-export from `@shopify/app`

Each file imports the `commands` object from `@shopify/app` and re-exports the specific command:

```ts
// commands/app/dev.ts
import {commands} from '@shopify/app'
export default commands['app:dev']
```

Full list:
```
commands/app/build.ts
commands/app/bulk/cancel.ts
commands/app/bulk/status.ts
commands/app/bulk/execute.ts
commands/app/config/link.ts
commands/app/config/use.ts
commands/app/config/pull.ts
commands/app/config/validate.ts
commands/app/deploy.ts
commands/app/dev.ts
commands/app/dev/clean.ts
commands/app/env/pull.ts
commands/app/env/show.ts
commands/app/execute.ts
commands/app/function/build.ts
commands/app/function/info.ts
commands/app/function/replay.ts
commands/app/function/run.ts
commands/app/function/schema.ts
commands/app/function/typegen.ts
commands/app/generate/extension.ts
commands/app/generate/schema.ts
commands/app/import-custom-data-definitions.ts
commands/app/import-extensions.ts
commands/app/info.ts
commands/app/init.ts
commands/app/logs.ts
commands/app/logs/sources.ts
commands/app/release.ts
commands/app/versions/list.ts
commands/app/webhook/trigger.ts
commands/webhook/trigger.ts          ← deprecated alias, different path
commands/demo/watcher.ts             ← app command with non-app prefix
commands/organization/list.ts        ← app command with non-app prefix
```

#### Theme commands (20 files) — re-export from `@shopify/theme`

```ts
// commands/theme/dev.ts
import ThemeCommands from '@shopify/theme'
export default ThemeCommands['theme:dev']
```

Full list:
```
commands/theme/check.ts
commands/theme/console.ts
commands/theme/delete.ts
commands/theme/dev.ts
commands/theme/duplicate.ts
commands/theme/info.ts
commands/theme/init.ts
commands/theme/language-server.ts
commands/theme/list.ts
commands/theme/metafields/pull.ts
commands/theme/open.ts
commands/theme/package.ts
commands/theme/preview.ts
commands/theme/profile.ts
commands/theme/publish.ts
commands/theme/pull.ts
commands/theme/push.ts
commands/theme/rename.ts
commands/theme/serve.ts
commands/theme/share.ts
```

#### Hydrogen commands (~25 files) — re-export from `@shopify/cli-hydrogen`

```ts
// commands/hydrogen/dev.ts
import {COMMANDS} from '@shopify/cli-hydrogen'
export default COMMANDS['hydrogen:dev']
```

Full list (verify against manifest — hydrogen commands are numerous):
```
commands/hydrogen/build.ts
commands/hydrogen/check.ts
commands/hydrogen/codegen.ts
commands/hydrogen/customer-account-push.ts
commands/hydrogen/debug/cpu.ts
commands/hydrogen/deploy.ts
commands/hydrogen/dev.ts
commands/hydrogen/env/list.ts
commands/hydrogen/env/pull.ts
commands/hydrogen/env/push.ts
commands/hydrogen/g.ts
commands/hydrogen/generate/route.ts
commands/hydrogen/generate/routes.ts
commands/hydrogen/init.ts
commands/hydrogen/link.ts
commands/hydrogen/list.ts
commands/hydrogen/login.ts
commands/hydrogen/logout.ts
commands/hydrogen/preview.ts
commands/hydrogen/setup.ts
commands/hydrogen/setup/css.ts
commands/hydrogen/setup/markets.ts
commands/hydrogen/setup/vite.ts
commands/hydrogen/shortcut.ts
commands/hydrogen/unlink.ts
commands/hydrogen/upgrade.ts
```

#### Plugin commands — re-export from oclif plugins and did-you-mean

```
commands/commands.ts                        ← from @oclif/plugin-commands
commands/plugins/index.ts                   ← from @oclif/plugin-plugins
commands/plugins/inspect.ts
commands/plugins/install.ts
commands/plugins/link.ts
commands/plugins/reset.ts
commands/plugins/uninstall.ts
commands/plugins/update.ts
commands/config/autocorrect/off.ts          ← from @shopify/plugin-did-you-mean
commands/config/autocorrect/on.ts
commands/config/autocorrect/status.ts
```

### Step 3: Handle `customPluginName` for analytics

Currently `index.ts` sets `customPluginName` on every command class at import time (lines 92-126). This is used by `packages/cli-kit/src/private/node/analytics.ts` to attribute commands to their source package.

**Two approaches:**

**(a) Set it in each re-export file:**
```ts
// commands/app/dev.ts
import {commands} from '@shopify/app'
const cmd = commands['app:dev']!
;(cmd as any).customPluginName = '@shopify/app'
export default cmd
```

**(b) Set it in a prerun hook** — the `prerun` hook already runs before every command. Add `customPluginName` assignment there based on command ID prefix. This is cleaner and centralizes the logic.

**Recommended: (b)** — add to existing `packages/cli/src/hooks/prerun.ts` or create a wrapper that assigns `customPluginName` based on command ID prefix mapping.

### Step 4: Simplify `bootstrap.ts`

Remove `lazyCommandLoader` — oclif handles lazy loading natively with `pattern` strategy:

```ts
async function runShopifyCLI({development}: {development: boolean}) {
  await runCLI({
    moduleURL: import.meta.url,
    development,
    // no lazyCommandLoader — oclif handles it via pattern strategy
  })
}
```

### Step 5: Simplify `cli-launcher.ts` and `ShopifyConfig`

- Remove `setLazyCommandLoader()` method from `ShopifyConfig`
- Remove `runCommand()` override (the entire lazy loading override)
- Remove `LazyCommandLoader` type export
- Remove `lazyCommandLoader` parameter from `runCLI()` and `launchCLI()`
- Keep `ShopifyConfig` class — it still has `customPriority` logic for hydrogen monorepo dev mode

### Step 6: Clean up dead code

- Delete `packages/cli/src/command-registry.ts`
- `packages/cli/src/index.ts` — keep it but remove the `COMMANDS` export and heavy imports. It may still be needed for non-command exports (`push`, `pull`, `fetchStoreThemes`, hook re-exports). Check what else imports from `@shopify/cli` — if only oclif uses it for commands, the barrel can be gutted. If other packages import utilities from it, keep those exports.
- Check if `searchForDefault()` is used anywhere else — if not, remove it.

### Step 7: Handle `index.ts` non-command exports

`index.ts` currently also exports:
- `DidYouMeanHook`, `TunnelStartHook`, `TunnelProviderHook`, `PluginHook` — hook re-exports
- `AppSensitiveMetadataHook`, `AppInitHook`, `AppPublicMetadataHook` — app hook re-exports
- `HydrogenInitHook` — hydrogen hook re-export
- `push`, `pull`, `fetchStoreThemes` — theme utility re-exports

**These are consumed by the hook files** (`packages/cli/src/hooks/*.ts`). But the hooks already import directly from their source packages (e.g., `hooks/app-init.ts` does `export {AppInitHook as default} from '@shopify/app'`). So the re-exports in `index.ts` are likely dead code.

**Verify with knip** — run `pnpm knip` to check if these exports are used. If unused, remove them. If used by external consumers, keep a minimal `index.ts` with just those exports.

### Step 8: Regenerate manifests and verify

```bash
pnpm build
pnpm refresh-manifests
```

Verify the generated `oclif.manifest.json` contains all expected commands with correct IDs, flags, and descriptions. Diff against the current manifest to ensure no commands were dropped.

### Step 9: Run CI checks locally

```bash
pnpm nx run-many --all --target=build
pnpm nx run-many --all --target=type-check
pnpm nx run-many --all --target=lint
pnpm nx run-many --all --target=bundle
pnpm vitest run
pnpm refresh-manifests  # verify no diff
pnpm knip
```

### Step 10: Measure performance

**This step is mandatory — the whole point of this refactor is measurable startup improvement.**

Measure startup time of `shopify version` (a lightweight command that exercises the full CLI bootstrap path without doing real work).

**Reuse the `main` baseline from Phase 0 and Option A baseline from Phase 1** — no need to re-measure.

#### 10a. Measure Option B branch

```bash
git checkout lazy-loading-option-b
pnpm build
hyperfine --warmup 3 --runs 20 'node packages/cli/bin/run.js version'
```

#### 10b. Side-by-side comparison with baselines (preferred)

If worktrees from Phase 0 and Phase 1 are still available:

```bash
hyperfine --warmup 3 --runs 20 \
  -n 'main (no lazy loading)' 'node /path/to/main/packages/cli/bin/run.js version' \
  -n 'faster-startup (Option A)' 'node /path/to/option-a/packages/cli/bin/run.js version' \
  -n 'option-b' 'node packages/cli/bin/run.js version'
```

#### 10c. If `hyperfine` is not available

```bash
# Install it
brew install hyperfine

# Or fallback to manual timing (less precise)
for i in {1..10}; do
  /usr/bin/time -p node packages/cli/bin/run.js version 2>&1 | grep real
done
```

#### 10d. What to record

Fill in the table in `docs/lazy-loading-options.md` under Option B:

| Metric | `main` (no lazy loading) | Option A (`faster-startup`) | Option B | Delta (B vs main) |
|--------|--------------------------|----------------------------|----------|-------------------|
| **Mean** | _from Phase 0_ | _from Phase 1_ | _Xs ± Ys_ | _-X%_ |
| **Median** | _from Phase 0_ | _from Phase 1_ | _Xs_ | _-X%_ |
| **Range** | _from Phase 0_ | _from Phase 1_ | _Xs … Xs_ | |

### Step 11: Update `docs/lazy-loading-options.md`

Fill in the Option B section with:
1. **Branch URL** — the GitHub compare or branch URL
2. **Performance table** — the metrics from Step 10, including Option A for comparison
3. Any notes on unexpected findings (e.g., if hook loading dominates startup, or if B is faster/slower than A)

---

## Phase 3: Option C — Plugin Wrapper Architecture

**Branch:** `lazy-loading-option-c` (based off `lazy-loading-option-b`)

Option C extends Option B by extracting re-export files into separate plugin wrapper packages. The `commands/` directory in `packages/cli/` shrinks to only CLI-local commands.

### Step 1: Create `packages/plugin-app/` wrapper package

```
packages/plugin-app/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── project.json
└── src/
    └── commands/
        └── app/
            ├── build.ts        ← re-export from @shopify/app
            ├── dev.ts
            └── ...
        └── webhook/
            └── trigger.ts      ← the deprecated alias
        └── demo/
            └── watcher.ts
        └── organization/
            └── list.ts
```

**`package.json`:**
```json
{
  "name": "@shopify/plugin-app",
  "version": "3.92.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "dependencies": {
    "@shopify/app": "3.92.0"
  },
  "oclif": {
    "commands": {
      "strategy": "pattern",
      "target": "./dist/commands"
    },
    "hooks": {
      "init": "./dist/hooks/init.js",
      "sensitive_command_metadata": "./dist/hooks/sensitive-metadata.js",
      "public_command_metadata": "./dist/hooks/public-metadata.js"
    }
  }
}
```

**Hooks** move from `packages/cli/src/hooks/` into the wrapper:
- `packages/plugin-app/src/hooks/init.ts` ← re-export `AppInitHook` from `@shopify/app`
- `packages/plugin-app/src/hooks/sensitive-metadata.ts`
- `packages/plugin-app/src/hooks/public-metadata.ts`

### Step 2: Create `packages/plugin-theme/` wrapper package

Same pattern. No hooks (theme has none).

```
packages/plugin-theme/
├── package.json
├── src/
│   └── commands/
│       └── theme/
│           ├── dev.ts
│           ├── push.ts
│           └── ...
```

### Step 3: Create `packages/plugin-hydrogen/` wrapper package

Wraps the external `@shopify/cli-hydrogen` package.

```
packages/plugin-hydrogen/
├── package.json
├── src/
│   └── commands/
│       └── hydrogen/
│           ├── dev.ts
│           └── ...
│   └── hooks/
│       └── init.ts         ← re-export from @shopify/cli-hydrogen HOOKS.init
```

### Step 4: Register plugins in root CLI

**`packages/cli/package.json`:**
```json
"oclif": {
  "commands": {
    "strategy": "pattern",
    "target": "./dist/commands"
  },
  "plugins": [
    "@shopify/plugin-app",
    "@shopify/plugin-theme",
    "@shopify/plugin-hydrogen",
    "@shopify/plugin-did-you-mean",
    "@oclif/plugin-commands",
    "@oclif/plugin-plugins"
  ]
}
```

Remove app/theme/hydrogen hooks from root CLI's hooks config — they now live in their respective plugins.

Root CLI hooks config shrinks to:
```json
"hooks": {
  "prerun": "./dist/hooks/prerun.js",
  "postrun": "./dist/hooks/postrun.js",
  "tunnel_start": "./dist/hooks/tunnel-start.js",
  "tunnel_provider": "./dist/hooks/tunnel-provider.js",
  "update": "./dist/hooks/plugin-plugins.js"
}
```

### Step 5: Shrink `packages/cli/src/commands/`

Only CLI-local commands remain:
```
commands/version.ts
commands/search.ts
commands/upgrade.ts
commands/help.ts
commands/auth/login.ts
commands/auth/logout.ts
commands/cache/clear.ts
commands/debug/command-flags.ts
commands/kitchen-sink/...
commands/doctor-release/...
commands/docs/generate.ts
commands/notifications/...
```

All app/theme/hydrogen/plugin re-exports are deleted — they now live in wrapper packages.

### Step 6: Build pipeline for wrapper packages

Each wrapper package needs:
- A `project.json` with build, type-check, and lint targets
- Entry in `pnpm-workspace.yaml` (already covered by `packages/*` glob)
- TypeScript config extending the root config
- Manifest generation (add to `refresh-manifests` script)

### Step 7: Handle `customPluginName`

With proper oclif plugins, `customPluginName` becomes unnecessary — oclif natively tracks which plugin owns each command via `Command.plugin`. The analytics code in `packages/cli-kit/src/private/node/analytics.ts` should be updated to prefer `commandClass.plugin?.name` and fall back to `customPluginName` only if needed.

### Step 8: Run CI checks

```bash
pnpm nx run-many --all --target=build
pnpm nx run-many --all --target=type-check
pnpm nx run-many --all --target=lint
pnpm nx run-many --all --target=bundle
pnpm vitest run
pnpm refresh-manifests  # verify no diff
pnpm knip
```

### Step 9: Measure performance

Same methodology as Phase 2 Step 10. Compare against **both** `main` and Option B:

```bash
hyperfine --warmup 3 --runs 20 \
  -n 'main' 'node /path/to/main/packages/cli/bin/run.js version' \
  -n 'option-b' 'node /path/to/option-b/packages/cli/bin/run.js version' \
  -n 'option-c' 'node packages/cli/bin/run.js version'
```

Fill in the table in `docs/lazy-loading-options.md` under Option C:

| Metric | `main` (baseline) | Option B | Option C | Delta (C vs main) |
|--------|-------------------|----------|----------|-------------------|
| **Mean** | _Xs ± Ys_ | _Xs ± Ys_ | _Xs ± Ys_ | _-X%_ |
| **Median** | _Xs_ | _Xs_ | _Xs_ | _-X%_ |
| **Range** | _Xs … Xs_ | _Xs … Xs_ | _Xs … Xs_ | |

### Step 10: Update `docs/lazy-loading-options.md`

Fill in the Option C section with:
1. **Branch URL** — the GitHub compare or branch URL
2. **Performance table** — the metrics from Step 9, including comparison to both `main` and Option B
3. Any notes on whether plugin isolation provided measurable improvement over Option B

---

## Risk Checklist

| Risk | Mitigation |
|------|-----------|
| Command ID mismatch (file path doesn't match expected ID) | Diff `oclif.manifest.json` before/after — every command must appear with correct ID |
| `customPluginName` breaks analytics | Add to re-export files or prerun hook; verify analytics tests pass |
| `knip` flags new re-export files as unused | May need knip config update for `commands/` directory |
| `plugins:install` description override lost | Move the `description = ''` and `hidden = true` assignments to re-export files |
| Hook loading order changes | Verify init hooks fire in same order (app-init before hydrogen-init) |
| `@shopify/cli-hydrogen` command list changes between versions | Generate hydrogen re-exports from the installed package's exports, not hardcoded |
| Manifest generation with pattern strategy produces different output | Compare field-by-field; `pluginAlias` and `pluginType` may differ |
| Option C: wrapper packages not discovered by oclif in dev mode | Test with `bin/dev.js` (development=true) — ShopifyConfig's `customPriority` may need adjustment |

---

## Performance Expectations

Both Option B and Option C achieve **per-package** lazy loading (not per-command). Running `shopify version` should NOT import `@shopify/app`, `@shopify/theme`, or `@shopify/cli-hydrogen`.

The performance delta between B and C should be minimal — the difference is whether oclif loads one plugin (with many commands) or several plugins (with fewer commands each). The expensive part is the package import, which both defer equally.

The main performance gain vs `main` (no lazy loading) is avoiding the import of ~6 heavy packages on every CLI invocation.
