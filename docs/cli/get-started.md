# Get started

The [Shopify CLI](https://github.com/shopify/cli) is the tool developers use to build apps and storefronts for the [Shopify platform](https://shopify.dev).
This wiki contains documentation that's useful for contributors of the project.

### Requirements

If you'd like to contribute to this project, the following system dependencies need to be present in the environment.

- [Node](https://nodejs.org/en/): use a supported version that meets the `engines` requirements in [CLI](../../packages/cli/package.json), [app](../../packages/app/package.json), and [CLI Kit](../../packages/cli-kit/package.json).
- [PNPM](https://pnpm.io/): use the version in the root [`packageManager`](../../package.json) field.

### Set up

Once you have the necessary system dependencies,
you can go through the steps below to have your environment setup to work with the project:

1. Clone the repository: `git clone https://github.com/Shopify/cli.git`.
2. Install dependencies: `pnpm install`

### Run against a local project

You can run the CLIs through the following `package.json` scripts:

- `pnpm shopify`: Builds and runs the Shopify CLI.
- `pnpm create-app`: Builds and runs the create-app CLI.

All commands support the `--path` argument, so you can run any command pointing to your app. For example, `pnpm shopify app build --path /path/to/project`

### Create a new app from scratch

Run these commands from the CLI repository root to build the local CLI and create an app in `../test-app`:

```bash
pnpm nx build cli
pnpm create-app --local --name test-app --path .. --template reactRouter --flavor javascript
```

To add extensions, run this command once for each extension. Select a UI extension, theme app extension, or function from the prompts:

```bash
pnpm shopify app generate extension --path ../test-app
```

Start the development server and follow the prompts to select a development store:

```bash
pnpm shopify app dev --path ../test-app
```

To deploy the app, run:

```bash
pnpm shopify app deploy --path ../test-app
```

### Create a new theme from scratch

If you want to quickly test creating a theme from scratch, you can run `bin/create-test-theme.js -s YOUR_STORE`. It will:

- create a new theme on your Desktop
- start the development server on http://localhost:9292
- push the theme to your store
- list all the available themes

You can also pass these optional flags:
- `--cleanup` to remove the theme directory afterwards

### More automation

Besides the scripts for building and running the CLIs, there are others that might come handy when adding code to the project:

- `pnpm test`: Runs the tests of all the packages.
- `pnpm lint`: Runs ESLint and Prettier checks for all the packages.
- `pnpm lint:fix`: Runs ESLint and Prettier checks for all the packages and fixes the fixable issues.
- `pnpm type-check`: Type-checks all the packagesusing the Typescript `tsc` tool.
- `pnpm clean`: Removes the `dist` directory from all the packages.

All the packages in the repository contain the above scripts so they can be executed too for an individual package.
