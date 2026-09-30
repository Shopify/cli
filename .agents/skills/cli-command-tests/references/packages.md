# Package and installation state

Use the Project metadata profile when a command calls `Project.load()`. Package-manager, workspace, installation-warning, and framework helpers have their own readers and gates. Manifest parsing does not itself install dependencies or execute scripts; build/install commands may do that later. The source baseline is CLI commit `8829ed581d25f964c53564c403bfbf94484753b4`. Recheck changed readers and dependency versions before reusing an outcome.

## Package metadata and package-manager markers

### Root package.json

`Project.load()` checks for `package.json` at the discovered app root. It does not merge parent or child package manifests into the app's dependency map.

| Root package state                                | Project data and behavior                                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No `package.json`                                 | `packageManager: "unknown"`, `nodeDependencies: {}`, `usesWorkspaces: false`. This path skips package-manager detection even if lockfiles or an ancestor manifest exist. |
| Valid `{}`                                        | Reads as an empty dependency map; detects the package manager from markers/user agent; defaults to npm if neither identifies one.                                        |
| `dependencies` only                               | Copies those declared dependencies into `nodeDependencies`.                                                                                                              |
| `devDependencies` only                            | Copies those declared dependencies too.                                                                                                                                  |
| Same package in both maps                         | The dev-dependency value wins.                                                                                                                                           |
| `peerDependencies` or `optionalDependencies` only | Does not add them to this dependency map.                                                                                                                                |
| Malformed or empty JSON file                      | Throws a parse error rather than treating it as a missing manifest.                                                                                                      |
| Read fails after the existence check              | Throws. `unsafeTolerateErrors` does not turn this into a successful partial report.                                                                                      |
| Valid JSON with wrong field types                 | No package schema validates it here. Object-spread/truthiness rules or runtime errors determine behavior; do not assume a clean validation error.                        |

A leading byte-order mark is not stripped by the package JSON parser, unlike the local-store parser. Valid JSON syntax also does not guarantee an object: a root `null` reaches property access and fails.

For example:

```json
{
  "dependencies": {
    "fixture-runtime": "1.0.0",
    "fixture-shared": "1.0.0"
  },
  "devDependencies": {
    "fixture-shared": "2.0.0"
  },
  "workspaces": []
}
```

This yields `fixture-shared: "2.0.0"` in `nodeDependencies`. It also sets `usesWorkspaces` to true: an empty array is truthy in JavaScript. The workspace check does not require at least one package.

Sources: [Project metadata loading](/packages/app/src/cli/models/project/project.ts), [dependency/workspace helpers](/packages/cli-kit/src/public/node/node-package-manager.ts), and [JSON parser](/packages/cli-kit/src/public/common/json.ts).

### Package-manager detection

When the root package manifest exists, detection walks upward from the app root. At each directory, it checks these markers in order:

| Priority within one directory | Marker                                    | Result |
| ----------------------------- | ----------------------------------------- | ------ |
| 1                             | `yarn.lock`                               | `yarn` |
| 2                             | `pnpm-lock.yaml` or `pnpm-workspace.yaml` | `pnpm` |
| 3                             | `bun.lockb` or `bun.lock`                 | `bun`  |
| 4                             | `package-lock.json`                       | `npm`  |

**Nearest directory wins before marker priority.** A project-local `package-lock.json` wins over an ancestor's `yarn.lock`. If all markers are in one directory, Yarn wins. The walk does not stop at a Git or workspace boundary.

If no marker exists up to the filesystem root, detection checks `npm_config_user_agent` for a package-manager substring in the order yarn, pnpm, bun, npm. If none matches, it returns npm.

Detection checks existence, not lockfile syntax, installed binaries, or dependency resolution. Empty or malformed marker files select the same manager as populated ones. The manifest's `packageManager` and `engines` fields do not override this helper. `npm-shrinkwrap.json`, `.yarnrc.yml`, `.pnp.cjs`, `yarn-workspace.yaml`, and a `node_modules` directory are not markers in this lookup.

A package manager or Node launcher may independently read those files before starting Shopify CLI. Keep launcher behavior separate from the command's own project-data loading.

Source: [getPackageManager and packageManagerFromUserAgent](/packages/cli-kit/src/public/node/node-package-manager.ts).

### Workspace detection is a separate check

For a root manifest, `usesWorkspaces` is true when either:

- `Boolean(packageJson.workspaces)` is true, including an empty array or object.
- `pnpm-workspace.yaml` exists **at the app root**.

The workspace helper does not search ancestors and does not parse that YAML. An ancestor pnpm workspace marker can therefore yield `packageManager: "pnpm"` while `usesWorkspaces` stays false. A root workspace marker without a root `package.json` still takes the missing-manifest path and produces false.

## Multiple-installation warning

A truthy root dependency entry for `@shopify/cli` can trigger the **two-installations notice**. It is limited by the shared `most-recent-occurrence-warn-on-multiple-versions` cache entry, normally once per day, and suppressed when the JSON-output helper recognizes JSON mode.

The notice requires successful version detection, not just a declaration:

- When running globally, the helper runs `npm list @shopify/cli` in the app directory. It uses npm even when the project marker selects pnpm, Yarn, or Bun.
- When running locally, it searches PATH for a `shopify` executable outside `node_modules`, invokes it, and accepts a supported global version or prerelease.
- If version detection fails, the helper skips the notice. The interval wrapper can still record the check even when it emitted nothing.

These subprocesses are not app builds or dependency installs. Keep them distinct from the separate postrun auto-upgrade path. JSON environment-reader differences are documented in [flags and environment variables](runtime.md#environment-variable-value-rules).

Sources: [renderer](/packages/app/src/cli/services/info.ts), [installation notice](/packages/cli-kit/src/public/node/multiple-installation-warning.ts), [version subprocesses](/packages/cli-kit/src/public/node/version.ts), [interval cache](/packages/cli-kit/src/private/node/conf-store.ts), and [framework detection](/packages/cli-kit/src/public/node/framework.ts).

## Package fixture set

| Family                      | Cases and assertions                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package/presence`          | Missing root manifest versus `{}`; malformed JSON; byte-order mark; valid non-object JSON; read failure. Assert failure versus the explicit missing-manifest defaults.                                             |
| `package/dependencies`      | Production-only, dev-only, overlapping declarations, peer/optional-only, wrong field types, and child-only dependencies. Assert the exact JSON map.                                                                |
| `package/markers`           | Each supported marker, no marker, competing markers at one level, nearer low-priority marker, ancestor-only marker, and changed marker contents.                                                                   |
| `package/user-agent`        | Known/unknown/unset agent with no ancestor marker; marker overriding agent.                                                                                                                                        |
| `package/workspaces`        | Truthy empty array/object, absent field, root YAML marker, ancestor-only YAML marker, and marker without root package JSON.                                                                                        |
| `package/ignored-fields`    | Vary fields the selected reader ignores while holding consumed fields constant. A later build/install/launcher phase may read them or execute scripts; assert the boundary rather than a command-wide prohibition. |
| `package/two-installations` | Local dependency absent/present; missing/detected second installation; detection failure; fresh/expired daily cache; text versus JSON.                                                                             |
