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

### Run against a local project

You can run the CLIs through the following `package.json` scripts:

- `yarn shopify`: Builds and runs the Shopify CLI.
- `yarn create-app`: Builds and runs the create-app CLI.
- `yarn create-hydrogen`: Builds and runs the create-hydrogen CLI.

All commands support the `--path` argument, so you can run any command pointing to your app. For example, `yarn shopify app build --path /path/to/project`

:::tip For first-party contributors
The project is configured with a `dev.yml` so the above steps become `dev up`, `dev clone`, and `dev shopify|create-app|create-hydrogen` for running the various CLIs.
:::

### Run against the fixture project

The repository contains fixture projects under `fixtures/` that can be used for testing purposes.
`fixture/app` is the most representative of what a standard Shopify app looks like.
If you want to interact with it, you can `cd` into the directory and run the CLI through the scripts in the `package.json`:

| Command | **Yarn** | **dev** |
| ---- | ---- | --- |
| shopify | `yarn shopify` | `dev fixture shopify` |
| build | `yarn build` | `dev fixture build` |
| dev | `yarn dev` | `dev fixture dev` |
| test | `yarn test` | `dev fixture test` |
| scaffold | `yarn scaffold` | `dev fixture scaffold` |

### Interacting with Spin environments

:::caution Only for Shopify employees
The content in this section is only relevant for Shopify employees that might need to debug the integration of the CLI with internal environments.
:::

The CLI can't run in a Spin environment yet. However, you can run it pointing to Spin environments. It is useful, for example, to debug new or existing features on Identity or Partners.
You can do so by using the following environment variables that instruct the CLI on the environment for each of the services. By default, it points to the production instance of the service.

```bash
SHOPIFY_PARTNERS_ENV=spin
SHOPIFY_SHOPIFY_ENV=spin
SHOPIFY_IDENTITY_ENV=spin

# Optional:
#  When not passed, it uses the last Spin instance created.
SPIN_INSTANCE=[spin-instance-fqdn]
```

For example, if we want to use the partners' constellation, which includes Partners and Identity, you can run the following command:

```bash
SHOPIFY_PARTNERS_ENV=spin SHOPIFY_IDENTITY_ENV=spin dev shopify {...args}
```

#### Executing commands with default spin environment variables

A `dev` script has been added to avoid setting the environment variables manually, it can be run this ways:

```bash
dev spin shopify {...args}
```
By default, this command uses the latest Spin instance created. In case a different one is needed, use the `SPIN_INSTANCE` environment variable when executing the script:
```bash
SPIN_INSTANCE=[spin-instance-fqdn] dev spin shopify {...args}
```


### More automation

Besides the scripts for building and running the CLIs, there are others that might come handy when adding code to the project:

- `yarn test`: Runs the tests of all the packages.
- `yarn lint`: Runs ESLint and Prettier checks for all the packages.
- `yarn lint:fix`: Runs ESLint and Prettier checks for all the packages and fixes the fixable issues.
- `yarn tsc`: Type-checks all the packagesusing the Typescript `tsc` tool.
- `yarn clean`: Removes the `dist` directory from all the packages.

All the packages in the repository contain the above scripts so they can be executed too for an individual package.
