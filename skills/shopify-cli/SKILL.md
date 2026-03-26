---
name: shopify-cli
description: Runs Shopify CLI commands for theme and app development workflows. Use when the user mentions Shopify themes, Shopify apps, Liquid templates, storefronts, or needs to interact with a Shopify store.
metadata:
  author: shopify
  version: "1.0"
---

# Shopify CLI

Runs [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) commands for theme and app development workflows.

## Prerequisites

If the user is starting from scratch, these steps require human interaction and cannot be automated:

1. **Install CLI** — `npm install -g @shopify/cli` (or Homebrew: `brew tap shopify/shopify && brew install shopify-cli`)
2. **A Shopify store** — needed for both app and theme development
   - **For app development:** Create a free [Shopify Partner account](https://partners.shopify.com/signup), then create a development store from the Partners dashboard
   - **For theme development:** Any Shopify store works (including a dev store)
3. **Authenticate** — `shopify auth login` (opens browser, requires human)

## Documentation & discovery

- **Shopify dev docs:** <https://shopify.dev/docs> — most documentation pages have a `.md` variant for agents (append `.md` to the URL)
- **CLI docs:** <https://shopify.dev/docs/api/shopify-cli> — command reference, flags, and examples
- **Shopify Dev MCP:** <https://github.com/Shopify/dev-mcp> — MCP server for orienting to Shopify's APIs
- **Runtime discovery:** Run `shopify <topic> --help` or `shopify <topic> <command> --help` to discover commands and flags
- **Debugging:** Use `--verbose` for detailed output when a command fails for unclear reasons

## Non-interactive execution

The CLI is designed for interactive terminal use. For AI-assisted execution, always apply these flags:

- **Theme commands:** `--force` or `-f` to skip confirmation prompts
- **App deploy/release:** `--allow-updates` (and optionally `--allow-deletes`) instead of `--force`, which is deprecated
- `--no-color` to disable ANSI escape codes
- `--json` when available for structured, parseable output
- `theme check` uses `--output json` instead of `--json`
- `--path <dir>` to specify the project directory instead of relying on cwd

## Store resolution

Before running any store-scoped command, determine the target store:

1. Check if the user specified a store in their request
2. Look for `shopify.theme.toml` or `shopify.app.toml` in the project
3. Check if `SHOPIFY_FLAG_STORE` env var is set
4. If none found, ask the user

## Authentication

If a command fails with an auth error ("not logged in", "session expired"):

1. Run `shopify auth login` (optionally with `--alias <alias>`)
2. This opens a browser for OAuth — the user must complete the browser step manually
3. After login succeeds, rerun the original store-scoped command with the appropriate `--store <store>` flag or `SHOPIFY_FLAG_STORE` environment variable

Note: There is no non-interactive auth flow for local development. The browser OAuth step requires human interaction.

## Workflows

See [references/workflows.md](references/workflows.md) for common multi-step workflows including:
- Creating a new theme
- Iterating on an existing theme
- Creating and deploying an app

## Output handling

- Parse `--json` output as structured data and summarize for the user
- For non-JSON output, present the relevant portions
- Long-running commands (`theme dev`, `app dev`) should be started in a separate terminal, not through an MCP server or automated tool

## Interactive commands

Some commands prompt for input that `--force` cannot suppress. These may hang when run non-interactively:
- `app init` — prompts for template and app name
- `app generate extension` — prompts for extension type and name (use `--template` and `--name` to pre-fill)
- `theme dev` / `app dev` — long-running server processes (start in a separate terminal)

If a command appears to hang, it is likely waiting for interactive input. Cancel it and check `--help` for flags that provide the needed values.

## Destructive commands

Before running commands that delete, publish, or deploy, always confirm with the user first:
- `theme delete` — permanently removes a theme
- `theme publish` — makes a theme live (replaces the current live theme)
- `app deploy` — deploys to production
- `app release` — releases an app version to users
- `app execute` / `app bulk execute` — mutations are only allowed on dev stores
