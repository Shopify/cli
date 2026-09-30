<!--
title: app_info_file_effects
description: How shared app-project file state changes app-info output and side effects.
tags: [documentation, app-info, configuration, filesystem, testing]
-->

# App info file effects

This is the command-specific profile for the researched CLI baseline `8829ed581d25f964c53564c403bfbf94484753b4`. Shared state variants now live in the [command-testing skill](/.agents/skills/cli-command-tests/references/state-catalog.md). Discovery, parsing, hidden-file structures, and failure variants are defined in [app-project files](/.agents/skills/cli-command-tests/references/app-files.md). This profile specifies their result-mode effects and inputs app info does not apply.

## What reaches the command result

| Input                              | Text report                                                  | Full `--json` report                                                                   | `--web-env`, with or without `--json`                      |
| ---------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Selected dotenv file               | Values are not displayed.                                    | Includes `dotenv.path` and `dotenv.variables`; omits `dotenv` when no file was loaded. | Does not supply or override the three output values.       |
| Valid `shopify.environments.toml`  | Does not supply flags or change app selection.               | Does not supply flags or become part of the app object.                                | Does not supply credentials, scopes, or output-mode flags. |
| Malformed environments file        | Can abort before app loading.                                | Same failure boundary; not a successful JSON app report.                               | Same failure boundary.                                     |
| Selected hidden dev-store value    | Supplies the dev-store fallback after `build.dev_store_url`. | Serialized under `_hiddenConfig` because the renderer spreads the `App` instance.      | Not included in the three output values.                   |
| Hidden-state creation or migration | Can write files or fail before rendering.                    | Same loading and write behavior.                                                       | Same loading and write behavior.                           |

`--web-env` still loads the linked app. Its API key and secret come from the remote app; scopes come from the selected app configuration. It is not a command to print the contents of `.env`.

Sources: [command execution](/packages/app/src/cli/commands/app/info.ts), [info rendering](/packages/app/src/cli/services/info.ts), [web-env rendering](/packages/app/src/cli/services/app/env/show.ts), and [App fields](/packages/app/src/cli/models/app/app.ts).

## What a valid file does not do

App info does not declare an `environment` flag. The base class can load the `default` table, but it returns the original parsed flags before applying that table to this command.

For example, this valid file does **not** select staging, enable JSON, or reset the app:

```toml
[environments.default]
config = "staging"
json = true
reset = true
```

There is no “Using applicable flags” message for this command. A default table can be copied into sensitive metadata by the environment loader, but that is not flag application or a change to the app report.

`--environment staging` is an unsupported flag. `SHOPIFY_FLAG_ENVIRONMENT=staging` does not add support for it. Neither selects `.env.staging` or `shopify.app.staging.toml`.

## File-state fixtures

| Fixture                        | Local state                                                                                                         | Expected command behavior                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `environments/absent`          | No exact filename on the upward search path                                                                         | Continues silently with the original flags.                                                         |
| `environments/empty`           | Empty file or no `environments` section                                                                             | Continues silently; no environment defaults apply.                                                  |
| `environments/named-only`      | Named tables exist, but no `default` table                                                                          | Continues silently. Does not infer a name from the active app config.                               |
| `environments/default`         | Valid default table, including keys matching app-info flags                                                         | Reads it but does not apply it.                                                                     |
| `environments/false-boolean`   | Default table includes `json = false`                                                                               | Does not reach the generic environment-to-argv boolean rejection. App info skips application first. |
| `environments/nearest-wins`    | Valid files in a child directory, app root, and ancestor                                                            | Reads only the nearest one from the command path; no merge.                                         |
| `environments/near-empty`      | Nearest file is empty; an ancestor has defaults                                                                     | Empty file shadows the ancestor. No fallback search for a useful table.                             |
| `environments/near-malformed`  | Nearest file contains invalid TOML; an ancestor is valid                                                            | Parsing throws. Does not fall back to the ancestor.                                                 |
| `environments/above-project`   | Only an ancestor outside the project has the file                                                                   | Can read that file; malformed content can stop app info.                                            |
| `environments/path-override`   | Cwd and explicit `--path` lead to different nearest files                                                           | The parsed command path controls lookup.                                                            |
| `environments/wrong-name`      | Only `shopify.environment.toml`, `shopify.environments.staging.toml`, `.environments.toml`, or a misspelling exists | Not recognized by this lookup.                                                                      |
| `environments/off-search-path` | Exact filename exists only in an unvisited child or sibling                                                         | Not read.                                                                                           |
| `environments/read-failure`    | The lookup finds the file, but opening it fails or it disappears                                                    | The load throws; the normal report is not produced.                                                 |
| `environments/help`            | Malformed file, but argv requests framework help                                                                    | Framework help bypasses the command's parse/load path.                                              |

An inaccessible file that lookup cannot find may behave as absent. Distinguish that from a file that is found and then fails to read. Test file selection and read failures separately from value schemas: a successfully loaded default is **not applied** to app info.

## Dev-store precedence

The text report chooses:

1. `app.configuration.build.dev_store_url`, if non-nullish.
2. The resolved hidden `dev_store_url`, if non-nullish.
3. `Not yet configured`.

An empty string is not nullish, so it suppresses the fallback. Merely displaying a hidden store does not select a store session, authenticate to its Admin API, or query whether the store exists.

## Other .shopify contents

These artifacts have no dedicated read path in app info:

| Artifact                                                           | Owner or purpose                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------ |
| `logs/`                                                            | Dev logging                                                  |
| `dev-bundle/`                                                      | Dev extension bundle                                         |
| `deploy-bundle/`                                                   | Deployment bundle                                            |
| `mkcert`, `mkcert-LICENSE`, `localhost.pem`, `localhost-key.pem`   | Local development TLS                                        |
| `app-doctor/`                                                      | App Doctor artifacts                                         |
| Unrecognized JSON files, including a file named `identifiers.json` | Not a source of app-info IDs or preferences at this baseline |

Do not interpret every `.shopify/` artifact as command input. Sessions, cached GraphQL responses, and the preferred configuration filename live in separate per-user stores, not here.

There is one discovery caveat: the shared glob helper includes dot directories. The default web search is `**/shopify.web.toml` and excludes `node_modules`, **not `.shopify/`**. A copied `shopify.web.toml` inside `.shopify/` can therefore become a web component or cause a duplicate-role error. Custom extension or web directory patterns can also explicitly include hidden paths. This is normal configuration discovery, not special handling of a bundle or log directory.

Sources: [project globs](/packages/app/src/cli/models/project/project.ts), [glob defaults](/packages/cli-kit/src/public/node/fs.ts), [App paths](/packages/app/src/cli/models/app/app.ts), [dev bundle](/packages/app/src/cli/services/dev/app-events/app-event-watcher.ts), [deploy bundle](/packages/app/src/cli/services/deploy/bundle.ts), [TLS files](/packages/app/src/cli/utilities/mkcert.ts), and [App Doctor artifacts](/packages/app/src/cli/services/app-doctor-artifacts.ts).

## Fixture assertions

For each file-state fixture, record:

- The command's starting directory, resolved project root, selected TOML, and synthetic client ID.
- The files that are present, their bytes, and any deliberately denied reads or writes.
- stdout, stderr, exit status, requests, prompts, and a before/after filesystem diff.
- Whether full JSON includes or omits `dotenv`, and which `_hiddenConfig` entry it contains.
- Files that must remain unchanged, including inactive dotenv files and unrelated hidden artifacts.

Keep normal text, full JSON, and both web-env modes distinct. A file can change full JSON without changing text or web-env output. A loading failure can prevent all four modes.

Hidden files are not the only possible writes. Loading can generate extension `shopify.d.ts` files; a successful context load can add missing extension UIDs and update per-user app preferences. Linking can rewrite app TOML. Do not use “no change under `.shopify/`” as proof that app info was read-only.

Existing focused tests cover parts of discovery and selection: [Project tests](/packages/app/src/cli/models/project/project.test.ts), [config-selection tests](/packages/app/src/cli/models/project/config-selection.test.ts), [active-config tests](/packages/app/src/cli/models/project/active-config.test.ts), [environment-loader tests](/packages/cli-kit/src/public/node/environments.test.ts), and [hidden-folder tests](/packages/cli-kit/src/public/node/hidden-folder.test.ts). They do not establish command-level coverage of every state above.
