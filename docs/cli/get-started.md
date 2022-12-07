# Get started

The [Shopify CLI](https://github.com/shopify/cli) is the tool developers use to build apps and storefronts for the [Shopify platform](https://shopify.dev).
This wiki contains documentation that's useful for contributors of the project.

### Requirements

If you'd like to contribute to this project, the following system dependencies need to be present in the environment.

- [Node](https://nodejs.org/en/) (v14 or higher)
- [PNPM](https://pnpm.io/)

### Set up

Once you have the necessary system dependencies,
you can go through the steps below to have your environment setup to work with the project:

1. Clone the repository: `git clone https://github.com/Shopify/cli.git`.
2. Install dependencies: `pnpm install`

### Run against a local project

You can run the CLIs through the following `package.json` scripts:

- `pnpm shopify`: Builds and runs the Shopify CLI.
- `pnpm create-app`: Builds and runs the create-app CLI.
- `pnpm create-hydrogen`: Builds and runs the create-hydrogen CLI.

All commands support the `--path` argument, so you can run any command pointing to your app. For example, `pnpm shopify app build --path /path/to/project`

### Run against the fixture project

The repository contains fixture projects under `fixtures/` that can be used for testing purposes.
`fixture/app` is the most representative of what a standard Shopify app looks like.
If you want to interact with it, you can `cd` into the directory and run the CLI through the scripts in the `package.json`:

| Command | **PNPM** | **dev** |
| ---- | ---- | --- |
| shopify | `pnpm shopify` | `dev fixture shopify` |
| build | `pnpm build` | `dev fixture build` |
| dev | `pnpm dev` | `dev fixture dev` |
| test | `pnpm test` | `dev fixture test` |
| generate | `pnpm generate` | `dev fixture generate` |

### More automation

Besides the scripts for building and running the CLIs, there are others that might come handy when adding code to the project:

- `pnpm test`: Runs the tests of all the packages.
- `pnpm lint`: Runs ESLint and Prettier checks for all the packages.
- `pnpm lint:fix`: Runs ESLint and Prettier checks for all the packages and fixes the fixable issues.
- `pnpm type-check`: Type-checks all the packagesusing the Typescript `tsc` tool.
- `pnpm clean`: Removes the `dist` directory from all the packages.

All the packages in the repository contain the above scripts so they can be executed too for an individual package.
