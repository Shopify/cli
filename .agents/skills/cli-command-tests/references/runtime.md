# CLI runtime, parser, and terminal state

Review these families for every command. A flag must be declared or inherited before parser rules apply to it; an early reader can have separate rules. Help/startup exits may bypass later readers. The source baseline is CLI commit `8829ed581d25f964c53564c403bfbf94484753b4`. Recheck changed readers and dependency versions before reusing an outcome.

## Parsing and precedence

### Flag values

For a declared flag, the parser uses:

1. An explicit command-line value.
2. A nonempty value in that flag's declared environment variable.
3. The declared default, if any.

An empty environment string is treated as absent. An explicitly empty string argument, such as `--config=`, is different: it reaches the command as an empty string. There is no general whitespace trim for string flags.

Use these parser variants for flags the target command actually declares. The examples use shared app flags; `multiple`, `allowNo`, argument declarations, and exclusivity are command-specific. Confirm the installed oclif version before reusing exact outcomes.

| Fixture                          | Input                                                        | Expected result                                                                                            |
| -------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `flags/argv-wins`                | `SHOPIFY_FLAG_APP_CONFIG=staging` plus `--config production` | Selects `production`.                                                                                      |
| `flags/env-only`                 | One nonempty flag environment variable, no argv equivalent   | Uses the environment value.                                                                                |
| `flags/empty-env`                | Empty environment value                                      | Uses the default or leaves the optional flag unset.                                                        |
| `flags/string-missing-value`     | `--path` with no value                                       | Parse error.                                                                                               |
| `flags/string-repeated`          | `--path first --path second`                                 | Parse error: option flags are not declared `multiple`.                                                     |
| `flags/boolean-repeated`         | `--json --json`                                              | Accepted; remains true.                                                                                    |
| `flags/boolean-value`            | `--json=false` or `--json false`                             | Parse error; `false` is an unexpected argument, not a way to disable the flag.                             |
| `flags/unsupported-negation`     | `--no-json`                                                  | Unknown flag; these booleans do not set `allowNo`. `--no-color` is a separately named flag.                |
| `flags/config-client-conflict`   | `--config staging --client-id fixture-id`                    | Parse error, including when one value comes from the environment.                                          |
| `flags/config-reset-conflict`    | `--config staging --reset`                                   | Parse error.                                                                                               |
| `flags/false-reset-env-conflict` | `SHOPIFY_FLAG_RESET=false` plus `--config staging`           | Still a conflict in oclif 4.8.3: the environment supplied the flag, even though its parsed value is false. |
| `flags/reset-client-combination` | `--reset --client-id fixture-id`                             | Allowed by the shared app flag definitions; linking is a caller action, not parser behavior.               |
| `flags/unknown-or-positional`    | Unknown flag or positional app name                          | Parse error.                                                                                               |

Unset unused boolean flag variables rather than filling them all with `false`. Oclif's exclusivity checks distinguish supplied flags from defaults.

## Environment-variable value rules

Different readers use different rules. Use each reader's rule rather than one boolean conversion for all fixtures.

| Rule                    | True/enabled values                                          | Used by                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Oclif boolean**       | Case-insensitive `1`, `true`, `y`, `yes`; no whitespace trim | Declared boolean flag environment variables.                                                                                                           |
| **CLI truthy**          | Exactly `1`, `true`, `TRUE`, `yes`, `YES`                    | [isTruthy](/packages/cli-kit/src/public/node/context/utilities.ts), including CI, verbose detection, most CLI switches, and startup color suppression. |
| **Exact match**         | The documented string only                                   | For example, `SHOPIFY_CLI_FORCE_AUTO_UPGRADE=1`, `SHOPIFY_SERVICE_ENV=local`, `SHOPIFY_CLI_ENV=development`.                                           |
| **Present**             | Key exists, even if empty or set to `false`                  | Some terminal checks, npm misuse warnings, and dependency settings.                                                                                    |
| **Nonempty / nonblank** | Depends on the reader; trimming is not universal             | Tokens, paths, cloud detection, agent attribution, and URL overrides.                                                                                  |
| **Numeric conversion**  | JavaScript `Number`, not integer/range validation            | Request timeout and bootstrap terminal width.                                                                                                          |

Boolean variants include unset, empty, `0`, `false`, `1`, `true`, `True`, `TRUE`, `y`, `yes`, `YES`, whitespace-padded values, and an unrelated string. Choose representatives for each reached reader; do not repeat the entire set for every flag.

Test these disagreements explicitly:

- `SHOPIFY_FLAG_JSON=y` selects JSON through oclif, but early CLI helpers do not recognize `y`. Color suppression and notification suppression can disagree with the result format.
- `SHOPIFY_FLAG_NO_COLOR=y` parses as true, but does not trigger startup color suppression.
- `SHOPIFY_FLAG_VERBOSE=True` is true in parsed flags, but `isVerbose()` does not recognize `True`. Debug output uses the helper, not that parsed value.

These behave differently from passing the literal argv flag. Helpers that scan argv usually look for exact tokens such as `--json`, `-j`, and `--verbose`, not every spelling the parser might accept.

## Output and terminal environment

Sources: [startup color setup](/packages/cli-kit/src/public/node/cli.ts), [color decision](/packages/cli-kit/src/public/node/output.ts), [terminal helpers](/packages/cli-kit/src/public/node/system.ts), [terminal/CI context](/packages/cli-kit/src/public/node/context/local.ts), [info renderer](/packages/app/src/cli/services/info.ts).

| Variable                                                                                            | Value rule                                                | Effect and fixtures                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SHOPIFY_FLAG_JSON`, `SHOPIFY_FLAG_NO_COLOR`, `SHOPIFY_FLAG_VERBOSE`, `SHOPIFY_FLAG_OUTPUT_WEB_ENV` | Oclif for parsed flags; some also have CLI-truthy readers | Covered above. Test the reader disagreements, not just `true` and `false`.                                                                                                                                   |
| `NO_COLOR`                                                                                          | CLI truthy in startup                                     | Recognized values set `FORCE_COLOR=0`. Do not assume mere presence, including `NO_COLOR=""`, has that effect in the startup helper. Dependencies may apply their own rules.                                  |
| `FORCE_COLOR`                                                                                       | Presence plus CLI truthy in `shouldDisplayColors()`       | Overrides stdout TTY detection in that helper. `0` disables; `1` enables. Values `2`, `3`, or empty strings differ from common color-library conventions.                                                    |
| `TERM`                                                                                              | `dumb` has explicit behavior                              | Startup disables color; `isTerminalInteractive()` returns false. Other values feed dependency capability checks.                                                                                             |
| `CI`                                                                                                | Mixed: CLI truthy and presence checks                     | CLI-truthy CI disables prompts, normal notifications, and ordinary auto-upgrade. `isTerminalInteractive()` rejects any present `CI`, including `CI=false` or empty.                                          |
| `SHOPIFY_CLI_COLUMNS`                                                                               | `Number(value)`; ignored only if NaN                      | Sets `process.stdout.columns` at bootstrap. Test normal/narrow width, unset, empty (`0`), zero, negative, and non-numeric values. There is no range check here.                                              |
| `SHELL`                                                                                             | String, fallback `unknown`                                | Used by framework shell detection and printed by renderers that include a shell row, such as app info. Empty differs from missing. If OS user lookup fails and `SHELL` is absent, the loader sets `unknown`. |
| `COMSPEC`                                                                                           | Framework/OS-owned                                        | Windows shell detection and child-process behavior; not a substitute for the renderer's `SHELL` field.                                                                                                       |
| `DEBUG`                                                                                             | `debug` package namespace patterns                        | Framework/dependency diagnostics. Literal `--verbose` sets it to `*` only when undefined. `DEBUG=""` prevents that default.                                                                                  |
| `CLAUDECODE`, `CLAUDE_CODE_CHILD_SESSION`                                                           | CLI truthy                                                | Emit the Claude Code plugin hint directly to stderr in prerun, including JSON commands. Not suppressed by ordinary analytics opt-out.                                                                        |

`terminalSupportsPrompting()` requires both stdin and stdout to be TTYs and a non-CLI-truthy `CI`. It does not test `TERM=dumb`. `isTerminalInteractive()` tests stdout, `TERM`, and whether `CI` exists. A single “interactive” fixture switch cannot represent both.

### Dependency-owned presentation settings

The CLI uses `supports-hyperlinks`, color libraries, and oclif. Pin the dependency versions when snapshotting their output.

| Variables                                                                                            | Effect                                                                                                       |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `FORCE_HYPERLINK`                                                                                    | Forces or suppresses terminal links under `supports-hyperlinks` rules; `0` is the usual suppression fixture. |
| `TERM_PROGRAM`, `TERM_PROGRAM_VERSION`, `VTE_VERSION`, `WT_SESSION`, `NETLIFY`, `TEAMCITY_VERSION`   | Affect hyperlink detection; color libraries also inspect several of these.                                   |
| `COLORTERM`, `TRAVIS`, `CIRCLECI`, `APPVEYOR`, `GITLAB_CI`, `GITHUB_ACTIONS`, `BUILDKITE`, `CI_NAME` | Can affect dependency color support, separately from the CLI's boolean helpers.                              |
| `OCLIF_COLUMNS`                                                                                      | Framework help/error width; distinct from `SHOPIFY_CLI_COLUMNS`, which changes stdout width for the CLI UI.  |
| `SHOPIFY_DISABLE_THEME`                                                                              | Oclif theme control, enabled by exactly `1` or `true`. Not a command-specific output-format selector.        |
| `DEBUG_*`, such as `DEBUG_COLORS`, `DEBUG_DEPTH`, and `DEBUG_HIDE_DATE`                              | Change the `debug` package's formatting and inspection options when its namespaces are enabled.              |
| `ROARR_LOG`, `ROARR_STREAM`                                                                          | `global-agent`'s logger can emit diagnostics, including to stdout. Clear these for machine-output fixtures.  |
| `NODE_NO_WARNINGS`, warning-related `NODE_OPTIONS`                                                   | Change runtime warnings on stderr. They do not suppress CLI validation errors.                               |

Test stdout and stderr independently. A JSON result does not promise an empty stderr, and link/login/upgrade paths can add lifecycle output. A dependency's recognition of argv such as `--hyperlink=always` does not make it a declared command flag.

## Startup, storage, and lifecycle environment

### Startup and filesystem locations

Sources: [bootstrap](/packages/cli/src/bootstrap.ts), [CLI startup](/packages/cli-kit/src/public/node/cli.ts), [BaseCommand](/packages/cli-kit/src/public/node/base-command.ts), [local storage](/packages/cli-kit/src/public/node/local-storage.ts), [CLI storage](/packages/cli-kit/src/private/node/conf-store.ts), [app preferences](/packages/app/src/cli/services/local-storage.ts).

| Variable                                                               | Rule                      | Effect and fixtures                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INIT_CWD`                                                             | Nonempty string           | Overrides CLI `cwd()`. Affects default project discovery, some metadata loads, and install-context detection. Empty falls back to process cwd.                                          |
| `SHOPIFY_CLI_ENV`                                                      | Exactly `development`     | Enables development/debug behavior, ordinarily disables analytics, changes framework debug handling, and skips real upgrades. Does not change API hosts; that is `SHOPIFY_SERVICE_ENV`. |
| `SHOPIFY_UNIT_TEST`                                                    | CLI truthy, memoized      | Suppresses normal output/notifications and metric export, changes the CLI-kit store name, and prevents dynamic App Management authentication. Not a generic E2E quiet switch.           |
| `SHOPIFY_CLI_ENV_STARTUP_PERFORMANCE_RUN`                              | CLI truthy                | Base initialization prints timestamp markers and exits 0 before the command's parsing/loading. Prerun may already have started.                                                         |
| `HOME`, `USERPROFILE`, `HOMEDRIVE`, `HOMEPATH`                         | OS/framework rules        | Affect home lookup and persistent state discovery. Windows and Unix differ.                                                                                                             |
| `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME` | Platform/dependency rules | Affect config, cache, data, or logs. CLI sessions and GraphQL caches live in the CLI-kit config store, not necessarily an OS cache directory.                                           |
| `APPDATA`, `LOCALAPPDATA`                                              | Windows paths             | Affect `conf`/`env-paths` storage and framework directories.                                                                                                                            |
| `TMPDIR`, `TMP`, `TEMP`                                                | Node/OS rules             | Affect temporary files and subprocess helpers. Isolate these when exercising local write failures.                                                                                      |
| `PATH`, `PATHEXT`, `SYSTEMROOT`                                        | OS/subprocess rules       | Affect Git, browser launchers, package managers, and other executable lookup. `SYSTEMROOT` is used by the Windows opener.                                                               |
| `NODE_OPTIONS`                                                         | Node startup options      | Can load environment files or preload code before the CLI, or alter runtime behavior. Fix it in the test environment rather than inheriting arbitrary options.                          |

There are separate persistent stores:

- `shopify-cli-kit`: sessions, current account, GraphQL cache, notifications, and upgrade preferences. Unit-test mode changes this name to `shopify-cli-kit-test`.
- `shopify-cli-app`: app/configuration preferences keyed by project path.
- Oclif's own configuration/data/cache directories, which also contain framework/plugin state.

On macOS, `env-paths` uses `~/Library/...` rather than the Linux XDG config layout. Setting only `XDG_CONFIG_HOME` is not a cross-platform way to isolate Shopify sessions. Use the actual platform store paths or a local-storage test seam.

### Framework configuration settings

These come from installed oclif, not the command's flag definitions. The binary name produces the `SHOPIFY_` prefix.

| Variables                                                     | Effect                                                                                                                             |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `SHOPIFY_CONFIG_DIR`, `SHOPIFY_DATA_DIR`, `SHOPIFY_CACHE_DIR` | Override oclif directories. They do not relocate the separate `conf` stores above.                                                 |
| `SHOPIFY_BINPATH`                                             | Changes framework binary-path configuration.                                                                                       |
| `SHOPIFY_NPM_REGISTRY`                                        | Sets oclif's registry setting; not a universal override for the independent npm version-check library or an upgrade subprocess.    |
| `SHOPIFY_DEBUG`                                               | Oclif hook-debug mode when exactly `1` or `true`; distinct from `SHOPIFY_FLAG_VERBOSE`.                                            |
| `CLI_FLAGS_DEBUG=1`                                           | Enables parser debugging. Keep synthetic credentials in parser tests because diagnostic output can include flag values.            |
| `OCLIF_DISABLE_RC`                                            | A nonempty value skips oclif rc-file lookup.                                                                                       |
| `OCLIF_NEXT_VERSION`                                          | A nonempty value changes manifest-version checking.                                                                                |
| `OCLIF_DISABLE_ENGINE_WARNING`                                | Suppresses the framework's engine warning under oclif boolean rules. Does not bypass Shopify's Node-major-version startup check.   |
| `OCLIF_DISABLE_LINKED_ESM_WARNING`                            | Suppresses the linked ESM/TypeScript warning under oclif boolean rules.                                                            |
| `NODE_ENV`                                                    | Development/test values affect framework production and linked-source loading decisions. Not the same switch as `SHOPIFY_CLI_ENV`. |

These settings can change which plugin/manifest is loaded or what diagnostics appear before the command body. Keep their variants separate from ordinary domain-data fixtures.

## npm flag-misuse warnings

`BaseCommand.showNpmFlagWarning()` derives `npm_config_*` names from the current command's declared flags. Presence, including empty or `false`, can trigger a reminder to put `--` between `npm run` and CLI arguments. These variables are warnings, not flag-value bindings. The scan does not include inherited `baseFlags`; derive the names from the target command rather than copying app-info's list.
