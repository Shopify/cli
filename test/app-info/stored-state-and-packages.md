<!--
title: app_info_stored_state_and_packages
description: App-info effects of preferences, account state, packages, and installation warnings.
tags: [documentation, app-info, authentication, configuration, testing]
-->

# App info stored-state and package effects

This is the command-specific profile for the researched CLI baseline `8829ed581d25f964c53564c403bfbf94484753b4`. Shared state variants now live in the [command-testing skill](/.agents/skills/cli-command-tests/references/state-catalog.md). Reuse the [storage](/.agents/skills/cli-command-tests/references/stored-state.md), [authentication](/.agents/skills/cli-command-tests/references/authentication.md), and [package](/.agents/skills/cli-command-tests/references/packages.md) references for input variants. The fields that become report values are specific to this command.

## Which fields affect app info?

`configFile` is the preference that selects the app TOML. Cached `appId`, `title`, `orgId`, and `storeFqdn` are not authoritative report values in the normal linked-info path. The command still fetches the remote app and organization, and reads the dev store from app TOML/hidden configuration.

Changing the selected TOML can change its client ID, scopes, dotenv file, hidden settings, discovered components, validation errors, and network requests. Changing only a cached title or store does not replace the corresponding report value.

Without `--reset`, selection is:

1. Explicit `--config`, including its environment binding.
2. The saved `configFile` for the discovered project root.
3. `shopify.app.toml`.

`--client-id` is a remote-ID override in this command path. It is not passed to the initial TOML selector and does not select another TOML by matching IDs. A missing default file is not repaired by choosing the only named config unless another selection path, such as stale-preference recovery, does so.

`--reset` enters linking before the normal selection path. It is not a command to delete app preferences or authentication state; linking's own local loads can still consult preferences.

Sources: [active selection](/packages/app/src/cli/models/project/active-config.ts), [linked context](/packages/app/src/cli/services/app-context.ts), and [report fields](/packages/app/src/cli/services/info.ts).

## What account state changes in output

The text report's account row comes from the App Management client's `UserInfo` result, not the saved alias. When the result contains an account, user credentials produce a user-email row; an automation token produces a service-account organization row. A missing account produces `User: unknown`. Full JSON and web-env omit this text row but still initialize the authenticated client.

Automation credentials take precedence over normal stored-user authentication in the combined App Management/Business Platform helper. They do not bypass the earlier alias check. The internal linking flow also has a separate Business Platform authentication path, so automation-token tests should not assume every linking call ignores stored accounts.

The App Management client caches its initialized session in memory. Replacing files or changing the command-local account does not automatically rebuild that existing client. Use fresh processes for normal account-selection fixtures; test same-process reuse separately.

Sources: [client session and account information](/packages/app/src/cli/utilities/developer-platform-client/app-management-client.ts), [automation-token helper](/packages/cli-kit/src/public/node/session.ts), and [info output](/packages/app/src/cli/services/info.ts).

## Output, warnings, and non-effects

| Input                      | Observable effect                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Detected package manager   | Text system row, suggested `app config link` command, and full JSON `packageManager`.                                            |
| Declared root dependencies | Full JSON `nodeDependencies`; also feeds the multiple-installation warning gate. It does not prove packages are installed.       |
| Workspace boolean          | Full JSON `usesWorkspaces`; not a separate text-report row.                                                                      |
| Root package name/version  | Does not replace the app title/client ID or the running CLI version.                                                             |
| Project scripts            | Not executed merely to inspect the project.                                                                                      |
| Project `engines.node`     | Not enforced by this project loader; CLI bootstrap has its own Node-version requirement.                                         |
| Marker bytes               | No change to detection when existence and location stay the same.                                                                |
| Web-component manifests    | Can change full JSON `webs[].framework` through the separate framework detector. They do not merge into root `nodeDependencies`. |

The three web-env values do not come from package metadata. Package read failures and loading warnings can still occur before web-env output.

Installed UI dependencies are a separate input from this manifest inventory. Shared-type generation can resolve `@shopify/ui-extensions` target/helper exports and abort when they are unavailable. [Extension file states](../../.agents/skills/cli-command-tests/references/extension-files.md#ui-extension-dependencies-and-generation-gates) covers missing installations, incompatible exports, API/tsconfig gates, and generated-file effects.

## Fixture isolation and assertions

Use real temporary projects and stores, not filesystem mocks. Put only synthetic credentials and account identifiers in files, output snapshots, and intercepted requests.

For each fixture, assert the behavior that its input can change:

1. Selected project/configuration, effective remote client ID, and any configuration prompt.
2. Selected account, authorization headers, OAuth reuse/refresh/login, and expected domain requests.
3. Text report, full JSON, or web-env output, plus stderr and exit status.
4. Before/after app-preference and session stores, including preserved fields and current-account selection.
5. Project file writes and subprocess calls; reject unexpected installs, builds, and real service access.

Use a fresh process for normal account-selection cases. Do not set `SHOPIFY_UNIT_TEST=1` merely to relocate the CLI-kit store in an auth E2E fixture: dynamic App Management authentication rejects that mode. Isolate notification/query caches and auto-upgrade behavior separately so they do not hide requests or add unrelated output.

Existing focused tests cover parts of these contracts: [app storage](/packages/app/src/cli/services/local-storage.test.ts), [configuration use](/packages/app/src/cli/services/app/config/use.test.ts), [active selection](/packages/app/src/cli/models/project/active-config.test.ts), [session storage](/packages/cli-kit/src/private/node/session/store.test.ts), [session validation](/packages/cli-kit/src/private/node/session/validate.test.ts), [authentication orchestration](/packages/cli-kit/src/private/node/session.test.ts), [package helpers](/packages/cli-kit/src/public/node/node-package-manager.test.ts), and [installation warnings](/packages/cli-kit/src/public/node/multiple-installation-warning.test.ts). They do not prove every command-level fixture above has been implemented.
