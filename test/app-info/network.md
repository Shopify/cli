<!--
title: app_info_network
description: App-info request composition, result interactions, and command-specific network assertions.
tags: [documentation, app-info, network, testing, graphql, authentication]
-->

# App info network composition

This is the command-specific profile for the researched CLI baseline `8829ed581d25f964c53564c403bfbf94484753b4`. Shared state variants now live in the [command-testing skill](/.agents/skills/cli-command-tests/references/state-catalog.md). The operation/response contracts are shared; their ordering, prerequisites, and effects on this report are recorded here. A linked invocation still needs remote app and specification data. Reset or an unlinked project can create an app and rewrite configuration.

## Execution paths

The entry point is [AppInfo.run](/packages/app/src/cli/commands/app/info.ts). It calls [linkedAppContext](/packages/app/src/cli/services/app-context.ts) before [info](/packages/app/src/cli/services/info.ts).

| Path                                                              | Calls and behavior                                                                                                                                                                 |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linked configuration, usable stored credentials, cold query cache | `UserInfo` → `ActiveAppReleaseFromApiKey` → `FindOrganizations` → `fetchSpecifications` → local loading → output.                                                                  |
| Same path, warm query cache                                       | `UserInfo` and `FindOrganizations` can use cached data. App and specification queries still run.                                                                                   |
| Expired or missing credentials                                    | Authentication calls run before authenticated queries. A later HTTP 401 can trigger another refresh.                                                                               |
| `--client-id` on a linked configuration                           | Fetches the supplied client ID rather than the file's ID. It does not by itself start linking.                                                                                     |
| Unlinked configuration or `--reset`, with `--client-id`           | Fetches that app → specifications → active release again to build local configuration → writes configuration → organization → specifications again → output.                       |
| Linking without `--client-id`                                     | Lists organizations → selects one → fetches its organization details and app list concurrently → selects or creates an app → continues linking.                                    |
| Linking requires a prompt in a non-interactive terminal           | The link flow can reject before domain API calls. Supplying a client ID may still leave a configuration-filename prompt to resolve.                                                |
| Invalid local input before linking                                | Can fail before domain API calls. CLI lifecycle requests may already have started.                                                                                                 |
| Local module validation errors after specifications load          | The command tolerates collected `app.errors`, prints its result, then calls `process.exit(2)`. Network failures and thrown schema-parser errors are not covered by this tolerance. |

The text renderer calls `accountInfo()`, which reads the client's initialized session without another query. JSON and web-environment output skip that call, but still need session initialization and its uncached `UserInfo` request.

The exit-2 path ends the process directly. Do not expect the successful postrun hook, auto-upgrade, or its analytics call after that exit.

Local loading can also issue [N9 schema-reference requests](../../.agents/skills/cli-command-tests/references/extension-files.md#n9-external-schema-references) when eligible UI extensions generate types from tools/intent schemas. These are conditional requests to file-defined URLs, not another fixed Shopify endpoint.

### Calls that are not part of this command

Do not add expected requests for dev-store lookup, Admin API queries, dev sessions, tunnels, extension builds, deploys, or webhook delivery. The displayed dev-store URL comes from local configuration or local hidden configuration. The command does not check whether that store or `application_url` is reachable.

The current default client is `AppManagementClient`, not the legacy Partners client. User authentication still exchanges a token for the Partners audience; that does not imply a Partners app-data query. The extension-template CDN and organization beta/experiment queries belong to extension generation, not this command's specification loading.

## Shared request profiles

| Profile                                                              | Canonical input/response variants                                                                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| N1–N4: account, app release, organization, specifications            | [App Management and linked context](../../.agents/skills/cli-command-tests/references/app-workflows.md#linked-app-calls)            |
| N5–N8: organization/app selection, API versions, creation            | [Linking and creation](../../.agents/skills/cli-command-tests/references/app-workflows.md#conditional-linking-calls)                |
| N9: schema-reference GETs                                            | [Extension reference transport](../../.agents/skills/cli-command-tests/references/extension-files.md#n9-external-schema-references) |
| A1–A5: device, refresh, exchanges, email                             | [Authentication](../../.agents/skills/cli-command-tests/references/authentication.md#authentication-calls)                          |
| Shared HTTP/GraphQL states                                           | [Transport and routing](../../.agents/skills/cli-command-tests/references/network.md)                                               |
| H1–H6: notifications, versions, upgrades, telemetry, error reporting | [Lifecycle](../../.agents/skills/cli-command-tests/references/lifecycle.md#cli-lifecycle-calls)                                     |

## Coverage matrix

Use each operation's fixture table for response variants. The following scenarios test how those variants interact. This is a fixture plan, not a claim that measured command coverage is already complete.

| Scenario                                               | Required assertions                                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linked happy path                                      | Correct N1 → N2 → N3 → N4 order with cold caches; expected text output; no linking calls.                                                               |
| Linked JSON                                            | Same prerequisites; valid JSON output; local app plus organization data, not raw API envelopes.                                                         |
| Web environment, text and JSON                         | Same prerequisites; first/absent secret behavior; local scopes; no extra secret endpoint.                                                               |
| Client-ID override                                     | N2 uses the override; subsequent organization/specification calls follow the returned app.                                                              |
| Warm vs. cold session/query caches                     | Expected OAuth and GraphQL call counts; N2/N4 remain online requirements.                                                                               |
| Missing app or organization                            | Correct error and account-specific help; no later required calls.                                                                                       |
| New contract rejects local config                      | Collected errors render and exit 2 where loading completes; thrown contract errors remain failures.                                                     |
| UI support schemas and installed exports               | Conditional N9 requests, local reference reads, warnings, generated declarations, and missing-export aborts; same loading behavior in all result modes. |
| Localized remote-only configuration module             | N4 enables the localized configuration path; root locale-file state can abort without another Shopify API request.                                      |
| Deprecation date formatting                            | Same API timestamp under controlled runtime locales/timezones; warning after success, but not after the direct exit-2 path.                             |
| Empty, missing-type, remote-only, and deprecated specs | Distinct extension lists/errors; do not collapse these into one fixture.                                                                                |
| Forced link with client ID                             | N2 and N4 repeated for their separate purposes; final TOML, preferences, and output checked.                                                            |
| Interactive link to existing app                       | N5/N6, organization choice, search, full lookup, and second release read.                                                                               |
| Interactive link creates app                           | N7/N8, remote side effect, later release data, and written local configuration.                                                                         |
| Link race/failure                                      | App disappears or specs change between reads; partial local/remote side effects captured.                                                               |
| User full auth                                         | A1/A2, all four A4 audiences, optional A5, then domain calls.                                                                                           |
| User refresh                                           | A3/A4 success; invalid-grant fallback; invalid-request clearing; no-prompt failure.                                                                     |
| Automation auth                                        | Two sequential A4 audiences; service-account N1 variants; no browser flow in the combined helper.                                                       |
| Unauthorized recovery                                  | 401 → refresh → success; persistent 401; refresh failure; N1 startup and N5 exceptions.                                                                 |
| Throttling and connectivity                            | Recovery and exhaustion; retries disabled; TLS failure; body interruption; service-specific outage.                                                     |
| Notification/version races                             | Output unaffected when feeds are irrelevant; cached blocking notice aborts; fresh upgrade check controlled.                                             |
| Telemetry unavailable                                  | Original output/exit unchanged; no leaked child processes or real external requests.                                                                    |

Test every output mode with the baseline and at least one prerequisite failure. Keep shared retry details in transport tests instead of repeating every payload with every connection error. Each operation still needs a command-path failure test that proves whether the command aborts, falls back, or ignores the failure.

### Regression risks

Do not encode a desired recovery as though it already exists. The following source paths deserve bounded regression tests:

- N1 HTTP 401 before the initial client session exists.
- A2 exceptions thrown inside the async polling timer callback, and endless pending responses.
- `extensions` present without `deprecations` on App Management/Business Platform responses.
- `Retry-After` interpreted as milliseconds.
- Business Platform token expiry not checked by the local session validator.
- Organization detail cache reuse across accounts.
- N5's independent credential path and non-forced refresh handler.
- Lost `CreateApp` responses followed by automatic network retries.
- Specification/parser caches reused after schema changes.

These are source-derived risks, not live-service reproductions. Give each test a timeout and request ceiling so a recursion or pending-promise bug cannot hang the suite.

## Test boundaries and existing coverage

[services/info.test.ts](/packages/app/src/cli/services/info.test.ts) tests rendering with prepared app and organization objects. It does not establish coverage of `linkedAppContext`, authentication, real HTTP responses, or lifecycle hooks.

Use those render tests alongside:

- [app-context.test.ts](/packages/app/src/cli/services/app-context.test.ts): linking and loading orchestration.
- [app-management-client.test.ts](/packages/app/src/cli/utilities/developer-platform-client/app-management-client.test.ts): API-to-model mapping.
- [fetch-extension-specifications.test.ts](/packages/app/src/cli/services/generate/fetch-extension-specifications.test.ts): specification merging.
- [public GraphQL tests](/packages/cli-kit/src/public/node/api/graphql.test.ts) and [API retry tests](/packages/cli-kit/src/private/node/api.test.ts): refresh and retry behavior.
- [session tests](/packages/cli-kit/src/private/node/session.test.ts), [exchange tests](/packages/cli-kit/src/private/node/session/exchange.test.ts), and [device authorization tests](/packages/cli-kit/src/private/node/session/device-authorization.test.ts): OAuth behavior.
- [notification tests](/packages/cli-kit/src/public/node/notifications-system.test.ts) and [postrun tests](/packages/cli-kit/src/public/node/hooks/postrun.test.ts): process-level behavior.

For end-to-end fixtures, use real temporary project files and isolated session/cache storage. Intercept HTTP, not only `DeveloperPlatformClient` methods, so malformed envelopes, headers, retries, and token exchanges reach the code under test.

Do not set `SHOPIFY_UNIT_TEST=1` just to suppress notifications in a process-level auth test: `AppManagementClient.session()` rejects dynamic authentication in unit-test mode. Control the notification feed and cache instead. For ordinary command fixtures, disable analytics and auto-upgrade, clear always-log/force-upgrade overrides, and control the npm version check separately. Disabling auto-upgrade alone does not disable that check.

Prefer fresh processes when varying account, specification, or telemetry state. Resetting only the filesystem does not clear the App Management singleton, in-progress refresh tracking, Ajv validators, or process-level reporting state. Keep lifecycle tests separate from domain tests, freeze time where caches or notification dates matter, and reject every unregistered request.
