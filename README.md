<img src="https://github.com/Shopify/cli/blob/main/assets/logo.png?raw=true" width="150"/>

# Shopify CLI
<a href="http://twitter.com/ShopifyDevs"><img src="https://img.shields.io/twitter/follow/ShopifyDevs?style=flat-square" alt="Twitter Followers"></a>
<img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
<a href="https://github.com/Shopify/cli/actions/workflows/shopify-cli.yml">![badge](https://github.com/Shopify/cli/actions/workflows/shopify-cli.yml/badge.svg)</a>

With the Shopify command line interface (Shopify CLI 3.0), you can:
- initialize, build, dev, and deploy Shopify apps, extensions, functions and themes
- build custom storefronts and manage their hosting

Learn more in the [commands docs](./packages/cli/README.md#commands).

<p>&nbsp;</p>

### Before you begin ###

Install the latest version of  [Node.js](https://nodejs.org/en/download/) and [npm](https://docs.npmjs.com/getting-started) (or another package manager of your choice).

<p>&nbsp;</p>

## Developing apps with Shopify CLI

When you’re building a Shopify app, you can initialize your project using your preferred package manager. A single command will install all the dependencies you need — including Shopify CLI itself.

Initialize your project by running:
`npx shopify app init`

Learn more in the docs: [Getting Started with Apps](https://shopify.dev/docs/apps/build/scaffold-app)

---

Alternatively you can use one of the following commands:

- `npm init @shopify/app@latest` (installed by default with Node)
- `pnpm create @shopify/create-app@latest`
- `yarn create @shopify/app`
- `bun create @shopify/app@latest` (experimental)

---

<p>&nbsp;</p>

## Developing Liquid themes with Shopify CLI

To start working on a Liquid theme, you can use the following command:

- `npx shopify theme init`

Learn more in the docs: [Getting Started with Themes](https://shopify.dev/docs/storefronts/themes/getting-started/create)

---

Alternatively, you can install the CLI globally with:

`npm install -g @shopify/cli`

You can also use do it through Homebrew on macOS: `brew tap shopify/shopify && brew install shopify-cli`

and then run:

`shopify theme init`

---

<p>&nbsp;</p>

## Developing Hydrogen storefronts with Shopify CLI ##

To start working on a Hydrogen storefront, you can use the following command:

- `npx shopify hydrogen init`

Learn more in the docs: [Getting Started with Hydrogen](https://shopify.dev/docs/storefronts/headless/hydrogen/getting-started)

---

To contribute to Hydrogen's CLI plugin, you can find the code and contribution instructions in the Hydrogen repo here: https://github.com/Shopify/hydrogen/tree/main/packages/cli

Learn more about the CLI in the docs: [Shopify CLI for Hydrogen storefronts](https://shopify.dev/docs/api/shopify-cli/hydrogen)

---

<p>&nbsp;</p>

## Help 🖐

If you encounter issues using the CLI or have feedback you'd like to share with us, below are some options:

- [Open a GitHub issue](https://github.com/Shopify/cli/issues) - To report bugs or request new features, open an issue in the Shopify CLI repository
- [Shopify Community Forums](https://community.shopify.com/) - Visit our forums to connect with the community and learn more about Shopify CLI development
- [CLI Documentation - Apps](https://shopify.dev/apps/tools/cli) - To view CLI documentation for app development
- [CLI Documentation - Themes](https://shopify.dev/themes/tools/cli) - To view CLI documentation for theme development
- [CLI Documentation - Hydrogen](https://shopify.dev/custom-storefronts/tools/cli) - To view CLI documentation for Hydrogen (custom storefront) development

## Contribute 👩🏽‍💻

If you'd like to contribute to the project, check out the [contributors docs](/docs) and the [steps to get started](/docs/cli/get-started.md).

<p>&nbsp;</p>

## References

- [oclif](https://oclif.io/)
