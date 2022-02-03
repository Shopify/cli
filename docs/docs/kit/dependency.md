---
title: Dependency
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

const dependencyManager = createDependencyManager(); // dependency.DependencyManager
```

With that information the `create` command can use the same dependency manager to install the dependencies of the generated project.
