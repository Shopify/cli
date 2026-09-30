# Persistent storage and app preferences

Store layout and serialization belong to the shared storage layer. The app-preference records apply to commands using the app configuration selectors or `linkedAppContext()`, not to every CLI command. Reads, selection, writes, and rendering can use different paths and fields. The source baseline is CLI commit `8829ed581d25f964c53564c403bfbf94484753b4`. Recheck changed readers and dependency versions before reusing an outcome.

## Storage locations and boundaries

App preferences and authentication use separate per-user stores. Neither is stored in the project's `.shopify/` directory.

| Store name             | Relevant contents                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `shopify-cli-app`      | App/configuration preferences keyed by normalized directory path.                                                              |
| `shopify-cli-kit`      | Serialized sessions and selected user ID. Also holds query caches and lifecycle preferences, covered in the network reference. |
| `shopify-cli-kit-test` | CLI-kit store selected in unit-test mode. This switch does not rename the app-preference store.                                |

The `LocalStorage` wrapper uses `conf` 11.0.2 and its `env-paths` configuration directory. With the default `nodejs` suffix, a store named `<store>` uses:

| Platform | Default file                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| macOS    | `~/Library/Preferences/<store>-nodejs/config.json`                                                                           |
| Linux    | `${XDG_CONFIG_HOME:-~/.config}/<store>-nodejs/config.json`                                                                   |
| Windows  | `%APPDATA%/<store>-nodejs/Config/config.json`; falls back to the home directory's `AppData/Roaming` when `APPDATA` is unset. |

These are not oclif's directories. `SHOPIFY_CONFIG_DIR`, `SHOPIFY_DATA_DIR`, and `SHOPIFY_CACHE_DIR` do not relocate these stores. Setting only `XDG_CONFIG_HOME` is not enough to isolate sessions on macOS.

`LocalStorage({cwd: temporaryDirectory})` provides a test seam for helpers that accept an injected store. Process-level tests must isolate the actual platform paths before loading storage modules. The app and CLI-kit store instances are lazy singletons.

The wrapper strips a leading UTF-8 byte-order mark before parsing store JSON and enables `clearInvalidConfig`. In the installed `conf`, invalid JSON is read as an empty store; a later write can replace the invalid file. There is no supplied runtime schema for the outer store or app-preference entries. Permission failures are not equivalent to an empty store. Even reading a missing store can create its parent directory.

Sources: [LocalStorage](/packages/cli-kit/src/public/node/local-storage.ts), [CLI-kit store](/packages/cli-kit/src/private/node/conf-store.ts), [app store](/packages/app/src/cli/services/local-storage.ts), and [dependency versions](/packages/cli-kit/package.json). The path and dot-notation details below were checked against the installed dependencies.

## Saved app and configuration preference

### Logical data shape

The app store exposes this logical mapping:

```ts
type CachedAppInfo = {
  directory: string
  configFile?: string
  appId?: string
  appGid?: string
  title?: string
  orgId?: string
  storeFqdn?: string
  updateURLs?: boolean
  previousAppId?: string
}

type AppPreferences = Record<string, CachedAppInfo> // Key: normalized directory path.
```

For a path without dots, an example store is:

```json
{
  "/fixtures/my-app": {
    "directory": "/fixtures/my-app",
    "configFile": "shopify.app.staging.toml",
    "appId": "fixture-client-id",
    "title": "Fixture app",
    "orgId": "123"
  }
}
```

`normalizePath()` normalizes path syntax. It does not resolve symlinks or establish that two paths identify the same directory.

**The store file is not always a flat mapping.** The wrapper leaves `conf`'s dot-notation access enabled. Setting the key `/fixtures/team.app` through the helper produces:

```json
{
  "/fixtures/team": {
    "app": {
      "directory": "/fixtures/team.app",
      "configFile": "shopify.app.staging.toml"
    }
  }
}
```

Reading that key through the helper returns the expected entry. Seed stores through the same access layer, or reproduce its serialization deliberately. A handcrafted flat key with dots is not equivalent to the helper's write.

Sources: [CachedAppInfo and access helpers](/packages/app/src/cli/services/local-storage.ts), [path normalization](/packages/cli-kit/src/public/node/path.ts), and [LocalStorage options](/packages/cli-kit/src/public/node/local-storage.ts).

### Preference states

These rows describe the default app configuration selector and linked-context flow. A caller can supply a different selector option, skip prompts, force relinking, or explicitly save a selection. Trace those choices before assigning a command outcome.

| Fixture                               | Stored/local state                                                | Command effect                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `preference/absent`                   | No entry for the project                                          | Uses the default app TOML unless a config flag is supplied.                                                                               |
| `preference/no-config`                | Entry contains app metadata but no `configFile`                   | Same selection fallback; cached `appId` does not select a TOML.                                                                           |
| `preference/named`                    | Saved filename exists                                             | Selects it without a configuration prompt.                                                                                                |
| `preference/flag-wins`                | Saved staging file; explicit production config                    | Selects the explicit file. Persistence depends on whether the caller invokes the configuration-preference write path.                     |
| `preference/stale-single`             | Saved file is gone; exactly one accepted app TOML remains         | Emits a warning, selects that file without a selection prompt, and saves it if it has a nonempty client ID.                               |
| `preference/stale-multiple`           | Saved file is gone; several app TOMLs remain                      | Emits a warning and asks which configuration to use. A needed prompt cannot run in an ordinary noninteractive terminal.                   |
| `preference/stale-unlinked`           | Recovery chooses a TOML without a client ID                       | Saving the preference fails with `Configuration file … needs a client_id.` Do not assume it always reaches linking.                       |
| `preference/existing-invalid`         | Saved file exists but is malformed or fails app-schema validation | Does not treat it as stale or silently switch to another file. Loading fails.                                                             |
| `preference/named-only-no-preference` | Only a named app TOML exists, with no saved or explicit selection | Default-file lookup can fail. This differs from stale-single recovery.                                                                    |
| `preference/metadata-mismatch`        | Cached app ID/title/org/store disagree with local or remote data  | The linked context fetches authoritative remote data and can update cached metadata. Other consumers must identify which fields they use. |
| `preference/moved-project`            | Same files at a new directory path                                | The previous path's preference is not automatically migrated.                                                                             |
| `preference/dotted-path`              | Project path contains dots                                        | Uses dot-notation storage; verify logical lookup and raw serialization separately.                                                        |
| `preference/invalid-entry`            | Valid JSON contains a wrong-type `configFile` or entry            | No entry schema validates it. Path/string operations can fail; do not assume invalid entries are discarded like malformed session data.   |
| `preference/store-write-fails`        | Reads succeed, but preference/metadata update cannot be persisted | Can abort before rendering, including after remote loading.                                                                               |

Stale detection checks whether the cached path exists, not whether its TOML is valid. The recovery flow uses `app config use` logic: one file is selected automatically; multiple files require a prompt. It requires a client ID when saving, but does not fully validate the app schema then.

Sources: [use service](/packages/app/src/cli/services/app/config/use.ts) and [configuration prompts](/packages/app/src/cli/prompts/config.ts).

### Writes and path identity

`setCachedAppInfo()` merges supplied fields over an existing entry. Updating remote app metadata preserves an existing `configFile`; it does not replace the whole entry with only the new fields.

A successful `linkedAppContext()` can update `appId`, `title`, and `orgId` before returning. Linking and stale-preference recovery save a configuration filename. A read-oriented caller can therefore affect the next invocation without rewriting app TOML.

Session serialization and account variants are in [authentication](authentication.md#stored-sessions-and-selected-account). Query-cache variants are in [network state](network.md#response-extensions-and-cache-states); version, notification, upgrade, and rate-limit state are in [lifecycle](lifecycle.md).

Selection reads the preference using `project.directory`, but `linkedAppContext()` updates app metadata using its original `directory` argument. Running from a nested directory can therefore read the project-root entry and write a separate nested-path entry. Do not assume every store access uses the discovered root.
