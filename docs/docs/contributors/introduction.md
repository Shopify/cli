---
title: Introduction
---

The [Shopify CLI](https://github.com/shopify/shopify-cli-next) is the tool developers use to build apps and storefronts for the [Shopify platform](https://shopify.dev).
This website contains documentation that's useful for contributors of the project.

### Requirements

If you'd like to contribute to this project, the following system dependencies need to be present in the environment.

- [Node](https://nodejs.org/en/) (v14 or higher)
- [Yarn](https://yarnpkg.com/)

### Set up

Once you have the necessary system dependencies,
you can go through the steps below to have your environment setup to work with the project:

1. Clone the repository: `git clone https://github.com/Shopify/shopify-cli-next.git`.
2. Install dependencies: `yarn install`

### Run

You can run the CLIs through the following `package.json` scripts:

- `yarn dev:shopify`: Builds and runs the Shopify CLI.
- `yarn dev:create-app`: Builds and runs the create-app CLI.
- `yarn dev:create-hydrogen`: Builds and runs the create-hydrogen CLI.

:::tip For first-party contributors
The project is configured with a `dev.yml` so the above steps become `dev up`, `dev clone`, and `dev shopify|create-app|create-hydrogen` for running the various CLIs.
:::

Running the CLI involves transpiling and bundling through [Rollup](https://rollupjs.org).
Unfortunately Rollup doesn't have incremental builds and this results in clean builds every time the command is invoked.
If you've previously built a CLI and want to run it, there are also `package.json` scripts to run previously built CLIs:

- `yarn run:shopify`: Runs the Shopify ClI (without building).
- `yarn run:create-app`: Runs the create-app CLI (without building).
- `yarn run:create-hydrogen`: Runs the create-hydrogen CLI (without building).

### More automation

Besides the scripts for building and running the CLIs, there are others that might come handy when adding code to the project:

- `yarn test`: Runs the tests of all the packages.
- `yarn lint`: Runs ESLint and Prettier checks for all the packages.
- `yarn lint:fix`: Runs ESLint and Prettier checks for all the packages and fixes the fixable issues.
- `yarn tsc`: Type-checks all the packagesusing the Typescript `tsc` tool.
- `yarn clean`: Removes the `dist` directory from all the packages.

All the packages in the repository contain the above scripts so they can be executed too for an individual package.
