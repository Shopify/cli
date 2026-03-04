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

- `npm install -g @shopify/cli @shopify/theme`

You can also use do it through Homebrew on macOS: `brew tap shopify/shopify && brew install shopify-cli`

Learn more in the docs: [Shopify CLI for themes](https://shopify.dev/docs/storefronts/themes/tools/cli)

<p>&nbsp;</p>

## Developing Hydrogen custom storefronts with Shopify CLI ##

The Hydrogen code lives here: <https://github.com/Shopify/hydrogen/tree/main/packages/cli>

Learn more in the docs: [Shopify CLI for Hydrogen storefronts](https://shopify.dev/docs/custom-storefronts/hydrogen/cli)

<p>&nbsp;</p>

## Agent Skill

The repo includes an [Agent Skill](https://agentskills.io) at `skills/shopify-cli/` that injects Shopify CLI knowledge directly into the agent's context. This follows the open [Agent Skills format](https://agentskills.io/specification) and works with any compatible agent — Claude Code, Cursor, Gemini CLI, VS Code, and others.

The skill is auto-discovered based on task context (e.g. when the user mentions Shopify themes or apps). It works with or without the MCP server:

- **With the MCP server:** The agent uses MCP tools for execution (structured responses, auto-parsed JSON, auth detection)
- **Without the MCP server:** The agent runs `shopify` commands directly via shell

Install the skill with the [skills CLI](https://skills.sh):

```sh
npx skills add Shopify/cli --skill shopify-cli
```

Or using the full path:

```sh
npx skills add https://github.com/Shopify/cli/tree/main/skills/shopify-cli
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
