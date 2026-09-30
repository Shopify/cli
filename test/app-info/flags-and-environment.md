<!--
title: app_info_flags_and_environment
description: App-info flags, configuration selection, and command-specific environment effects.
tags: [documentation, app-info, flags, environment, testing]
-->

# App info flags and environment

This is the command-specific profile for the researched CLI baseline `8829ed581d25f964c53564c403bfbf94484753b4`. Shared state variants now live in the [command-testing skill](/.agents/skills/cli-command-tests/references/state-catalog.md). This file records declared flags and their app-info effects; parser, terminal, startup, and lifecycle mechanics are in the [runtime reference](/.agents/skills/cli-command-tests/references/runtime.md).

## Declared flags

Sources: [AppInfo](/packages/app/src/cli/commands/app/info.ts), [shared app flags](/packages/app/src/cli/flags.ts), [CLI flags](/packages/cli-kit/src/public/node/cli.ts), [AppCommand](/packages/app/src/cli/utilities/app-command.ts).

### Command-specific flag

| Flag        | Type/default     | Environment variable          | Effect                                                                                                                                                                 |
| ----------- | ---------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--web-env` | Boolean, `false` | `SHOPIFY_FLAG_OUTPUT_WEB_ENV` | Replaces the app report with `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and `SCOPES`. It does not skip authentication, linking, remote specifications, or local loading. |

`--web-env` has no short alias. The values come from the fetched remote app and loaded local scopes, not from process variables with those names. Use synthetic secrets in fixtures.

### Shared app flags

| Flag                           | Type/default                    | Environment variable      | Effect                                                                                                                          |
| ------------------------------ | ------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `--path <directory>`           | String; defaults to CLI `cwd()` | `SHOPIFY_FLAG_PATH`       | Starting directory for upward project discovery. Explicit values pass through `resolvePath`.                                    |
| `--config <name>`, `-c <name>` | Optional string                 | `SHOPIFY_FLAG_APP_CONFIG` | Selects an app configuration by shorthand or valid filename. Mutually exclusive with `--client-id` and `--reset`.               |
| `--client-id <id>`             | Optional string                 | `SHOPIFY_FLAG_CLIENT_ID`  | Overrides the effective remote app ID, or supplies the app to link. Mutually exclusive with `--config`; allowed with `--reset`. |
| `--reset`                      | Boolean, `false`                | `SHOPIFY_FLAG_RESET`      | Forces the link flow rather than reusing the current configuration. Mutually exclusive with `--config`.                         |

The help text calls `--reset` “Reset all your settings,” but this command uses it as `forceRelink`. It is not a general cache clear or logout. Linking can prompt, create a remote app, change the preferred configuration, and write local files.

### Shared CLI and inherited flags

| Flag                   | Type/default                 | Environment variable      | Effect                                                                                                                                          |
| ---------------------- | ---------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `--json`, `-j`         | Boolean, `false`             | `SHOPIFY_FLAG_JSON`       | Selects JSON for the result and normally disables colors. With `--web-env`, returns the three web-environment values instead of the app object. |
| `--no-color`           | Boolean, no declared default | `SHOPIFY_FLAG_NO_COLOR`   | Startup sets `FORCE_COLOR=0` when the flag or the CLI-truthy environment value is present.                                                      |
| `--verbose`            | Boolean, no declared default | `SHOPIFY_FLAG_VERBOSE`    | Enables CLI debug output. The literal argv flag also initializes `DEBUG` to `*` if `DEBUG` is unset.                                            |
| `--auth-alias <alias>` | Optional string              | `SHOPIFY_FLAG_AUTH_ALIAS` | Selects a stored account for this invocation before loading app context. Accepts a stored alias or matching user ID. Missing matches abort.     |

`--auth-alias` comes from `AppCommand.baseFlags`, not `AppInfo.flags`. Include it when constructing parser fixtures; inspecting only the command's own flag object misses it.

The command implements its own JSON flag. It does **not** enable oclif's `enableJsonFlag` mechanism. Do not infer that `SHOPIFY_CONTENT_TYPE=json` selects this output or that errors and lifecycle messages automatically become a JSON envelope.

### Framework controls and unsupported flags

| Input                                                                                                                      | Behavior                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `shopify app info --help` or `-h`                                                                                          | Framework help before the command's `run()` and its flag validation. No linked-app load. CLI bootstrap and framework initialization still run. |
| `shopify --version`                                                                                                        | Framework version output; does not execute `app info`.                                                                                         |
| `shopify app info --version`                                                                                               | Not an app-info flag. Framework version handling checks the first CLI argument, so this position is an unknown-flag case.                      |
| `--`                                                                                                                       | Ends flag parsing. A trailing `--` is accepted; positional arguments after it are still unexpected because the command declares none.          |
| `--environment`, `--store`, `--organization-id`, `--force`, `--yes`, `--silent`, `--no-json`, `--no-reset`, `--no-web-env` | Not declared for this command. Do not use another command's flags to configure the link helper that app info calls internally.                 |

Sources: [CLI package configuration](/packages/cli/package.json), [launcher](/packages/cli-kit/src/public/node/cli-launcher.ts), and the installed oclif `lib/main.js` and `lib/parser/parse.js`.

## Project and configuration selection

The default path comes from [CLI cwd()](/packages/cli-kit/src/public/node/path.ts): nonempty `INIT_CWD`, otherwise `process.cwd()`. Explicit `--path` and `SHOPIFY_FLAG_PATH` go through `pathe.resolve`, which resolves relative paths against the process working directory. Test these separately when npm has changed directories.

[Project.load](/packages/app/src/cli/models/project/project.ts) walks upward to the nearest directory with an accepted `shopify.app*.toml` filename. `--path` is a starting point, not a promise that this directory is the project root.

Without `--reset`, app info chooses configuration in this order:

1. Parsed `--config` value, including its environment equivalent.
2. The cached configuration preference for the discovered project.
3. `shopify.app.toml`.

A stale cached preference can trigger configuration selection. A shorthand such as `staging` becomes `shopify.app.staging.toml`; an already valid filename is preserved; other strings pass through slugification. See [config-file-naming.ts](/packages/app/src/cli/models/app/config-file-naming.ts) and [active-config.ts](/packages/app/src/cli/models/project/active-config.ts).

**`--client-id` does not select a matching TOML in this command's current path.** `linkedAppContext()` first gets the selected configuration without passing the flag as a configuration-selector option. It then uses the flag to override the remote lookup and loaded client ID. Test a flag whose ID belongs to a different local TOML; do not assume that file becomes active.

With `--reset`, the command skips that initial selection and calls the link service. See [app-context.ts](/packages/app/src/cli/services/app-context.ts) and [link.ts](/packages/app/src/cli/services/app/config/link.ts).

## Three different meanings of “environment”

| Input                            | What this command does                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Process environment              | Reads flags and runtime settings described here.                                                                                                                                  |
| Project `.env` / `.env.<config>` | Parses into `app.dotenv`; does not export those values to `process.env` or use them as flag defaults. A named config uses only its named dotenv file, with no fallback to `.env`. |
| `shopify.environments.toml`      | The base class looks for and can read this file, but app info does not declare `--environment`. A default environment does not supply its flags.                                  |

The environments file is read before the base class checks whether default-environment flags apply. Include malformed or unreadable `shopify.environments.toml` as a local-file failure fixture even though a valid default table cannot configure this command.

Sources: [BaseCommand.resultWithEnvironment](/packages/cli-kit/src/public/node/base-command.ts), [environment loading](/packages/cli-kit/src/public/node/environments.ts), [dotenv parsing](/packages/cli-kit/src/public/node/dot-env.ts), [config selection](/packages/app/src/cli/models/project/config-selection.ts).

The JSON app report can include the loaded `dotenv.variables` object. Its values must also be synthetic, not just the app secret used by `--web-env`.

## npm flag-misuse warnings

Before parsing, `BaseCommand.showNpmFlagWarning()` checks whether npm turned command flags into environment variables. **Presence is enough**, including an empty value or `false`.

For `AppInfo.flags`, the checked names are:

- `npm_config_color`
- `npm_config_verbose`
- `npm_config_path`
- `npm_config_config`
- `npm_config_client_id`
- `npm_config_reset`
- `npm_config_json`
- `npm_config_web_env`

These trigger the reminder to put `--` between `npm run` and CLI arguments. They do not supply flag values. The scan does not include inherited `baseFlags`, so `npm_config_auth_alias` is not among these names.

## Variables and flags that do not configure this command

Names elsewhere in the repository are not automatically inputs to `app info`.

| Input                                                                                     | Why it is not an app-info control                                                                                                                                |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES` in the process environment              | The web-env renderer produces these names; it does not read them to select the app or override the result. Project dotenv values remain local data.              |
| `SHOPIFY_FLAG_ENVIRONMENT` / `--environment`                                              | App info does not include an environment flag, even though its base class knows the environments filename.                                                       |
| `SHOPIFY_FLAG_STORE`, `SHOPIFY_CLI_ORGANIZATION`                                          | Not read to select the app-info dev store or organization. The displayed store is local; the organization comes from the remote app or linking choice.           |
| `SHOPIFY_FLAG_ORGANIZATION_ID`, `SHOPIFY_FLAG_APP_CONFIG_FILE_NAME`, `SHOPIFY_FLAG_FORCE` | Belong to the separate `app config link` command. Calling its service internally does not parse that command's environment flags.                                |
| `SHOPIFY_FLAG_HELP`                                                                       | No env-backed help flag here. Framework help comes from argv.                                                                                                    |
| `SHOPIFY_CONTENT_TYPE`                                                                    | Oclif's JSON mechanism is not enabled on this command. Use `--json` or `SHOPIFY_FLAG_JSON`.                                                                      |
| `SHOPIFY_CLI_DEVICE_AUTH`                                                                 | Not a device-flow selector in the current session path. Authentication chooses the device flow from credential state.                                            |
| `SHOPIFY_CLI_DYNAMIC_CONFIG`                                                              | A constant exists, but this path does not use it to turn remote specifications on or off.                                                                        |
| `SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH`                                                     | Extension-template generation, not the app specification query used by info.                                                                                     |
| `SHOPIFY_CLI_DISABLE_IMPORT_SCANNING`                                                     | Read by watcher import scanning; app info does not start extension watching.                                                                                     |
| `SHOPIFY_CLI_ENABLE_CLI_REDIRECT`, `SHOPIFY_CLI_SKIP_CLI_REDIRECT`                        | Constants are not evidence of an active redirect path in this checkout. The inspected bootstrap does not read them.                                              |
| Dev/build/tunnel flags and variables                                                      | No dev server, build, tunnel, or store authentication runs as part of ordinary app info. Do not use those settings as substitutes for the supported flags above. |

## Fixture matrix

Pair these cases with the app-info operation composition in [network.md](./network.md) and response/transport variants in the [shared references](/.agents/skills/cli-command-tests/references/state-catalog.md). Keep the normal linked project constant while testing parser or environment behavior.

| Fixture family               | Cases and assertions                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode/default`               | No optional flags; text report.                                                                                                                                   |
| `mode/json`                  | `--json`, `-j`, and env equivalent; same prerequisites but different result format.                                                                               |
| `mode/web-env`               | Text and JSON; first/absent secret behavior; output uses remote keys and local scopes.                                                                            |
| `parse/precedence`           | For each declared flag: argv only, env only, both, unset, empty, whitespace, and invalid value where applicable.                                                  |
| `parse/conflicts`            | Config/client-ID and config/reset combinations across argv and environment, including a false reset env value.                                                    |
| `parse/syntax`               | Long and short aliases, equals form for strings, missing values, repeated strings/booleans, unsupported negations, `--`, unknown flags, and positional arguments. |
| `help/early-exit`            | Help in a directory without a project and with conflicting app flags. Assert no linked context load.                                                              |
| `path/cwd`                   | Process cwd vs. `INIT_CWD`; absolute/relative path; argv/env path; nested directory; no project above.                                                            |
| `config/selection`           | Explicit, cached, default, stale cached file, shorthand/filename/slugification, and client-ID override without TOML reselection.                                  |
| `env/readers`                | Boolean reader disagreement; `CI=false` vs. unset; `FORCE_COLOR=2` vs. `1`; empty width/timeout values.                                                           |
| `auth/selection`             | Stored alias/user ID, unknown alias, automation precedence, empty-new-token suppression of legacy token, identity/refresh pair vs. one variable.                  |
| `auth/browser`               | Interactive desktop vs. cloud markers vs. CI; browser launcher success/failure.                                                                                   |
| `network/settings`           | Production/local service environment, DevServer gate, proxy precedence/bypass, timeout values, retry enabled/disabled.                                            |
| `output/terminal`            | Each stdin/stdout TTY combination, narrow width, color and hyperlink capability, stderr hint, verbose and DEBUG differences.                                      |
| `output/deprecation-date`    | Fixed API instant and clock; resolved timezone/default locale; successful versus failed command; fresh versus reused in-memory date state.                        |
| `startup/modes`              | Production/development/test mode, startup-performance exit, supported/unsupported Node version.                                                                   |
| `storage/isolation`          | Empty/populated/corrupt/inaccessible stores; OS directory rules; framework directories separated from CLI session storage.                                        |
| `lifecycle/settings`         | Notification override validation, upgrade preference vs. force variable, analytics opt-out vs. overrides, separate error-reporting suppression.                   |
| `npm/misplaced-flags`        | Each warning variable present/empty; no equivalent CLI flag supplied.                                                                                             |
| `negative/irrelevant-inputs` | Set plausible but unused variables above; assert they do not change app selection or output values.                                                               |

Start each test with a controlled environment. Preserve the OS executable and temporary-directory settings it needs, then add the fixture's variables. Exclude production credentials, proxy authentication, unrelated agent markers, and package-manager configuration.

Start a fresh process for cases that change memoized settings. `isVerbose()`, `isUnitTest()`, `shouldDisplayColors()`, proxy setup, dependency terminal detection, and several storage/client singletons read or retain state during the process lifetime.

## Other inputs that affect behavior

The following inputs have traced effects on output, prompts, requests, writes, or exit behavior. Keep those effects separate from telemetry-only differences and generic process-failure testing.

### Local files already inventoried

[Local file states](../../.agents/skills/cli-command-tests/references/app-files.md) covers dotenv selection, environments-file lookup, and `.shopify/` contents. [Web TOML schemas](../../.agents/skills/cli-command-tests/references/toml-schemas/web-toml.md) covers historical formats, discovery, validation, and missing web files. [Extension file states](../../.agents/skills/cli-command-tests/references/extension-files.md) covers installed UI exports, tools/intent JSON, referenced schemas, and root locales for remotely defined configuration modules.

Two distinctions matter: an unreadable dotenv file is silently omitted, while a found but unreadable environments file can abort. Ordinary `.shopify/` logs and bundles are not app-info inputs, but a `shopify.web.toml` copied into a hidden directory can be discovered by the default recursive search.

### Remaining inputs with observable effects

Shared details are split across [app preferences](/.agents/skills/cli-command-tests/references/stored-state.md), [authentication](/.agents/skills/cli-command-tests/references/authentication.md), and [package state](/.agents/skills/cli-command-tests/references/packages.md).

| Input                                                                             | Command-level effect                                                                                                                                                                                               | Source                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Project location and neighboring app configurations                               | Changes the selected project, preferred/default configuration, and discovered extensions/webs. Missing configuration can abort; a stale preference can prompt.                                                     | [Project](/packages/app/src/cli/models/project/project.ts), [selection](/packages/app/src/cli/models/project/active-config.ts)                                                                                                       |
| Per-user `shopify-cli-app` preferences                                            | `configFile` selects a different TOML without changing flags. Changes its dotenv, web directories, scopes, and client ID. The context also updates cached app details.                                             | [app store](/packages/app/src/cli/services/local-storage.ts), [linked context](/packages/app/src/cli/services/app-context.ts)                                                                                                        |
| Stored sessions, selected account, and aliases                                    | Determines login versus reuse/refresh, API credentials, account output, and unknown-alias failures. Malformed sessions are discarded.                                                                              | [session store](/packages/cli-kit/src/private/node/session/store.ts), [session validation](/packages/cli-kit/src/private/node/session/validate.ts)                                                                                   |
| GraphQL response cache and its timestamps                                         | Can skip requests or return cached organization/user data instead of fresh responses. An app-preference cache does not make info offline.                                                                          | [cache](/packages/cli-kit/src/private/node/conf-store.ts), [network cases](../../.agents/skills/cli-command-tests/references/network.md)                                                                                             |
| Notification history/feed, cached latest CLI version, and auto-upgrade preference | Changes warnings, blocking exits, and whether postrun starts an upgrade subprocess.                                                                                                                                | [notifications](/packages/cli-kit/src/public/node/notifications-system.ts), [upgrade](/packages/cli-kit/src/public/node/upgrade.ts)                                                                                                  |
| Root `package.json`, lockfile/workspace markers, and ancestor markers             | Changes the displayed package manager, suggested commands, and JSON `nodeDependencies`/`usesWorkspaces`. Malformed package JSON can abort. Detection checks marker existence, not lockfile contents.               | [Project metadata](/packages/app/src/cli/models/project/project.ts), [package-manager detection](/packages/cli-kit/src/public/node/node-package-manager.ts)                                                                          |
| Local/global CLI installations and the daily warning cache                        | Can add the two-installations notice and run version-detection subprocesses. Requires the local dependency and successful version detection; full JSON normally suppresses the notice.                             | [installation warning](/packages/cli-kit/src/public/node/multiple-installation-warning.ts), [version detection](/packages/cli-kit/src/public/node/version.ts)                                                                        |
| Extension TOMLs, supporting source/assets, and TypeScript configuration           | Changes loaded extension data and validation errors. Missing entry files can produce exit 2. Remote-DOM extension source/imports/tsconfig can change generated `shopify.d.ts`; missing UIDs can cause TOML writes. | [loader](/packages/app/src/cli/models/app/loader.ts), [UI type generation](/packages/app/src/cli/models/extensions/specifications/ui_extension.ts), [UID insertion](/packages/app/src/cli/services/app/add-uid-to-extension-toml.ts) |
| Web framework detector files                                                      | Changes JSON `webs[].framework`; unreadable detector files can throw. Does not execute the framework.                                                                                                              | [framework detector](/packages/cli-kit/src/public/node/framework.ts)                                                                                                                                                                 |
| Filesystem access at required read/write points                                   | Can stop project loading, store updates, hidden-file creation, generated-type writes, UID insertion, or linking. Some reads/migrations have explicit fallbacks; do not assume every permission error is fatal.     | [local storage](/packages/cli-kit/src/public/node/local-storage.ts), [local file states](../../.agents/skills/cli-command-tests/references/app-files.md)                                                                             |
| Prompt answers, cancellation, and stdin/stdout TTY state                          | Changes account/linking choices, selected/created app, configuration filename, or whether the command aborts because a needed prompt cannot run.                                                                   | [linking](/packages/app/src/cli/services/app/config/link.ts), [prompt capability](/packages/cli-kit/src/public/node/system.ts)                                                                                                       |
| Node/CLI version, OS/architecture, and terminal capabilities                      | Changes system-information rows and presentation. Unsupported Node can stop startup.                                                                                                                               | [renderer](/packages/app/src/cli/services/info.ts), [bootstrap](/packages/cli/src/bootstrap.ts)                                                                                                                                      |
| Clock relative to token, query-cache, notification, and upgrade timestamps        | Changes refresh/login, request reuse, warnings, blocking notifications, and upgrade eligibility. Test boundaries within those feature fixtures, not as an unrelated time matrix.                                   | [session validation](/packages/cli-kit/src/private/node/session/validate.ts), [cache](/packages/cli-kit/src/private/node/conf-store.ts)                                                                                              |
| Installed custom plugins and framework state                                      | Can change startup hooks or add warnings. Duplicate bundled app/Cloudflare plugins trigger a warning and are filtered. Arbitrary plugin behavior belongs to separate integration fixtures.                         | [base initialization](/packages/cli-kit/src/public/node/base-command.ts)                                                                                                                                                             |

**Even a linked invocation can write files.** Assert before/after filesystem and store snapshots. UID insertion is skipped when collected app errors exist; earlier hidden-config and type-generation writes are not necessarily skipped.

### Inputs not worth separate app-result fixture dimensions

- **Git tracking state:** the loader's `gitTracked` value comes from root `.gitignore` matching, not a Git subprocess, and feeds metadata rather than the report. Changing Git history or tracking status is not a demonstrated app-result branch here. Repository layout matters only when it changes discovered paths/files or installation context.
- **Unselected dotenv values:** can be read during discovery but do not override the selected file or process environment. Do not multiply app-result cases by their contents.
- **Lockfile contents:** ordinary package-manager detection tests existence and precedence. Corrupting an existing lockfile's bytes does not by itself change that result; installer behavior is a separate case.
- **Generic randomness:** missing UUID-strategy extension UIDs are derived deterministically from handles at this baseline. Do not assume random IDs require another fixture axis.
- **Telemetry-only attribution and timestamps:** test telemetry payloads separately; they do not select an app or change its result fields.
- **Generic resource exhaustion and concurrent mutation:** keep targeted failures at known boundaries rather than claiming an unbounded matrix is required. Locale/timezone do have a traced effect on [deprecation warning dates](../../.agents/skills/cli-command-tests/references/lifecycle.md#deprecation-warning-dates); test that path explicitly.

Same-process client and schema caches matter when deliberately invoking the command/services repeatedly in one process. Ordinary fresh-process E2E fixtures should isolate them rather than pretend they are persisted project-file formats.

Failure reporting can still perform observable local work while collecting metadata. The [public metadata hook](/packages/app/src/cli/hooks/public_metadata.ts) calls `localAppContext()` from CLI `cwd()` with prompts disabled and a best-effort timeout when app metadata is absent. That load can reach normal file-generation and warning code, even though the hook swallows failures. Include it when asserting that an early command error causes no further writes or output.
