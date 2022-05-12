---
title: dependency
---

The `dependency` module provides utilities for interacting with the dependency management area of the environment.


### Determining the dependency manager used to create

Developers can run the create workflow through different dependency managers:

```bash
npx @shopify/create-app@latest
yarn create @shopify/app
pnpm create @shopify/app
```

To determine the dependency manager used to run the command,
`dependency` provides a function to obtain that information:

```ts
import { dependencty } from "@shopify/cli-kit"

const dependencyManager = dependencyManagerUsedForCreating(); // dependency.DependencyManager
```

With that information the `create` command can use the same dependency manager to install the dependencies of the generated project.

### Installing NPM dependencies recursively

Projects might contain more than one NPM dependency graph declared in `package.json` files in different directories.
In that scenario,
we might want to traverse all those directories and install the dependencies before running any command's business logic.
The `dependency` module provides a function to do that:

```ts
import { dependency, DependencyManager } from "@shopify/cli-kit"

await installNPMDependenciesRecursively({
    directory: "/path/to/project",
    dependencyManager: "yarn"
})
```

If any of the installation fails, other installations are cancelled.
