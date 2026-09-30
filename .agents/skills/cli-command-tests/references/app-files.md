# App-project file state

Apply these variants to commands using app Project/configuration loading. Track discovery, selection, parsing, validation, and writes separately. Loading does not imply a particular renderer, error-tolerance policy, or execution of web scripts. The source baseline is CLI commit `8829ed581d25f964c53564c403bfbf94484753b4`. Recheck changed readers and dependency versions before reusing an outcome.

## Dotenv files

### Discovery and selection

`Project.load()` discovers dotenv files in the **project root**, not in every web component or parent directory. It accepts exactly `.env` or filenames matching `^\.env\.[\w-]+$`. All matching files are read before the active app configuration is selected.

Selection then uses the app TOML filename:

| Selected app configuration    | Selected dotenv filename |
| ----------------------------- | ------------------------ |
| `shopify.app.toml`            | `.env`                   |
| `shopify.app.staging.toml`    | `.env.staging`           |
| `shopify.app.my-staging.toml` | `.env.my-staging`        |
| `shopify.app.local.toml`      | `.env.local`             |

There is no merge, override stack, or fallback to `.env` for named configurations. `.env.local` has no special priority. `NODE_ENV=production` does not select `.env.production`; selecting `shopify.app.production.toml` does.

An explicit configuration flag, a cached configuration preference, or linking to a newly named TOML can change the selected dotenv file. Whether a client-ID flag affects selection depends on the caller: `linkedAppContext()` uses it as a remote-ID override, while other callers can pass a client-ID selector to `selectActiveConfig()`.

Sources: [project discovery](/packages/app/src/cli/models/project/project.ts), [dotenv selection](/packages/app/src/cli/models/project/config-selection.ts), [configuration naming](/packages/app/src/cli/models/app/config-file-naming.ts), and [linked context](/packages/app/src/cli/services/app-context.ts).

### Presence and selection states

| Fixture                      | Local state                                                     | Expected behavior                                                                                     |
| ---------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `dotenv/absent`              | No matching dotenv file                                         | `app.dotenv` is undefined; normal loading continues.                                                  |
| `dotenv/default`             | Default app config and `.env`                                   | Loads `.env`.                                                                                         |
| `dotenv/named`               | Named app config and its matching dotenv file                   | Loads only the matching file.                                                                         |
| `dotenv/no-default-fallback` | Named app config, `.env` present, named dotenv absent           | No dotenv object. Does not load `.env`.                                                               |
| `dotenv/no-named-fallback`   | Default app config, `.env.staging` present, `.env` absent       | No dotenv object. Does not select the named file.                                                     |
| `dotenv/both`                | `.env` and `.env.staging` contain overlapping and distinct keys | Only the selected file's keys appear.                                                                 |
| `dotenv/empty`               | Selected file is empty or contains only comments                | Includes a dotenv object with its path and `variables: {}`. This differs from an absent file in JSON. |
| `dotenv/local-is-a-name`     | `.env.local` exists, but the default app config is selected     | `.env.local` is discovered but not selected.                                                          |
| `dotenv/example`             | `.env.example` exists                                           | Discovered like another named file, but selected only for `shopify.app.example.toml`.                 |
| `dotenv/ignored-filenames`   | `.env.production.local`, `.env.`, `.envrc`, or `app.env`        | Not accepted by the filename filter. No layered production/local behavior.                            |
| `dotenv/outside-root`        | `.env` exists only in a parent, child, or `web/` directory      | Not loaded as the app's dotenv file.                                                                  |
| `dotenv/unreadable-selected` | The selected file is discovered, but its read fails             | The per-file catch silently omits it. No dotenv validation error is added to `app.errors`.            |
| `dotenv/unreadable-inactive` | An unrelated accepted dotenv file cannot be read                | That file is omitted; the selected readable file still loads.                                         |
| `dotenv/disappears`          | A file disappears between globbing and reading                  | Its read fails and it is omitted.                                                                     |

The loader swallows per-file read failures, not every discovery or filesystem traversal failure. Test permission cases with an account that cannot bypass the intended restriction.

### Content states

The loader calls `dotenv.parse`, not `dotenv.config`. At this baseline, the dependency is `dotenv` 16.6.1. It returns string values and does not export them into `process.env`.

| Content                                                      | Parsed result or effect                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `KEY=value`                                                  | `{KEY: "value"}`                                                             |
| `KEY=`                                                       | Keeps `KEY` with an empty string.                                            |
| Repeated `KEY` assignments                                   | Last assignment wins.                                                        |
| Comments and lines without a recognized assignment           | Ignored rather than reported as schema errors.                               |
| `KEY=value # comment`                                        | Unquoted comment is removed.                                                 |
| `KEY="value # literal"`                                      | Keeps the hash inside the quoted value.                                      |
| Quoted multiline values                                      | Uses dotenv's quote and newline parsing rules.                               |
| `export KEY=value`                                           | Parses `KEY`; does not export it into the running process.                   |
| `KEY=${OTHER}`                                               | Keeps the literal `${OTHER}`; no dotenv-expand pass runs.                    |
| `SHOPIFY_FLAG_JSON=true` or an authentication token variable | Remains parsed app data; this reader does not reparse flags or authenticate. |
| `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, or `SCOPES`         | Remains parsed data. Rendering/exporting it is a separate consumer decision. |

A file with malformed-looking lines can still parse successfully, often as a partial or empty variables object. Do not treat every unusual dotenv line as a fatal-input fixture.

This reader does not create, normalize, or patch dotenv files. Commands that export environments or launch web processes can consume or write those values separately. Use synthetic values because a renderer can expose the parsed variables.

Source: [dotenv reader](/packages/cli-kit/src/public/node/dot-env.ts). Do not apply the stricter multiline rules in `patchEnvFile()` to this read-only parsing path.

## The environments file

The app-command filename is **`shopify.environments.toml`**. There is no leading dot, no singular `environment`, and no configuration-name suffix. A named app configuration does not imply a named environments file.

### Search path and shadowing

`AppCommand` supplies the environments filename. During flag parsing, `BaseCommand` searches upward from the parsed `--path` value, including its default or environment equivalent. It chooses the nearest file and does not merge files from multiple directories.

This happens **before project discovery**. The search does not stop at the app root or Git root. A file in an ancestor outside the app can be found, and a nearer file below the app root can shadow one at the root.

The lookup uses the original command path, not the project directory discovered later. Running from a nested directory and passing `--path` to the app root can therefore read different environments files even if both invocations select the same app TOML.

Sources: [AppCommand](/packages/app/src/cli/utilities/app-command.ts), [BaseCommand.resultWithEnvironment](/packages/cli-kit/src/public/node/base-command.ts), and [environmentFilePath](/packages/cli-kit/src/public/node/environments.ts).

### Read versus apply

The base class can read a default table before deciding whether the command supports an `environment` flag. A malformed or unreadable discovered file can therefore fail a command that does not apply environment defaults. With environment support, values can become command arguments; inspect the command's declarations and multi-environment handling.

Account for absent/empty/malformed files, default versus named tables, nearest-file shadowing, wrong filenames, off-search-path files, read failures, and help bypasses. An empty or malformed nearest file does not cause a search for a more useful ancestor. Theme commands use a separate `shopify.theme.toml` profile; the app filename and app-info's no-default-application outcome are not universal.

## Hidden project state

### Files created by hidden-config resolution

For a nonempty client ID, hidden-config resolution ensures these paths exist:

```text
<app root>/
└── .shopify/
    ├── .gitignore
    └── project.json
```

A missing `project.json` is created as `{}`. A missing `.shopify/.gitignore` is created with:

```gitignore
# Ignore the entire .shopify directory
*
```

Existing files are not rewritten just to normalize them. The helper does not edit the root `.gitignore`. A directory symlink is not rejected by this helper; reads and writes can reach its target. Keep any symlink targets inside the fixture sandbox.

Sources: [hidden folder creation](/packages/cli-kit/src/public/node/hidden-folder.ts), [project.json creation](/packages/app/src/cli/utilities/app/config/hidden-app-config.ts), and [hidden-config resolution](/packages/app/src/cli/models/project/config-selection.ts).

### Supported project.json structures

The current structure maps client IDs to local settings:

```json
{
  "fixture-client-a": {
    "dev_store_url": "fixture-a.myshopify.com"
  },
  "fixture-client-b": {
    "dev_store_url": "fixture-b.myshopify.com"
  }
}
```

The declared settings interface contains one optional field, `dev_store_url?: string`. The loader does not validate the object's shape at runtime.

The legacy structure has a flat dev-store string:

```json
{
  "dev_store_url": "fixture-legacy.myshopify.com"
}
```

Resolution prefers an object-valued entry for the selected client ID. Otherwise, a top-level string `dev_store_url` is returned and patched into an entry for that ID. The patch preserves other data, **including the legacy top-level key**. Migration does not replace the whole file with a canonical keyed-only form.

A matching empty object also wins over a legacy value. The migration write is best-effort, but creating the hidden directory, `.gitignore`, and missing `project.json` happens outside that catch and can fail the command.

Sources: [AppHiddenConfig](/packages/app/src/cli/models/app/app.ts), [resolution](/packages/app/src/cli/models/project/config-selection.ts), and [merge/write behavior](/packages/app/src/cli/services/app/patch-app-configuration-file.ts).

### Presence, contents, and write states

| Fixture                        | Local state                                                          | Expected behavior                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `hidden/no-directory`          | `.shopify/` is absent                                                | A linked load creates the directory, `.gitignore`, and `project.json`.                                                                        |
| `hidden/empty-directory`       | Directory exists, both files absent                                  | Creates both files.                                                                                                                           |
| `hidden/no-ignore`             | `project.json` exists, `.gitignore` absent                           | Creates `.gitignore`, even when hidden settings are already available.                                                                        |
| `hidden/existing-ignore`       | `.gitignore` contains custom or empty content                        | Leaves it unchanged; it is not parsed to select app settings.                                                                                 |
| `hidden/empty-object`          | `project.json` contains `{}`                                         | No hidden dev store; file remains `{}`.                                                                                                       |
| `hidden/matching-client`       | Keyed entry matches the effective app client ID                      | Loads that entry.                                                                                                                             |
| `hidden/other-client`          | Only other clients have entries                                      | Returns `{}` unless a legacy flat string also exists.                                                                                         |
| `hidden/legacy`                | Flat string, no matching object entry                                | Returns the flat value and attempts a merge-write under the client ID.                                                                        |
| `hidden/hybrid`                | Flat string plus matching keyed object                               | Keyed object wins, including when empty. No legacy fallback for a missing field within it.                                                    |
| `hidden/malformed-json`        | Invalid JSON or empty file                                           | Project discovery catches the parse error and uses `{}` in memory. The existing invalid file is not automatically repaired.                   |
| `hidden/unreadable-json`       | File exists but cannot be read                                       | Discovery uses `{}`. If the later existence checks pass, no repair write is required. Hidden-folder setup may still fail separately.          |
| `hidden/json-null`             | Valid JSON literal `null`                                            | Parsing succeeds, but resolution indexes the null value and can throw. Invalid JSON and invalid object shape are different cases.             |
| `hidden/non-object-root`       | A non-null JSON scalar or an array                                   | No object-shape validation runs. Without a usable keyed entry or legacy string, resolution returns `{}`; the original bytes remain unchanged. |
| `hidden/wrong-entry-type`      | Client entry is a string, number, or null                            | Does not qualify as a matching object. Falls back to a legacy string or `{}`.                                                                 |
| `hidden/array-entry`           | Client entry is an array                                             | Accepted by the loose object check, not rejected by a schema. Preserve as a malformed-shape regression fixture.                               |
| `hidden/unknown-fields`        | Matching entry contains extra properties                             | Entry is returned without stripping them; a renderer can expose them.                                                                         |
| `hidden/wrong-store-type`      | Matching object has non-string `dev_store_url`                       | Not validated by this reader. Follow the consuming renderer or store-selection code; do not assume clean validation or recovery.              |
| `hidden/read-only-complete`    | Both files exist and no migration is needed                          | Hidden-state loading itself needs no write. Other command writes remain possible.                                                             |
| `hidden/create-fails`          | Directory/file collision, or missing required file cannot be created | Setup throws; tolerated app errors do not cover this failure.                                                                                 |
| `hidden/migration-write-fails` | Setup succeeds, but the legacy patch write fails                     | Still returns the legacy dev store; migration failure is swallowed.                                                                           |
| `hidden/no-client-id`          | Initial config is unlinked                                           | Initial resolution returns `{}` without creating hidden files. A later linked load can create them.                                           |

In the linked-context profile, hidden settings are resolved during configuration selection and again during app loading. With a client-ID override, the lookups can use different IDs. Assert the selected value and all writes rather than assuming one resolution or migration attempt.

## Other project artifacts

Dev logs, dev/deploy bundles, local TLS certificates, and App Doctor artifacts have command-specific owners. They are not automatically configuration inputs. Inspect the selected command's reader before treating them as used or ignored.

Shared discovery can still find a `shopify.web.toml` inside a hidden directory, including `.shopify/`, or files matched by custom component patterns. This is ordinary project discovery, not special treatment of logs or bundles. See the [web discovery rules](toml-schemas/web-toml.md#file-presence-and-discovery).
