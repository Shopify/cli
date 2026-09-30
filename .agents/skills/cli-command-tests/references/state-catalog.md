# State catalog

Use this list to find inputs, not to generate a Cartesian product. For each family, identify the command's reader and the observable difference it can cause. Mark unused families not applicable with a source reference.

## Reference map

The seed inventory was researched against CLI commit `8829ed581d25f964c53564c403bfbf94484753b4`. Recheck changed readers and dependency versions before reusing an outcome.

Read the universal references first, then the profiles selected by the command's call path:

| Reference                                     | Apply when                                                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [Runtime and parser](runtime.md)              | Every command: argv, environment readers, startup, terminal, framework paths                                                            |
| [Network and GraphQL](network.md)             | The command opens HTTP, GraphQL, proxy, TLS, retry, timeout, or cache paths                                                             |
| [Lifecycle](lifecycle.md)                     | Bootstrap/base hooks, deprecations, notifications, version checks, upgrades, telemetry, or error reporting can run                      |
| [Persistent storage](stored-state.md)         | The command reads/writes CLI-kit or app preferences                                                                                     |
| [Authentication](authentication.md)           | CLI-kit user auth or the App Management/Business Platform credential profile is reachable                                               |
| [Packages](packages.md)                       | Project/package-manager, workspace, installation-warning, or framework detection is reachable                                           |
| [App-project files](app-files.md)             | App project/configuration discovery, dotenv, environments files, or hidden app state is reachable                                       |
| [App Management workflows](app-workflows.md)  | `linkedAppContext()`, App Management app/org/specification loading, linking, selection, or creation is reachable                        |
| [Extension support files](extension-files.md) | Extension source/type generation, installed exports, tools/intents, schema references, or localized configuration modules are reachable |
| [TOML schema catalog](schema-catalog.md)      | App, web, or extension TOML is discovered, generated, validated, normalized, built, or deployed                                         |
| `test/app-info/*.md`                          | Only when testing `app info`: command composition, output, implemented cases, and known gaps                                            |

If a profile is absent, use the reader's source and record the gap. Do not recreate verified history from memory.

## Applicability contract

Every command review must classify each universal family and each capability selected by its call path:

| Status             | Meaning                                                                                            | Test-plan treatment                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `applicable`       | The command reaches the reader and the variant can change an observable outcome                    | Add an assertion or map to an existing equivalent case                         |
| `read but ignored` | The reader consumes the state, but this command deliberately does not apply/render it              | Add a negative-control case only when confusion or regression risk is credible |
| `not reached`      | The command exits earlier or never invokes that reader                                             | Record the source boundary; do not create a fixture dimension                  |
| `unresolved`       | Dynamic contract, plugin, platform, dependency, or missing history prevents a supported conclusion | Record the blocker; do not infer behavior                                      |

Universal families are argv/parser/help, process environment and paths, terminal/CI/presentation, platform/Node/CLI version, lifecycle/error handling, subprocess cleanup, and default-deny external dependencies. These can still be `not reached` after an earlier framework exit.

Use capability gates for the rest:

| Reached capability                      | Load these profiles                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `BaseCommand.resultWithEnvironment()`   | Runtime plus the command family's environments-file profile                                                       |
| `Project.load()` / active app selection | App files, packages, app/web schemas, and app preferences                                                         |
| `localAppContext()`                     | Project state plus local extension schemas/support files; no App Management request baseline                      |
| `linkedAppContext()`                    | Local app state, authentication, App Management workflows, remote contracts, caches, preference/UID writes        |
| Link/select/create services             | App Management N5–N8, prompts, mutations, configuration writes, partial failure                                   |
| Extension type generation/localization  | Extension support files and applicable per-type schema page                                                       |
| Build/dev/deploy services               | Parsed command/build fields, referenced assets, subprocess/network execution, and phase-specific transforms       |
| Theme/store command base                | Shared runtime/transport/lifecycle plus theme/store auth and `shopify.theme.toml`; do not reuse app-info defaults |

A file field can be parsed during loading, executed during build/dev, transformed during deployment, and rendered by an info command. Those are separate behaviors. Account for the phase the target command reaches.

## Flags and environment

Inspect the command's declarations, inherited/base flags, parser, bootstrap, and early readers.

- Exercise documented output modes and aliases. Include help and unsupported flags only where their lifecycle differs.
- Test env-only values before claiming argv/env precedence. A test where argv wins can pass when the environment binding is broken.
- Cover missing values, repeated strings/booleans, equals syntax, conflicts, explicit false values, and unsupported negation where applicable.
- Separate process cwd, `INIT_CWD`, explicit relative/absolute paths, environment paths, saved configuration, and defaults.
- Check empty versus unset credentials and boolean-reader differences. Do not use one global truthiness rule.
- Treat plausible but unread variables as negative controls only when there is a real risk of confusing them with supported inputs.

Derive the target command's own flags and inherited `baseFlags`. The app-info profile records its nine flags; another command can add/remove flags or use the same flag differently.

## Network and authentication

Record request matchers and outcomes separately. A registered response that was never consumed proves nothing.

| Family                  | State changes to consider                                                                      | Observable outcomes                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Domain operations       | Success, missing entity, empty page, malformed body/envelope, GraphQL errors with partial data | Report values, diagnostic, stream, exit, follow-up operations                       |
| Pagination and search   | More pages, empty search, changed result set, selected non-default item                        | Query variables and the identity ultimately linked/rendered                         |
| Authentication          | Absent/valid/expired sessions, missing scopes or audiences, aliases, automation credentials    | Reuse, refresh, device login, account output, persisted state                       |
| Device flow             | Start failure, pending, slow-down, denial, expiry, malformed success, cancellation             | Prompts, browser attempt, poll timing/count, exit and stored tokens                 |
| Refresh and replay      | Fresh identity and per-API tokens, failed exchange, repeated 401                               | Exchange subject token, correct new bearer token, bounded replay and persistence    |
| Caches                  | Cold, warm, just before/at/after expiry, corrupt, account/host switch                          | Skipped requests plus correct cached/fresh report values                            |
| Transport               | 403/5xx, throttle codes, retry exhaustion, timeouts, socket reset, redirects                   | Correct error family, retry behavior, no duplicate mutation                         |
| Mutations               | Failure before send, server rejection, success followed by local failure, lost response        | Remote effects, local partial state, retry/idempotency, cleanup or lack of rollback |
| Lifecycle               | Notifications, version lookup, upgrades, analytics, metrics, error reporting                   | Extra output, requests, subprocesses, stores, and exit boundaries                   |
| External schemas/assets | Local references, HTTP references, nested references, missing/invalid data                     | Read base, headers, generated output, warning versus abort                          |

The [App Management profile](app-workflows.md) defines `UserInfo`, `ActiveAppReleaseFromApiKey`, `FindOrganizations`, `fetchSpecifications`, and the linking calls. Do not copy that request set into commands that use local app context, Admin APIs, theme/store authentication, or another client.

Keep authentication families distinct. An expired Business Platform token, an expired identity, and a missing App Management token need not take the same path. Use different old/new credentials so stale-token reuse fails the test.

Use real fixture-owned loopback sockets when MSW's generic network error does not exercise the transport classification under test. Verify the endpoint and request count as well as the diagnostic. `socket hang up` and `ECONNRESET` can describe the same peer reset; a timeout is a different event.

## Files, schemas, and packages

For each path, identify whether it is discovered, selected, parsed, normalized, validated, rendered, or written. See the [schema catalog](schema-catalog.md) for the preloaded format families.

| Input family                 | Representative states                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Project/configuration layout | No project, root/nested invocation, named/default configs, stale preference, conflicting IDs, relative paths, ancestor/sibling files             |
| TOML bytes                   | Missing, empty, malformed syntax, wrong types, valid modern/historical shapes, unknown keys, mixed discriminators                                |
| Dotenv                       | Selected versus unselected, named versus default, duplicates, empty values, literal references, unreadable file or directory collision           |
| Environments file            | Nearest file versus ancestor, empty/invalid file, command with or without environment support                                                    |
| `.shopify`                   | Missing directory, exact initial files, legacy migration, malformed JSON, unrelated fields, internal symlink, required versus best-effort writes |
| Package inventory            | Missing/invalid manifest, dependencies versus devDependencies, marker precedence, ancestor marker, user agent, workspaces                        |
| Installed packages           | Declared but absent, target/helper exports missing, successful resolution, ancestor-package fallback blocked                                     |
| Supporting assets            | Source entrypoint/imports, tsconfig scope/aliases, tools/intents, referenced schemas, root versus extension locales                              |
| Write destinations           | Existing equal/different output, directory collision, deterministic UID, failures after earlier writes, unrelated data preserved                 |

Static input bytes belong in copied fixture trees, including deliberately invalid JSON and UTF-8. Runtime ports, temporary absolute store keys, timestamps, and deliberate between-invocation changes justify targeted setup helpers.

A declaration in `package.json` does not prove an installed export resolves. File presence, bytes, paths, and package contents are separate inputs. A configured dev/build command is not proof that this command executes it.

## Other state

| Family                | What to inspect                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Authentication stores | OS-specific locations, JSON-string session encoding, current account, alias matching, invalid-entry handling               |
| App preferences       | Path-keyed selected config and cached metadata; root versus invoked directory; merge/preservation behavior                 |
| CLI preferences       | Auto-upgrade settings and other command-relevant global choices                                                            |
| Persistent caches     | Keys, payload shape, timestamps, user/host scoping, notification history and local rate limits                             |
| Process environment   | Isolated home/temp/XDG/APPDATA and framework paths, `PATH`, shell, production/development modes, proxy and service routing |
| Time                  | Consistent `Date` and `Date.now`, real timer delays, expiry boundaries, locale/timezone/ICU formatting                     |
| Terminal              | stdin/stdout TTY combinations, CI markers, width, color, hyperlinks, prompts, cancellation, output stream                  |
| Lifecycle             | Pre/postrun hooks, error metadata after early failure, direct exit versus throw, background workers and cleanup            |
| Platform/dependencies | OS path/permission behavior, Node/CLI version, loaded package versions, module-resolution layout                           |
| Plugins/startup       | Manifest/bundled-command precedence, plugin hooks, duplicate plugins, startup-only warnings                                |
| Long-running commands | Readiness, reload, disconnect, shutdown, signal handling, children left alive after the observation window                 |

Fresh processes isolate memoized environment and client state. Disabling analytics does not necessarily suppress error reporting or local metadata writes. Final byte snapshots cannot prove that an identical file was never rewritten; use mtime or write tracing only when that distinction is the behavior under test.

## Stop expanding when there is no new behavior

Keep a new case when it establishes a distinct reader, boundary, output, or side effect. Combine it with an existing case when both have the same effective input and outcome. Preserve useful distinctions such as missing file versus invalid file, 403 versus 500, or flag versus alias.

Do not multiply every state by every locale, package manager, extension type, or output mode. Test their interactions where the command makes a different decision. Separate harness self-tests from evidence of command behavior.
