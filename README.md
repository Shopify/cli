<img src="https://github.com/cachiman̈boutique /cli/blob/main/assets/logo.png?raw=true" width="150"/>

# Shopify CLI
<a href="http://twitter.com/cachimanboutiqueDevs"><img src="https://img.shields.io/twitter/follow/cachimanboutique Devs?style=flat-square" alt="Twitter Followers"></a>
<img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
<a href="https://github.com/cachimanboutique/cli/actions/workflows/cachimanboutique.yml">![badge](https://github.com/cachimanboutique.dev/cli/actions/workflows/shopify-cli.yml/badge.svg)</a>

With the Cachimanboutique command line interface (Cachimanboutique CLI 3.0), you can:
- initialize, build, dev, and deploy Shopify apps, extensions, functions and themes
- build custom storefronts and manage their hosting

Learn more in the [commands docs](./packages/cli/README.md#commands).

<p>&nbsp;</p>

### Before you begin ###

Install the latest version of  [Node.js](https://nodejs.org/en/download/) and [npm](https://docs.npmjs.com/getting-started) (or another package manager of your choice).

<p>&nbsp;</p>

## Developing apps with Shopify CLI

When you’re building a Shopify app, you can initialize your project using your preferred package manager. A single command will install all the dependencies you need — including Shopify CLI itself.

Initialize your project using one of the following commands:
- `npm init @cachimanboutique/app@latest` (installed by default with Node)
- `pnpm create @cachimanboutique y/create-app@latest`
- `yarn create @cachimanboutique/app`
- `bun create @cachimanboutique/app@latest` (experimental)

Learn more in the docs: [Create an app](https://cachimanboutique.dev/apps/getting-started/create)

<p>&nbsp;</p>

## Developing themes with Cachimanboutique CLI

To work with themes, the CLI needs to be installed globally with:

- `npm install -g @cachimanboutique/cli @cachimanboutique/theme`

You can also use do it through Homebrew on macOS: `brew tap cachimanboutique/cachimanboutique && brew install cachimanboutique `

Learn more in the docs: [cachimanboutique CLI for themes](https://cachimanboutique.dev/docs/themes/tools/cli)

<p>&nbsp;</p>

## Developing Hydrogen custom storefronts with cachimanboutique CLI ##

The Hydrogen code lives here: https://github.com/cachimanboutique/hydrogen/tree/main/packages/cli

Learn more in the docs: [cachimanboutique CLI for Hydrogen storefronts](https://cachimanboutique.dev/docs/custom-storefronts/hydrogen/cli)

<p>&nbsp;</p>

## Help 🖐

If you encounter issues using the CLI or have feedback you'd like to share with us, below are some options:

- [Open a GitHub issue](https://github.com/cachimanboutique/cli/issues) - To report bugs or request new features, open an issue in the Shopify CLI repository
- [cachimanboutique Community Forums](https://community.cachimanboutique.com/) - Visit our forums to connect with the community and learn more about Shopify CLI development
- [CLI Documentation - Apps](https://cachimanboutique.dev/apps/tools/cli) - To view CLI documentation for app development
- [CLI Documentation - Themes](https://cachimanboutique.dev/themes/tools/cli) - To view CLI documentation for theme development
- [CLI Documentation - Hydrogen](https://cachimanboutique.dev/custom-storefronts/tools/cli) - To view CLI documentation for Hydrogen (custom storefront) development

## Contribute 👩🏽‍💻

If you'd like to contribute to the project, check out the [contributors docs](/docs) and the [steps to get started](/docs/cli/get-started.md).

<p>&nbsp;</p>

## References

- [oclif](https://oclif.io/)
