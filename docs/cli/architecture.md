# Architecture

The Shopify CLI is written in [Typescript](https://www.typescriptlang.org/) and runs in the Node runtime.
We settled on a **Javascript-based** stack because it aligns with the programming language used to build for the platform,
and allows having a strongly-typed contract with web tooling that's necessary to compile and optimize projects for deployment.
It's designed following a **modular** architecture where the bottom-most layer represents the foundation that all the features build upon,
and the top-most layer represents an horizontally-distributed set of features that users can opt into based on their needs.
Modularization also encourages clearly defined boundaries that leads to a better structure that's easier to maintain long-term.

## Extension configuration boundaries

`CommonExtensionSchema` defines shared extension fields. Each specification adds its own capabilities and derives
its configuration type from its schema. `BaseSchema` retains the existing boolean capabilities for UI and legacy
specifications; it is not the constraint for every configuration.

`BaseSchema` preserves the legacy field order because serialized configurations can contribute to generated identities.

`ExtensionInstance<TConfiguration>` keeps its configuration paired with `ExtensionSpecification<TConfiguration>`.
Custom configuration types require an explicit schema.

Mixed collections use `ExtensionSpecificationRuntime` and `ExtensionInstanceRuntime`. These views expose metadata,
parsed construction, and operations bound to the owning configuration, not configuration-specific callbacks. The
runtime view treats capabilities as `unknown` until a consumer narrows them. The loader uses `createInstance` and
`expandConfiguration` to preserve that boundary. Construction uses the final merged
parser and metadata and resolves entry paths only after validation succeeds.

UI payload consumers use a configuration-specific view. `isUIExtensionInstance` checks preview support and UI
capabilities before a mixed instance enters that path. Helpers that only need a directory should accept that directory.

## Modules (packages)

It's important to understand the responsibility of each of the packages to ensure new code is placed in the right package,
and that you can find the component you are looking for more easily.

<br/>

| Package | Description | Examples |
| ------- | ----------- | ------ |
| @shopify/create-app | Contains an executable that guides the user through the process of creating a new Shopify app | Executable and init command |
| @shopify/cli | Contains the CLI executable that glues all the commands provided by the features under it | Executable and init command |
| @shopify/app | Contains the logic for creating, building, serving, and deploying Shopify apps | Commands, App model, Deployment tool. |
| @shopify/theme |  Contains the logic for creating, building, and pushing themes. | Commands, Theme server and checker. |
| @shopify/cli-kit | Contains models and utilities that are shared across all the features | Authentication handler, Admin API Client, Session manager. |

<br/>

`@shopify/hydrogen` and `@shopify/create-hydrogen` packages used to be part of this repository, but they have been moved. For details about these packages, please visit:

- [@shopify/hydrogen](https://github.com/Shopify/hydrogen/tree/main/packages/hydrogen)
- [@shopify/create-hydrogen](https://github.com/Shopify/hydrogen/tree/main/packages/create-hydrogen)
