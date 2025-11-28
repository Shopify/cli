<img src="https://github.com/Shopify/shopify-cli/raw/main/assets/logo.png" alt="Shopify logo" width="150">

# Contributors documentation

This page contains resources for people interested in contributing to this repository or developing a [plugin](./plugins.md).

I like to change things.

## CLI

The Shopify CLI is a tool for merchants, partners, and developers to interact with the platform from their terminals. Its technical design allows adding features horizontally through [**plugins**](#plugins) that build on [**cli-kit**](#cli-kit). [@shopify/theme](https://www.npmjs.com/package/@shopify/theme), [@shopify/app](https://www.npmjs.com/package/@shopify/app), [@shopify/cli-hydrogen](https://www.npmjs.com/package/@shopify/cli-hydrogen) are examples of plugins to develop themes, apps, and hydrogen storefronts, respectively.

The list below contains valuable resources for people interested in contributing to the CLI project in this repository.

* [Get started](./cli/get-started.md)
* [Architecture](./cli/architecture.md)
* [Conventions](./cli/conventions.md)
* [Performance](./cli/performance.md)
* [Debugging](./cli/debugging.md)
* [ESLint rules](./cli/eslint-rules.md)
* [Testing strategy](./cli/testing-strategy.md)
* [Cross-OS compatibility](./cli/cross-os-compatibility.md)
* [Troubleshooting](./cli/troubleshooting.md)
* [Error handling principles](cli/error_handling.md)
* [FAQ](./cli/faq.md)

## CLI Kit

The [`@shopify/cli-kit`](https://www.npmjs.com/package/@shopify/cli-kit) NPM package provides utilities to abstract away interactions with the Shopify platform (e.g., authentication, API requests) and ensures experiences are consistent across the board. If you are creating a new plugin or contributing to an existing one, we recommend checking out the following resources:

- [Creating a new command or flag](cli-kit/command-guidelines.md)
- [Content and UI guidelines](cli-kit/ui-kit/guidelines.md)
- [Using UI Kit](cli-kit/ui-kit/readme.md)
- [Contributing to UI Kit](cli-kit/ui-kit/contributing.md)

## Decision Record

The following pages document the rationale behind some decisions that we made:

* [December 2022 - Dynamically importing Lodash using CommonJS](./decision-record/2022-12-21-dynamically-importing-lodash-using-commonjs.md)
* [August 2022 - Automating via Nx](./decision-record/2022_08-automation-via-nx.md)
* [May 2022 - IDs' persistence](./decision-record/2022_05-IDs'-persistence.md)
* [March 2022 - Lazy downloading a fixed version of the extension binary](./decision-record/2022_03-Lazy-downloading-a-fixed-version-of-the-extension-binary.md)
* [March 2022 - Configuration source of truth](./decision-record/2022_03-Configuration-source-of-truth.md)
* [February 2022 - Incremental builds with Nx](./decision-record/2022_02-Incremental-builds-with-Nx.md)
* [February 2022 - ESM, Rollup, and Vitest](./decision-record/2022_02-ESM,-Rollup,-and-Vitest.md)
* [January 2022 - Unified dependency graph](./decision-record/2022_01-unified-dependency-graph.md)
* [January 2022 - TypeScript rewrite](./decision-record/2022_01-TypeScript-rewrite.md)
