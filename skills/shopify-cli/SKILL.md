---
name: shopify-cli
description: Runs Shopify CLI commands for theme and app development. Handles theme push, pull, dev, check, publish, and app dev, deploy, build. Use when the user mentions Shopify themes, Shopify apps, Liquid templates, storefronts, or needs to interact with a Shopify store.
metadata:
  author: shopify
  version: "1.0"
---

# Shopify CLI

Runs [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) commands for theme and app development workflows.

## Non-interactive execution

The CLI is designed for interactive terminal use. For AI-assisted execution, always apply these flags:

- `--force` or `-f` to skip confirmation prompts
- `--no-color` to disable ANSI escape codes
- `--json` when available for structured, parseable output
- `theme check` uses `--output json` instead of `--json`

## Store resolution

Before running any store-scoped command, determine the target store:

1. Check if the user specified a store in their request
2. Look for `shopify.theme.toml` or `shopify.app.toml` in the project
3. Check if `SHOPIFY_FLAG_STORE` env var is set
4. If none found, ask the user

## Authentication

If a command fails with an auth error ("not logged in", "session expired"):

1. Run `shopify auth login --store <store>` (allow ~2 minutes for browser OAuth)
2. Retry the original command after login succeeds

## Command reference

### Theme commands

| Task | Command | Notes |
|------|---------|-------|
| List themes | `shopify theme list --json` | Returns theme IDs, names, roles |
| Theme info | `shopify theme info --json` | Details about a theme |
| Push | `shopify theme push --force --json` | Upload local to remote |
| Pull | `shopify theme pull --force` | Download remote to local |
| Check quality | `shopify theme check --output json` | Theme Check linting |
| Dev server | `shopify theme dev` | Long-running — start in separate terminal |
| Publish | `shopify theme publish --force` | Make a theme live |
| Delete | `shopify theme delete --force` | Remove a theme |
| Rename | `shopify theme rename --name <name>` | Rename a theme |
| Duplicate | `shopify theme duplicate --force --json` | Copy a theme |
| Init | `shopify theme init <name>` | Scaffold from starter theme |
| Package | `shopify theme package` | Create .zip for distribution |
| Share | `shopify theme share` | Create shareable preview link |
| Profile | `shopify theme profile --json` | Liquid performance profiling |
| Metafields | `shopify theme metafields pull --force` | Download metafield definitions |

### App commands

| Task | Command | Notes |
|------|---------|-------|
| Dev server | `shopify app dev` | Long-running — start in separate terminal |
| Deploy | `shopify app deploy --force` | Deploy app to Shopify |
| Build | `shopify app build` | Build the app |
| Generate extension | `shopify app generate extension` | Scaffold a new extension |
| App info | `shopify app info --json` | App configuration details |
| Function run | `shopify app function run` | Run a function locally |
| Release | `shopify app release --version <v>` | Release an app version |
| Versions list | `shopify app versions list --json` | List deployed versions |

### Auth commands

| Task | Command |
|------|---------|
| Log in | `shopify auth login --store <store>` |
| Log out | `shopify auth logout` |

## Key flags

- `--store <url>` / `-s` — target store (e.g. `my-store.myshopify.com`)
- `--theme <id-or-name>` / `-t` — target theme
- `--path <dir>` — project directory (default: cwd)
- `--json` — structured output
- `--force` / `-f` — skip confirmation prompts
- `--no-color` — disable ANSI colors
- `--only <glob>` / `--ignore <glob>` — filter files for push/pull
- `--development` / `-d` — target the development theme
- `--live` / `-l` — target the live theme

## Workflows

See [references/workflows.md](references/workflows.md) for common multi-step workflows including:
- Creating a new theme
- Iterating on an existing theme
- Creating and deploying an app

## Discovery

Run `shopify <topic> --help` or `shopify <topic> <command> --help` to discover commands and flags not listed above.

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
