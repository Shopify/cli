<!--
title: app_information_filesystem_scenarios
description: Filesystem fixtures used by the app info command test suite.
tags: [documentation, testing, fixtures, app-info]
-->

# App information filesystem scenarios

Each subdirectory provides one complete filesystem input for `fixture.reserve(name)`:

```text
scenario-name/
├── project/
│   ├── shopify.app.toml
│   ├── package.json
│   └── web/
│       └── shopify.web.toml
└── shopify.environments.toml  # Optional ancestor input.
```

The catalog contains 116 filesystem scenarios. Tests with identical file state reuse a scenario, but each test receives its own temporary copy. The fixture doesn't apply a baseline overlay. If a file is absent from the scenario, it is absent from the copied project.

## Common scenarios

| Scenario                                                                                                      | File state                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `linked-app`                                                                                                  | Valid linked configuration, manifest, pnpm marker, and one web component      |
| `report-components`                                                                                           | Web and UI components, including metafields, for complete report expectations |
| `no-project`                                                                                                  | Empty project directory for discovery failure                                 |
| `linked-legacy-*`, `linked-endpoint-*`, `linked-uri-*`, `linked-old-*`, `linked-required-*`, `linked-mixed-*` | Historical linked compatibility inputs and validation boundaries              |
| `web-*`                                                                                                       | Ordered union, field normalization, port/HMR validation, and framework inputs |
| `named-staging-fixture`                                                                                       | Default and named staging configurations                                      |
| `named-config-dotenv`                                                                                         | Named configuration plus distinct default/named dotenv files                  |
| `config-name-collision`                                                                                       | Existing configurations used by interactive rename/overwrite tests            |
| `template-*`                                                                                                  | Historical or current unlinked template seeds                                 |
| `hidden-*`                                                                                                    | `.shopify/project.json` shapes, malformed data, or a relative symlink         |
| `package-manager-*`, `manifest-*`                                                                             | Marker detection and manifest states                                          |
| `ui-extension`                                                                                                | Remote-DOM UI extension, source, tsconfig, and synthetic installed exports    |
| `ui-tools-*`, `ui-intent-*`                                                                                   | Supporting JSON contents and missing/invalid states                           |
| `localized-module`, `locales-*`                                                                               | Remote-defined configuration-module inputs and root locale bytes              |

## Rules

- Treat source fixtures as immutable. Tests modify only the reserved copy.
- Keep inputs synthetic, including dotenv values, client IDs, and package stubs.
- Preserve exact bytes. Some JSON, TOML, UTF-8, and declaration files are intentionally invalid.
- `.gitkeep` preserves deliberately empty directories. It is an ordinary, irrelevant file in the copied fixture.
- Symlinks must be relative and stay inside their scenario. Copies preserve the link text rather than pointing back into this catalog.
- Do not put sessions or platform-specific home directories here. Use `seedState()` for authentication, preferences, and caches; runtime paths are not portable fixture bytes.
- The harness's `bin`, home/store/temp paths, protocol files, and outer module-resolution guard are reserved. Ancestor app inputs such as an environments file or lockfile can live beside `project/`.
- Keep network responses, clocks, terminal interaction, and subprocess outcomes explicit in test setup. Reserving files does not infer remote extension specifications from local TOML.

The fixture tree is excluded from Nx project discovery, TypeScript checking, ESLint, and Prettier. Its local Git-ignore override makes intentional `.env`, declaration files, and synthetic `node_modules` contents visible to Git. Do not run package installation inside these fixture directories.

When adding a scenario, copy a suitable directory, change only the relevant inputs, and reserve it by name in the test. Reuse a scenario when only flags or network responses differ. Use `writeFile()` only when bytes depend on a runtime value, such as a loopback server port, or when a test deliberately changes files between command executions.
