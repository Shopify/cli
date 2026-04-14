# Lazy Command Loading: Architectural Options

## Background

The Shopify CLI uses [oclif](https://oclif.io/) as its command framework. The current architecture uses the **explicit** command discovery strategy, where all ~108 commands are exported from a single barrel file (`index.ts`). This means running `shopify version` eagerly imports `@shopify/app`, `@shopify/theme`, `@shopify/cli-hydrogen`, `@oclif/plugin-commands`, `@oclif/plugin-plugins`, and `@shopify/plugin-did-you-mean` — even though only one command runs.

This document compares three approaches to fixing that, evaluated against these principles:

> **Implementation plan:** [`docs/lazy-loading-refactor-plan.md`](lazy-loading-refactor-plan.md)

### Principles

1. **Startup performance** — The CLI must only pay the import cost of the command being run. Running `shopify version` should not import `@shopify/app`, `@shopify/theme`, or `@shopify/cli-hydrogen`.
2. **Idiomatic code** — Apply well-understood patterns appropriate for the tools and problems at hand. When using a framework like oclif, work *with* its conventions rather than around them. Avoid reimplementing framework internals or relying on undocumented behavior.
3. **Ease of maintenance** — The solution should be easy to evolve. Adding, removing, or renaming a command should be a small, obvious change. Manual registries that drift from the source of truth are a maintenance liability. The less custom machinery layered on top of the framework, the less there is to break on upgrades.
4. **Testability** — The solution should minimize the amount of custom infrastructure that needs its own tests. Framework-provided behavior doesn't need to be re-tested; hand-rolled replacements for framework behavior do.
5. **Codebase compatibility** — The solution must work with the codebase as it exists today. External packages (`@shopify/cli-hydrogen`) live outside this monorepo. Each plugin package has its own export conventions and build pipeline. The approach must be compatible with these realities without requiring coordinated changes across teams or repositories.
6. **Small refactor scope** *(least important)* — All else being equal, prefer the approach that requires fewer file moves, fewer package-level structural changes, and less CI/build pipeline rework to land. A smaller diff is easier to review, less likely to introduce regressions, and faster to ship.

---

## Option A: Custom Command Registry

| | |
|---|---|
| **Branch** | `faster-startup-4` |
| **Perf baseline (`main`)** | 1.778s ± 0.106s (range 1.647s … 2.010s) |
| **Perf result** | 0.388s ± 0.024s (range 0.362s … 0.441s) |
| **Delta** | **-78.2%** |

**Override oclif's `Config.runCommand()` with a hand-rolled registry that maps command IDs to dynamic imports.**

Keep the `explicit` strategy but bypass oclif's default loading by subclassing `Config` and intercepting command execution. A `command-registry.ts` maps each command ID to a dynamic `import()` call. `ShopifyConfig` overrides both `runCommand()` (to use the registry instead of oclif's loading) and `runHook()` (to make init hooks non-blocking).

### How it works

1. `bootstrap.ts` replaces `index.ts` as the entry point — imports nothing heavy
2. `command-registry.ts` maps every command ID to a lazy `import()` — e.g. `'app:dev'` imports from `@shopify/app` only when that command runs
3. `ShopifyConfig.runCommand()` bypasses oclif's `cmd.load()` and calls the registry loader directly, then manually fires prerun/postrun hooks in the background
4. `ShopifyConfig.runHook('init')` fires init hooks in the background (non-blocking)

### Evaluation

- **Startup performance:** Good. Defers all heavy package imports until the target command runs.
- **Idiomatic code:** Low. Overrides `runCommand()` to bypass oclif's lifecycle, manually setting `.id`/`.plugin` on command classes and manually firing hooks. Reimplements what oclif's `pattern` strategy does natively.
- **Ease of maintenance:** Low. `command-registry.ts` is a manual mapping that must stay in sync with commands across 5+ packages. The `runCommand()` override reimplements oclif lifecycle internals — if oclif adds a new lifecycle step, this path silently skips it.
- **Testability:** Low. The `runCommand()` override, `searchForDefault()` heuristic, and command-registry mappings are all custom infrastructure that need their own tests.
- **Codebase compatibility:** High. Works with all packages as they exist today — no structural changes required.
- **Small refactor scope:** Medium. Adds `bootstrap.ts`, `command-registry.ts`, and hook files. Modifies `ShopifyConfig` in `cli-kit`.

---

## Option B: Pattern Strategy with Thin Re-export Files

| | |
|---|---|
| **Branch** | `lazy-loading-option-b` |
| **Perf baseline (`main`)** | 1.778s ± 0.106s (range 1.647s … 2.010s) |
| **Perf result** | 0.412s ± 0.012s (range 0.397s … 0.445s) |
| **Delta** | **-76.8%** |

**Switch to oclif's native `pattern` discovery with a `commands/` directory where each file is a one-line re-export.**

oclif's `pattern` strategy discovers commands by scanning a `commands/` directory. Each file's path becomes the command ID (e.g., `commands/app/dev.ts` → `app:dev`). oclif lazy-loads each file individually when the command runs — no `runCommand()` override needed.

### How it works

1. `bootstrap.ts` replaces `index.ts` as the entry point — imports nothing heavy, calls `process.exit(0)` after the command completes so background hooks don't delay the user
2. `package.json` switches from `strategy: "explicit"` to `strategy: "pattern"` pointing at `./dist/commands`
3. `commands/` directory contains ~108 thin re-export files — one per command. CLI-local commands (version, search, etc.) re-export from `../cli/commands/`. Package commands re-export from their source package (e.g. `import {commands} from '@shopify/app'; export default commands['app:dev']`)
4. Hooks are split into individual files with dynamic imports instead of referencing the barrel `index.ts`. Init hooks (`app-init.ts`, `hydrogen-init.ts`) are no-ops at startup — the real init logic runs lazily via the prerun hook on first relevant command
5. `ShopifyConfig` in `cli-kit` overrides `runHook()` to make `init`, `prerun`, and `postrun` hooks non-blocking (fire-and-forget). It does NOT override `runCommand()` — oclif's native pattern strategy handles command loading
6. The prerun hook assigns `customPluginName` for analytics attribution based on command ID prefix, and defers app/hydrogen init hooks until a relevant command runs

### Evaluation

- **Startup performance:** Good. Equivalent to Option A — heavy packages are not imported for non-app/theme/hydrogen commands.
- **Idiomatic code:** High. Uses oclif's native `pattern` strategy — the framework's built-in answer to lazy loading. No `runCommand()` override, no manual registry. `ShopifyConfig` is minimal — only overrides `runHook()` for non-blocking hooks, plus pre-existing hydrogen dev-mode logic.
- **Ease of maintenance:** High. No manual registry to keep in sync — adding a command means adding a one-line file. The filesystem is the source of truth. The ~108 re-export files are one line each, grep-able, git-blame-able, and individually deletable.
- **Testability:** High. No custom command loading machinery to test. Each re-export file is independently importable.
- **Codebase compatibility:** High. Works with all packages as they exist today. The external `@shopify/cli-hydrogen` needs no changes.
- **Small refactor scope:** Medium. Adds ~108 one-line re-export files, switches `package.json` strategy, adds `bootstrap.ts`, splits hooks into individual files, adds `ShopifyConfig` to `cli-kit`.

---

## Option C: Plugin Wrapper Architecture

| | |
|---|---|
| **Branch** | `lazy-loading-option-c` (based on `lazy-loading-option-b`) |
| **Perf baseline (`main`)** | 1.778s ± 0.106s (range 1.647s … 2.010s) |
| **Perf result** | 0.554s ± 0.025s (range 0.538s … 0.639s) |
| **Delta vs main** | **-68.8%** |
| **Delta vs B** | +34.4% slower (0.554s vs 0.412s) |

**Create thin wrapper plugin packages (`plugin-app`, `plugin-theme`, `plugin-hydrogen`) that re-export commands from the real packages, registered as proper oclif plugins.**

Extends Option B by moving re-export files out of `packages/cli/` into dedicated wrapper packages. The root CLI shrinks to only CLI-local commands (17 commands). Each wrapper is a proper oclif plugin with its own manifest and hooks.

### How it works

1. Three new packages: `packages/plugin-app/` (34 commands, 3 hooks), `packages/plugin-theme/` (20 commands), `packages/plugin-hydrogen/` (26 commands, 1 hook)
2. Each wrapper uses `strategy: "pattern"` with thin re-export files identical to Option B
3. The root CLI's `package.json` registers them via `oclif.plugins` array, alongside `@shopify/plugin-did-you-mean`, `@oclif/plugin-commands`, and `@oclif/plugin-plugins`. Plugins must be in `dependencies` (not `devDependencies`) for oclif to discover them
4. App/hydrogen init hooks and app metadata hooks move from the root CLI into `plugin-app` and `plugin-hydrogen` respectively — co-located with the commands they serve
5. The root CLI's hooks shrink to: `prerun`, `postrun`, `command_not_found`, `tunnel_start`, `tunnel_provider`, `update`
6. Same `ShopifyConfig` from Option B (non-blocking hooks) and same `process.exit(0)` in `bootstrap.ts`

### Evaluation

- **Startup performance:** Good. ~140ms slower than Option B due to oclif resolving 6 plugin packages at startup, but still 69% faster than main.
- **Idiomatic code:** Highest. Textbook oclif plugin architecture. Each plugin declares its own commands, hooks, and manifest. The root CLI is a thin orchestrator.
- **Ease of maintenance:** High. Each wrapper plugin is self-contained. Hooks are co-located with their plugin. Adding a command means adding a one-line file in the appropriate wrapper.
- **Testability:** High. Each plugin is independently testable with its own manifest. No custom loading infrastructure to test.
- **Codebase compatibility:** High. Wrapper packages live in the monorepo and depend on the real packages as regular dependencies. No changes required to `@shopify/app`, `@shopify/theme`, or `@shopify/cli-hydrogen`.
- **Small refactor scope:** Medium-large. Creates 3 new packages with build/lint/type-check targets, moves hooks from root CLI into wrappers, requires knip and nx configuration for the new packages.

---

## Comparison Summary

| Principle | A: Custom Registry | B: Pattern + Re-exports | C: Plugin Wrappers |
|---|---|---|---|
| **Startup performance** | 0.388s (-78%) | 0.412s (-77%) | 0.554s (-69%) |
| **Idiomatic code** | Low — overrides `runCommand()`, reimplements oclif internals | High — native `pattern` strategy, `ShopifyConfig` only overrides `runHook()` | Highest — textbook oclif plugin architecture |
| **Ease of maintenance** | Low — manual registry drifts from source of truth | High — filesystem is the source of truth | High — each wrapper is self-contained |
| **Testability** | Low — registry, `searchForDefault()`, and `runCommand()` all need tests | High — no custom loading infrastructure to test | High — each plugin testable independently |
| **Codebase compatibility** | High — works with all packages as-is | High — works with all packages as-is | High — wrapper packages, no changes to source packages |
| **Refactor scope** | Medium — new files in `cli` and `cli-kit` | Medium — ~108 re-export files, hook split, `ShopifyConfig` | Medium-large — 3 new packages, nx/knip config |

### Shared infrastructure (Options B and C)

Both Options B and C share these components that differ from Option A:

- **`bootstrap.ts`** — lightweight entry point that avoids importing heavy packages at module load time. Calls `process.exit(0)` after the command completes so background hooks don't delay the user.
- **`ShopifyConfig`** in `cli-kit` — overrides `runHook()` to make `init`, `prerun`, and `postrun` hooks fire-and-forget (non-blocking). Does NOT override `runCommand()`. Also contains pre-existing hydrogen monorepo dev-mode detection and custom plugin priority logic.
- **Node.js compile cache** — `bin/run.js` calls `enableCompileCache()` for faster repeat startups.
- **`customPluginName`** — set in the prerun hook based on command ID prefix, replacing the eager assignment that was previously done in `index.ts` at import time.
