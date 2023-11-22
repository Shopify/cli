# January 2022 - Unified dependency graph

### The problem

Before the Shopify CLI 3.0 the transitive dependencies that the CLI required for building scripts and extensions were **dependencies of the blocks**. For example:

```json
// package.json
{
  "devDependencies": {
     "@shopify/checkout-ui-extensions-run": "0.7.0"
  }
}
```

This approach has a handful of downsides that worsen the experience using the CLI. First, when users create multiple blocks as part of building their app, the **dependency ends up duplicated across all the blocks**. Developers could improve that by setting up their projects at workspaces, but we'd be dumping that responsibility on them. This also introduces the risk of **inconsistencies across blocks, and the burden of keeping them up-to-date**. One might think we could solve this by building our app model upon the workspaces concept dependency managers support. However, how workspaces are implemented differ across package managers (e.g. [pnpm](https://pnpm.io/workspaces) and [Yarn](https://classic.yarnpkg.com/lang/en/docs/workspaces/)), and therefore, we'd be coupling the CLI to a package manager. The CLI must be weakly opinionated about the dependency managers want to use.

Because there's a **weak contract** between the Shopify CLI, which is globally installed, and the blocks' CLIs, that are project-scoped, we need a [lot of logic](https://github.com/Shopify/shopify-cli/blob/c370cae2f433a86d6bc81892872edac095e6c9f2/lib/project_types/extension/tasks/find_package_from_json.rb#L6) on the CLI to **minimize the assumptions** and ensure the developers don't experience broken contracts between the CLIs:

- Does the user have Node?
- Does the block have the version of the package that I expect?
- If the version is not the one we expect, do we update? Do we tell users how to update?
- Have dependencies been installed?
- If not, do we install them? Do we tell users to install them?

Moreover, blocks' CLIs don't have tests in place to detect when breaking changes are introduced, and therefore, we rely on humans detecting them to decide whether the next version should be major or not.

**While the setup gives contributors the flexibility to decouple their release schedule from the CLI's, we do it at the cost of presenting users with a setup that's error prone, and a burden to maintain.**

### The solution

In Shopify CLI 3.0 we are moving from this model to a **unified dependency graph**.

```json
// app/package.json
{
  "dependencies": {
    "@shopify/cli": "3.0.0"
  }
}
```

As described [here](/contributors/decision-record/2022-01-typescript-rewrite), the dependency managers will **deterministically resolve and pull the graph and ensure it's compatible with the activated Node environment** This includes tool and runtime dependencies. If `npm/yarn/pnpm install` succeeds in resolving the graph, developers will have everything in their environment to interact with their projects.

Moreover, **the version requirements will be strict** in this first iteration. Softening the requirements for transitive dependencies like `@shopify/checkout-ui-extensions-run` or `@shopify/scripts-toolchain-as` will require them to have acceptance tests that ensure we don't rely on humans to figure out if a change is breaking or not.

Having soft version requirements and transitive dependencies doing minor releases with breaking changes is a recipe for users running into issues and having to delete `node_modules` in the aim for the dependency manager to fix the issues. This is not the experience we want our users to have.

We'll **evaluate the need for having some dependencies as `peerDependencies` in a per-dependency basis** based on users' feedback. For example, NextJS makes `React` a `peerDependency` that needs to be a dependency of the project:

```json
{
  "dependencies": {
    "next": "12.0.1",
    "react": "17.0.2"
  }
}
```

