<img src="https://github.com/Shopify/cli/blob/main/assets/logo.png?raw=true" width="150"/>

# Shopify CLI
<a href="http://twitter.com/ShopifyDevs"><img src="https://img.shields.io/twitter/follow/ShopifyDevs?style=flat-square" alt="Twitter Followers"></a>
<img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
<a href="https://github.com/Shopify/cli/actions/workflows/shopify-cli.yml">![badge](https://github.com/Shopify/cli/actions/workflows/shopify-cli.yml/badge.svg)</a>

With the Shopify command line interface (Shopify CLI 3.0), you can:
- build custom storefronts and manage their hosting
- initialize, build, dev, and deploy Shopify apps — and scaffold app extensions

<p>&nbsp;</p>

### Before you begin ###

Install the latest version of  [Node.js](https://nodejs.org/en/download/) and [npm](https://docs.npmjs.com/getting-started) (or another package manager of your choice).

<p>&nbsp;</p>

## Developing apps with Shopify CLI

When you’re building a Shopify app, you can initialize your project using your preferred package manager. A single command will install all the dependencies you need — including Shopify CLI itself.

Initialize your project using one of the following commands:
- `npx @shopify/create-app@latest` (installed by default with Node)
- `pnpm create @shopify/create-app@latest`
- `yarn create @shopify/app`

Learn more in the docs: [Create an app](https://shopify.dev/apps/getting-started/create)

<p>&nbsp;</p>

## Developing Hydrogen custom storefronts with Shopify CLI ##

When you’re building a custom storefront, use Hydrogen, Shopify’s React-based framework optimized for headless commerce. Initialize a new Hydrogen app with a fully-featured Demo Store template, or start from scratch with the minimal Hello World template. Shopify Plus stores can deploy their Hydrogen apps to Oxygen, Shopify’s global hosting solution, at no extra cost.

Get started using one of the following commands:
- `npm init @shopify/hydrogen@latest`
- `npx @shopify/create-hydrogen@latest`
- `pnpm create @shopify/create-hydrogen@latest`
- `yarn create @shopify/hydrogen`

<p>&nbsp;</p>

## Help 🖐

If you encounter issues using the CLI or have feedback you'd like to share with us, below are some options:

- [Open a GitHub issue](https://github.com/Shopify/cli/issues) - To report bugs or request new features, open an issue in the Shopify CLI repository.
- [Shopify Community Forums](https://community.shopify.com/) - Visit our forums to connect with the community and learn more about Shopify CLI development.

<p>&nbsp;</p>

## References

- [oclif](https://oclif.io/)
