# Automating via Nx

[Nx](https://nx.dev/) is a Node-based build tool. We've been using it since the inception of the repository to have incremental builds locally and selective builds on CI. Nx's default behavior infers the dependency graph and build tasks from the projects' `package.json` files. This is how we've been using it, but we started diverging from this model when we [merged the UI extensions' projects](https://github.com/Shopify/cli/pull/237), some of which are not NPM packages but Go projects. This effort made us realize how scripts in `package.json`'s declared build task dependencies implicitly in `scripts`. The example below shows how the `build` script depends on `clean` being executed first:

```json
{
  "scripts": {
    "build": "pnpm clean && tsc",
    "clean": "rm -rf dist/"
  }
}
```

This implicitness is undesirable for Nx because some of its capabilities rely on the graph information being very explicit. Because of it, we decided to move away from Nx's default mode to codify actions explicitly in projects' `project.json` files.
