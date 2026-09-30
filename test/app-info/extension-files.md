<!--
title: app_info_extension_loading_effects
description: How shared extension loading, generation, and localization affect app info.
tags: [documentation, app-info, extensions, filesystem, testing]
-->

# App info extension-loading effects

This is the command-specific profile for the researched CLI baseline `8829ed581d25f964c53564c403bfbf94484753b4`. Shared state variants now live in the [command-testing skill](/.agents/skills/cli-command-tests/references/state-catalog.md). Installed exports, source/tsconfig gates, supporting JSON, referenced schemas, and locale variants are defined in [extension dependencies and support files](/.agents/skills/cli-command-tests/references/extension-files.md). Their schema histories are in the [extension atlas](/.agents/skills/cli-command-tests/references/toml-schemas/extension-toml/README.md).

## Execution and failure boundaries

All four result modes share the same loading path: text, full JSON, text web-env, and JSON web-env. Neither JSON nor web-env skips these checks.

| Work                                       | Where it runs                                             | Observable effect                                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| UI module-path validation                  | `ExtensionInstance.validate()` during loading             | Missing main modules become collected `app.errors`; loading can continue and the command can print a result, then exit 2.                        |
| UI shared-type generation                  | `App.generateExtensionTypes()` at the end of loading      | Reads dependencies/support files, may warn, and writes `shopify.d.ts`. An uncaught entry-point generation error prevents the report.             |
| Localized configuration payload evaluation | `validateConfigurationExtensionInstance()` during loading | Can read root locale files and throw before rendering, despite the helper's call to a method named `deployConfig()`. It does not deploy the app. |

`unsafeTolerateErrors: true` tolerates collected configuration errors, not every thrown exception. A warning does not by itself add an app error or force exit 2. Other errors in the same fixture can still do so.

Sources: [app-info command](/packages/app/src/cli/commands/app/info.ts), [shared loader](/packages/app/src/cli/models/app/loader.ts), [extension validation](/packages/app/src/cli/models/extensions/extension-instance.ts), and [type-file writes](/packages/app/src/cli/models/app/app.ts).

## Fixture assertions

Keep output classes separate:

- **Skipped:** prove the dependency/file/request was not consumed; preserve any existing generated file unless the source explicitly removes it.
- **Generated:** assert `shopify.d.ts` bytes and write behavior; the normal report may be unchanged.
- **Warned:** capture stderr and the report independently. A warning does not imply exit 2.
- **Collected error:** assert available output followed by exit 2, where loading finishes.
- **Thrown error:** assert that the app report is absent and record any earlier requests, warnings, or writes.

Use real temporary files and installed-package fixtures, not filesystem mocks. A minimal synthetic package with controlled exports makes resolution tests independent of the developer's installed dependencies. Isolate clocks, sessions, API contracts, and lifecycle hooks as described in [network fixtures](../../.agents/skills/cli-command-tests/references/network.md).

Existing tests cover portions of these behaviors: [UI generation](/packages/app/src/cli/models/extensions/specifications/ui_extension.test.ts), [type-generation helpers](/packages/app/src/cli/models/extensions/specifications/type-generation.test.ts), and [locale loading](/packages/app/src/cli/utilities/extensions/locales-configuration.test.ts). Full-command coverage must still connect these helpers to each output mode.
