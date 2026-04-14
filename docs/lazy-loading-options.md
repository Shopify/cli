# Lazy Command Loading: Architectural Options

## Background

The Shopify CLI uses [oclif](https://oclif.io/) as its command framework. The current architecture uses the **explicit** command discovery strategy, where all ~108 commands are exported from a single barrel file (`index.ts`). This means running `shopify version` eagerly imports `@shopify/app`, `@shopify/theme`, `@shopify/cli-hydrogen`, `@oclif/plugin-commands`, `@oclif/plugin-plugins`, and `@shopify/plugin-did-you-mean` — even though only one command runs.

This document compares three approaches to fixing that, evaluated against these principles:

> **Implementation plan:** [`.claude/plans/lazy-loading-refactor.md`](lazy-loading-refactor-plan.md)

### Principles

1. **Startup performance** — The CLI must only pay the import cost of the command being run. Running `shopify version` should not import `@shopify/app`, `@shopify/theme`, or `@shopify/cli-hydrogen`.
2. **Idiomatic code** — Apply well-understood patterns appropriate for the tools and problems at hand. When using a framework like oclif, work *with* its conventions rather than around them. Avoid reimplementing framework internals or relying on undocumented behavior.
3. **Ease of maintenance** — The solution should be easy to evolve. Adding, removing, or renaming a command should be a small, obvious change. Manual registries that drift from the source of truth are a maintenance liability. The less custom machinery layered on top of the framework, the less there is to break on upgrades.
4. **Testability** — The solution should minimize the amount of custom infrastructure that needs its own tests. Framework-provided behavior doesn't need to be re-tested; hand-rolled replacements for framework behavior do.
5. **Codebase compatibility** — The solution must work with the codebase as it exists today. External packages (`@shopify/cli-hydrogen`) live outside this monorepo. Each plugin package has its own export conventions and build pipeline. The approach must be compatible with these realities without requiring coordinated changes across teams or repositories.
6. **Small refactor scope** *(least important)* — All else being equal, prefer the approach that requires fewer file moves, fewer package-level structural changes, and less CI/build pipeline rework to land. A smaller diff is easier to review, less likely to introduce regressions, and faster to ship.

---

## Option A: Custom Command Registry (current branch)

| | |
|---|---|
| **Branch** | `faster-startup-4` |
| **Perf baseline (`main`)** | 1.778s ± 0.106s (range 1.647s … 2.010s) |
| **Perf result** | 0.388s ± 0.024s (range 0.362s … 0.441s) |
| **Delta** | **-78.2%** |

**Override oclif's `Config.runCommand()` with a hand-rolled registry that maps command IDs to dynamic imports.**

Keep the `explicit` strategy but bypass oclif's default loading by subclassing `Config` and intercepting command execution. A new `command-registry.ts` maps each command ID to a dynamic `import()` call.

### Key files

**`bootstrap.ts`** — new lightweight entry point (replaces `index.ts` as the startup file). It moves the global proxy agent setup, signal handlers, and `uncaughtException` handler out of `index.ts` so they run without importing any command modules:

```ts
// bootstrap.ts — intentionally imports nothing heavy
import {loadCommand} from './command-registry.js'
import {createGlobalProxyAgent} from 'global-agent'
import {runCLI} from '@shopify/cli-kit/node/cli'
import fs from 'fs'

createGlobalProxyAgent({
  environmentVariableNamespace: 'SHOPIFY_',
  forceGlobalAgent: true,
  socketConnectionTimeout: 60000,
})

process.on('uncaughtException', async (err) => {
  try {
    const {FatalError} = await import('@shopify/cli-kit/node/error')
    if (err instanceof FatalError) {
      const {renderFatalError} = await import('@shopify/cli-kit/node/ui')
      renderFatalError(err)
    } else {
      fs.writeSync(process.stderr.fd, `${err.stack ?? err.message ?? err}\n`)
    }
  } catch {
    fs.writeSync(process.stderr.fd, `${err.stack ?? err.message ?? err}\n`)
  }
  process.exit(1)
})

const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT']
signals.forEach((signal) => {
  process.on(signal, () => { process.exit(1) })
})

async function runShopifyCLI({development}: {development: boolean}) {
  await runCLI({
    moduleURL: import.meta.url,
    development,
    lazyCommandLoader: loadCommand,
  })
}

export default runShopifyCLI
```

**`command-registry.ts`** — maps command IDs to dynamic imports:

```ts
const cliCommands: Record<string, () => Promise<any>> = {
  version: () => import('./cli/commands/version.js'),
  search: () => import('./cli/commands/search.js'),
  'auth:logout': () => import('./cli/commands/auth/logout.js'),
  // ... every CLI-local command (17 total)
}

const appCommandIds = ['app:build', 'app:dev', 'app:deploy', /* ... 33 total */]

// Helper to find the default export or first class with a .run() method
function searchForDefault(module: any): any {
  if (module.default?.run) return module.default
  for (const value of Object.values(module)) {
    if (typeof value === 'function' && typeof (value as any).run === 'function') return value
  }
  return undefined
}

export async function loadCommand(id: string): Promise<any | undefined> {
  // CLI-local commands: import just that file
  const cliLoader = cliCommands[id]
  if (cliLoader) {
    const module = await cliLoader()
    return searchForDefault(module)
  }

  // App commands: import the package, grab one command
  if (appCommandIds.includes(id)) {
    const {commands} = await import('@shopify/app')
    return commands[id]
  }

  // Theme commands
  if (id.startsWith('theme:')) {
    const themeModule = await import('@shopify/theme')
    return themeModule.default?.[id]
  }

  // Hydrogen commands
  if (id.startsWith('hydrogen:')) {
    const {COMMANDS} = await import('@shopify/cli-hydrogen')
    return COMMANDS?.[id]
  }

  // Plugin commands (oclif built-ins, did-you-mean)
  if (id === 'commands') {
    const {commands} = await import('@oclif/plugin-commands')
    return commands[id]
  }
  if (id.startsWith('plugins')) {
    const {commands} = await import('@oclif/plugin-plugins')
    return commands[id]
  }
  if (id.startsWith('config:autocorrect')) {
    const {DidYouMeanCommands} = await import('@shopify/plugin-did-you-mean')
    return DidYouMeanCommands[id]
  }

  return undefined
}
```

**`custom-oclif-loader.ts`** — subclass of oclif's `Config`. Note: `ShopifyConfig` already existed before lazy loading — it handles hydrogen monorepo detection in dev mode and a custom plugin priority method. The lazy loading additions are `lazyCommandLoader`, `setLazyCommandLoader`, and the `runCommand` override:

```ts
import {Command, Config} from '@oclif/core'

export class ShopifyConfig extends Config {
  private lazyCommandLoader?: (id: string) => Promise<typeof Command | undefined>

  constructor(options: Options) {
    // Pre-existing: hydrogen monorepo detection and pluginAdditions for dev mode
    // Pre-existing: custom determinePriority override for dev mode
    super(options)
  }

  setLazyCommandLoader(loader: LazyCommandLoader): void {
    this.lazyCommandLoader = loader
  }

  async runCommand<T = unknown>(id: string, argv: string[] = [], cachedCommand?: Command.Loadable | null): Promise<T> {
    if (this.lazyCommandLoader) {
      const cmd = cachedCommand ?? this.findCommand(id)
      if (cmd) {
        const commandClass = await this.lazyCommandLoader(id)
        if (commandClass) {
          commandClass.id = id
          // Note: rootPlugin is a private oclif property accessed via cast
          commandClass.plugin = cmd.plugin ?? (this as any).rootPlugin
          await this.runHook('prerun', {argv, Command: commandClass})
          const result = await commandClass.run(argv, this)
          await this.runHook('postrun', {argv, Command: commandClass, result})
          return result
        }
      }
    }
    return super.runCommand(id, argv, cachedCommand)
  }
}
```

**`package.json`** hooks point to individual files instead of the barrel:

```json
"hooks": {
  "init": ["./dist/hooks/app-init.js", "./dist/hooks/hydrogen-init.js"],
  "command_not_found": "./dist/hooks/did-you-mean.js",
  "tunnel_start": "./dist/hooks/tunnel-start.js"
}
```

Each hook file is a one-liner re-export:

```ts
// hooks/app-init.ts
export {AppInitHook as default} from '@shopify/app'
```

### Evaluation

- **Startup performance:** Good. Avoids importing `@shopify/app`, `@shopify/theme`, and `@shopify/cli-hydrogen` until the target command runs. Does not achieve per-command isolation within a package (running `app:dev` still loads all of `@shopify/app`).
- **Idiomatic code:** Low. Overrides `runCommand()` to bypass oclif's own command loading, manually calling `prerun`/`postrun` hooks and setting `.id`/`.plugin` on command classes. The `searchForDefault()` heuristic — scanning module exports for something with `.run()` — exists because the registry bypasses the normal contract where oclif knows what a command class looks like. This reimplements what oclif's `pattern` strategy does natively.
- **Ease of maintenance:** Low. `command-registry.ts` is a manual mapping that must be kept in sync with commands across 5+ packages. Adding `app:new-thing` in `@shopify/app` requires also updating the registry in `@shopify/cli` — this will drift. The `runCommand()` override reimplements oclif lifecycle internals; if oclif adds a new lifecycle step, this path silently skips it. `customPluginName` is not set on lazy-loaded commands, breaking analytics attribution — fixing it requires threading it through both the registry and the `runCommand()` override.
- **Testability:** Low. The `runCommand()` override, `searchForDefault()` heuristic, and command-registry mappings are all custom infrastructure that need their own tests. The registry correctness is hard to cover exhaustively since it must match every command export shape across all packages.
- **Codebase compatibility:** High. Works with all packages as they exist today — no structural changes required in `@shopify/app`, `@shopify/theme`, or the external `@shopify/cli-hydrogen`. Only requires that each package exports commands by name, which they already do.
- **Small refactor scope:** Medium. Adds `bootstrap.ts`, `command-registry.ts`, and hook files in `@shopify/cli`. Modifies `ShopifyConfig` in `cli-kit`. Does not touch plugin packages. Moderate diff, but the new files are net-new custom infrastructure.

---

## Option B: Pattern Strategy with Thin Re-export Files

| | |
|---|---|
| **Branch** | `lazy-loading-option-b` |
| **Perf baseline (`main`)** | 1.778s ± 0.106s (range 1.647s … 2.010s) |
| **Perf result** | 1.594s ± 0.027s (range 1.556s … 1.646s) |
| **Delta** | **-10.3%** |
| **Note** | Heavy packages (`@shopify/app`, `@shopify/theme`, `@shopify/cli-hydrogen`) are NOT loaded for `version`. The remaining 1.6s is `@shopify/cli-kit` + oclif baseline cost. |

**Switch to oclif's native `pattern` discovery with a `commands/` directory where each file is a one-line re-export.**

oclif's `pattern` strategy discovers commands by scanning a `commands/` directory. Each file's path becomes the command ID (e.g., `commands/app/dev.ts` → `app:dev`). oclif already lazy-loads each file individually when the command runs — no custom `Config` subclass needed.

### Key files

**`package.json`** — switch strategy:

```json
"oclif": {
  "commands": {
    "strategy": "pattern",
    "target": "./dist/commands"
  }
}
```

**`commands/`** directory with thin re-exports — one file per command:

```
packages/cli/src/commands/
├── version.ts              ← local command (full implementation)
├── search.ts               ← local command (full implementation)
├── upgrade.ts              ← local command (full implementation)
├── auth/
│   ├── login.ts            ← local command
│   └── logout.ts           ← local command
├── app/
│   ├── dev.ts              ← re-export from @shopify/app
│   ├── build.ts            ← re-export from @shopify/app
│   ├── deploy.ts           ← re-export from @shopify/app
│   ├── info.ts             ← re-export from @shopify/app
│   ├── config/
│   │   ├── link.ts
│   │   └── use.ts
│   └── ...
├── theme/
│   ├── dev.ts              ← re-export from @shopify/theme
│   ├── push.ts             ← re-export from @shopify/theme
│   └── ...
└── hydrogen/
    ├── dev.ts              ← re-export from @shopify/cli-hydrogen
    └── ...
```

Each re-export file is minimal:

```ts
// commands/app/dev.ts
import {commands} from '@shopify/app'
export default commands['app:dev']
```

```ts
// commands/theme/push.ts
import ThemeCommands from '@shopify/theme'
export default ThemeCommands['theme:push']
```

```ts
// commands/hydrogen/dev.ts
import {COMMANDS} from '@shopify/cli-hydrogen'
export default COMMANDS['hydrogen:dev']
```

**`bootstrap.ts`** simplifies — no custom loader needed, but still needs the proxy agent setup, signal handlers, and `uncaughtException` handler (moved from `index.ts`):

```ts
import {createGlobalProxyAgent} from 'global-agent'
import {runCLI} from '@shopify/cli-kit/node/cli'
import fs from 'fs'

createGlobalProxyAgent({/* ... */})
process.on('uncaughtException', async (err) => { /* ... */ })
// ... signal handlers, column detection ...

async function runShopifyCLI({development}: {development: boolean}) {
  await runCLI({
    moduleURL: import.meta.url,
    development,
    // no lazyCommandLoader — oclif handles it
  })
}

export default runShopifyCLI
```

**`cli-launcher.ts`** drops the lazy loader plumbing but still needs `ShopifyConfig` (not stock `Config`) because it contains hydrogen monorepo detection and custom plugin priority logic unrelated to lazy loading:

```ts
import {ShopifyConfig} from './custom-oclif-loader.js'
import {run, flush, Errors, settings} from '@oclif/core'

const config = new ShopifyConfig({root: fileURLToPath(options.moduleURL)})
await config.load()
// no setLazyCommandLoader call — oclif handles lazy loading via pattern strategy
await run(options.argv, config)
```

### Evaluation

- **Startup performance:** Good. Same as Option A — avoids importing `@shopify/app`, `@shopify/theme`, and `@shopify/cli-hydrogen` until the target command runs. Does not achieve per-command isolation within a package (running `app:dev` still loads all of `@shopify/app`).
- **Idiomatic code:** High. Uses oclif's native `pattern` strategy — the framework's built-in answer to lazy loading. No `runCommand()` override, no manual registry. The filesystem convention (`commands/app/dev.ts` → `app:dev`) is the same pattern used by Salesforce CLI, Heroku CLI, and other large oclif projects. `ShopifyConfig` is still required for hydrogen monorepo detection and plugin priority, but the lazy-loading parts are removed.
- **Ease of maintenance:** High. No manual registry to keep in sync — adding a command means adding a one-line file. The filesystem is the source of truth. Won't break on oclif upgrades since it uses the supported API. `customPluginName` needs a new home (each re-export or a hook), but the fix is trivial. The ~108 re-export files are one line each, grep-able, git-blame-able, and individually deletable.
- **Testability:** High. Removes the `runCommand()` override entirely — oclif handles command loading, so there is no custom loading machinery to test. Each re-export file is independently importable. `bootstrap.ts` simplifies because it no longer threads a `lazyCommandLoader` through the call stack.
- **Codebase compatibility:** High. Works with all packages as they exist today. Only requires that each package exports commands by name, which they already do. The external `@shopify/cli-hydrogen` needs no changes.
- **Small refactor scope:** Medium. Adds ~108 one-line re-export files in a `commands/` directory, switches `package.json` to `strategy: "pattern"`, and carries over the `bootstrap.ts` and hook-splitting work. No changes to plugin packages. The re-export files are trivial individually but the file count is high.

---

## Option C: Proper oclif Plugin Architecture (with Wrapper Packages)

| | |
|---|---|
| **Branch** | _TODO: add branch URL (based on Option B branch)_ |
| **Perf baseline (`main`)** | 1.778s ± 0.106s |
| **Perf result** | _TODO: `shopify version` median time_ |
| **Delta vs B** | _TODO_ |

**Create thin wrapper plugin packages (`plugin-app`, `plugin-theme`, `plugin-hydrogen`) that re-export commands from the real packages, making each a proper oclif plugin without modifying the underlying packages.**

oclif's plugin system is designed for exactly this — a CLI composed of multiple independent command packages. Each plugin declares its own commands, hooks, and manifest. The root CLI just lists which plugins to load, and oclif handles discovery and lazy loading per-plugin.

### Key files

**Root `packages/cli/package.json`** — declare plugins:

```json
"oclif": {
  "commands": {
    "strategy": "pattern",
    "target": "./dist/commands"
  },
  "plugins": [
    "@shopify/app",
    "@shopify/theme",
    "@shopify/cli-hydrogen",
    "@shopify/plugin-did-you-mean",
    "@oclif/plugin-commands",
    "@oclif/plugin-plugins"
  ]
}
```

The root CLI only has its own local commands (`version`, `search`, `upgrade`, `auth:*`, etc.).

**Each plugin package** gets its own oclif config. For example, `packages/app/package.json`:

```json
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
```

**Plugin command files** use oclif's filesystem convention:

```
packages/app/src/commands/
├── app/
│   ├── dev.ts       ← full command implementation
│   ├── build.ts
│   ├── deploy.ts
│   └── config/
│       ├── link.ts
│       └── use.ts
```

**No barrel files needed.** Each plugin is self-contained. The root CLI's `index.ts` shrinks to almost nothing:

```ts
import {runCLI} from '@shopify/cli-kit/node/cli'

async function runShopifyCLI({development}: {development: boolean}) {
  await runCLI({moduleURL: import.meta.url, development})
}

export default runShopifyCLI
```

### Evaluation

- **Startup performance:** Best. Full per-plugin isolation — oclif lazy-loads each plugin, so a plugin's code is only loaded when one of its commands runs. However, the marginal improvement over Option B is small because the expensive imports are cross-package, not intra-package.
- **Idiomatic code:** Highest. The textbook oclif architecture — how Salesforce CLI, Heroku CLI, and other large oclif CLIs are structured. Each plugin declares its own commands, hooks, and manifest. No barrel files, no manual registries, no `runCommand()` override. `customPluginName` becomes unnecessary since oclif tracks plugin ownership natively.
- **Ease of maintenance:** High. Each wrapper plugin is self-contained — adding a command means adding a one-line re-export in the appropriate wrapper. Hooks are co-located with their plugin. The wrapper approach avoids restructuring `@shopify/app`, `@shopify/theme`, or coordinating with the Hydrogen team. `customPluginName` becomes unnecessary since oclif tracks plugin ownership natively.
- **Testability:** Highest in theory. Each plugin is independently testable with its own manifest. No custom loading infrastructure to test. The wrapper packages are trivial (one-line re-exports) so there's little to break.
- **Codebase compatibility:** High. Wrapper packages (`plugin-app`, `plugin-theme`, `plugin-hydrogen`) live in the monorepo and depend on the real packages as regular npm dependencies. No changes required to `@shopify/app`, `@shopify/theme`, or the external `@shopify/cli-hydrogen`.
- **Small refactor scope:** Medium. Creates 3 new wrapper packages with one-line re-export files, moves hooks from root CLI into wrappers, and updates root CLI's plugin config. The re-export files from Option B are redistributed, not rewritten. No changes to existing plugin packages.

---

## Comparison Summary

| Principle | A: Custom Registry | B: Pattern + Re-exports | C: Plugin Architecture |
|---|---|---|---|
| **Startup performance** | Good — per-package isolation | Good — per-package isolation | Best — per-plugin isolation (marginal delta over B) |
| **Idiomatic code** | Low — overrides `runCommand()`, reimplements framework internals | High — uses oclif's native `pattern` strategy | Highest — textbook oclif plugin architecture |
| **Ease of maintenance** | Low — manual registry drifts, `runCommand()` override to keep current | High — filesystem is the source of truth, no custom loading code | Mixed — best structure long-term, but major cross-repo refactor to get there |
| **Testability** | Low — registry mappings, `searchForDefault()`, and `runCommand()` override all need tests | High — no custom loading infrastructure to test | Highest in theory, but migration creates regression risk |
| **Codebase compatibility** | High — works with all packages as-is | High — works with all packages as-is | Low — requires cross-team coordination and restructuring external `cli-hydrogen` |
| **Small refactor scope** | Medium — new files in `cli` and `cli-kit`, no plugin changes | Medium — ~108 one-line files, no plugin changes | Very large — touches every package, cross-repo coordination |
