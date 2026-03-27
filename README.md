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

## Before you begin

Install the latest version of  [Node.js](https://nodejs.org/en/download/) and [npm](https://docs.npmjs.com/getting-started) (or another package manager of your choice).

<p>&nbsp;</p>

## Developing apps with Shopify CLI

When you’re building a Shopify app, you can initialize your project using your preferred package manager. A single command will install all the dependencies you need — including Shopify CLI itself.

Initialize your project using one of the following commands:
- `npm init @shopify/app@latest` (installed by default with Node)
- `pnpm create @shopify/create-app@latest`
- `yarn create @shopify/app`
- `bun create @shopify/app@latest` (experimental)

Learn more in the docs: [Create an app](https://shopify.dev/apps/getting-started/create)

<p>&nbsp;</p>

## Developing themes with Shopify CLI

To work with themes, the CLI needs to be installed globally with:

- `npm install -g @shopify/cli`

You can also use do it through Homebrew on macOS: `brew tap shopify/shopify && brew install shopify-cli`

Learn more in the docs: [Shopify CLI for themes](https://shopify.dev/docs/storefronts/themes/tools/cli)

<p>&nbsp;</p>

## Developing Hydrogen custom storefronts with Shopify CLI ##

The Hydrogen code lives here: https://github.com/Shopify/hydrogen/tree/main/packages/cli

Learn more in the docs: [Shopify CLI for Hydrogen storefronts](https://shopify.dev/docs/custom-storefronts/hydrogen/cli)

## Agent Skills

This repo includes [Agent Skills](https://agentskills.io) that inject Shopify CLI and Liquid theme knowledge directly into the agent's context. These follow the open [Agent Skills format](https://agentskills.io/specification) and work with any compatible agent — Claude Code, Cursor, Gemini CLI, VS Code, and others.

| Skill | Scope | What the agent learns |
|-------|-------|----------------------|
| [`shopify-cli`](skills/shopify-cli/) | CLI commands | Non-interactive execution, store resolution, auth, workflows |
| [`shopify-liquid-themes`](skills/shopify-liquid-themes/) | Liquid language | Schema JSON, LiquidDoc, filters, tags, objects, translations |
| [`liquid-theme-standards`](skills/liquid-theme-standards/) | CSS/JS/HTML | BEM in `{% stylesheet %}`, design tokens, Web Components, defensive CSS |
| [`liquid-theme-a11y`](skills/liquid-theme-a11y/) | Accessibility | WCAG 2.2 patterns for e-commerce components |
| [`shopify-functions`](skills/shopify-functions/) | Shopify Functions | Wasm compilation, declarative I/O, execution order, function types |
| [`shopify-graphql-admin`](skills/shopify-graphql-admin/) | Admin GraphQL API | Cost-based rate limiting, GIDs, userErrors, bulk operations |
| [`shopify-app-extensions`](skills/shopify-app-extensions/) | App extensions | Sandbox model, web components (not React DOM), 64KB limit |
| [`shopify-checkout-ui`](skills/shopify-checkout-ui/) | Checkout UI | Preact Signals, static vs block targets, network constraints |
| [`shopify-webhooks`](skills/shopify-webhooks/) | Webhooks | TOML vs API subscriptions, GDPR compliance, idempotency |
| [`shopify-app-auth`](skills/shopify-app-auth/) | Authentication | Token exchange vs OAuth, session vs access tokens |
| [`shopify-hydrogen`](skills/shopify-hydrogen/) | Hydrogen | React Router (not Next.js), Storefront API, Oxygen hosting |

Install individual skills with the [skills CLI](https://skills.sh):

```sh
npx skills add Shopify/cli --skill shopify-cli
npx skills add Shopify/cli --skill shopify-liquid-themes
npx skills add Shopify/cli --skill liquid-theme-standards
npx skills add Shopify/cli --skill liquid-theme-a11y
npx skills add Shopify/cli --skill shopify-functions
npx skills add Shopify/cli --skill shopify-graphql-admin
npx skills add Shopify/cli --skill shopify-app-extensions
npx skills add Shopify/cli --skill shopify-checkout-ui
npx skills add Shopify/cli --skill shopify-webhooks
npx skills add Shopify/cli --skill shopify-app-auth
npx skills add Shopify/cli --skill shopify-hydrogen
```

<p>&nbsp;</p>

## Help 🖐

If you encounter issues using the CLI or have feedback you'd like to share with us, below are some options:

- [File a bug report](https://community.shopify.dev/c/shopify-cli-libraries/14) - To report bugs create a post in Shopify CLI and Libraries on the dev community
- [Ask a question or request a new feature](https://community.shopify.dev/c/dev-platform/32) - To ask a question or request a new feature create a post in Dev Platform on the dev community
- [Shopify Community Forums](https://community.shopify.com/) - Visit our forums to connect with the community and learn more about Shopify CLI development
- [CLI Documentation - Apps](https://shopify.dev/apps/tools/cli) - To view CLI documentation for app development
- [CLI Documentation - Themes](https://shopify.dev/themes/tools/cli) - To view CLI documentation for theme development
- [CLI Documentation - Hydrogen](https://shopify.dev/custom-storefronts/tools/cli) - To view CLI documentation for Hydrogen (custom storefront) development

## Contribute 👩🏽‍💻

If you'd like to contribute to the project, check out the [contributors docs](/docs) and the [steps to get started](/docs/cli/get-started.md).

<p>&nbsp;</p>

## References

- [oclif](https://oclif.io/)
