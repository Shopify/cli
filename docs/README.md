<img src="https://github.com/Shopify/shopify-cli/raw/main/assets/logo.png" alt="Shopify logo" width="150">

# Contributors documentation

This page contains resources for people interested in contributing to this repository or develop a [plugin](./plugins.md).

## CLI

The Shopify CLI is a tool for merchants, partners, and developers to interact with the platform from their terminals. Developers can extend it through plugins. We provide them with foundational components and utilities in a [@shopify/cli-kit](https://www.npmjs.com/package/@shopify/cli-kit) package to ensure they build tremendous and consistent terminal experiences. The list below contains valuable resources for people interested in contributing to the CLI project in this repository.


* [Get started](./get-started.md)
* [Architecture](./architecture.md)
* [Conventions](./conventions.md)
* [Debugging](./debugging.md)
* [ESLint rules](./eslint-rules.md)
* [Principles](./principles.md)
* [Release process](./release.md)
* [Testing strategy](./testing-strategy.md)
* [Cross-OS compatibility](./cross-os-compatibility.md)
* [Troubleshooting](./troubleshooting.md)
* [FAQ](./faq.md)

### Decision Record

The pages below document the rationale behind some decisions that we made:

* [August 2022 - Automating via Nx](./decision-record/2022_08-automation-via-nx.md)
* [May 2022 - IDs' persistence](./decision-record/2022_05-IDs'-persistence.md)
* [March 2022 - Lazy downloading a fixed version of the extension binary](./decision-record/2022_03-Lazy-downloading-a-fixed-version-of-the-extension-binary.md)
* [March 2022 - Configuration source of truth](./decision-record/2022_03-Configuration-source-of-truth.md)
* [February 2022 - Incremental builds with Nx](./decision-record/2022_02-Incremental-builds-with-Nx.md)
* [February 2022 - ESM, Rollup, and Vitest](./decision-record/2022_02-ESM,-Rollup,-and-Vitest.md)
* [January 2022 - Unified dependency graph](./decision-record/2022_01-unified-dependency-graph.md)
* [January 2022 - TypeScript rewrite](./decision-record/2022_01-TypeScript-rewrite.md)

## CLI Kit


## Plugins

[Plugins](./plugins.md) are NPM packages that extend, customize, and augment core CLI functionality. Some plugins are developed by Shopify (included in the list below) and we refer to them as official plugins, while some others are developed by external developers. If you would like to develop a plugin, we recommend checking out the resources in the development section below.

### List of official plugins

* [Ngrok tunnel](./plugins/ngrok.md)
