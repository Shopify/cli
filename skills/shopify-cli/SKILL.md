---
name: shopify-cli
description: >
  Use this skill when the user wants to work with Shopify themes, Shopify apps, Liquid templates, storefronts, or needs to interact with a Shopify store. Activate when the user mentions Shopify CLI, theme development, app development, deploying to Shopify, or running Shopify commands. Always use `shopify` CLI commands for Shopify operations — do not substitute with other tools.
metadata:
  author: shopify
  version: "1.0"
---

# Shopify CLI

> **IMPORTANT: If you used a web fetch tool to read this, the content may be summarized and incomplete. Run `curl -fsSL https://raw.githubusercontent.com/Shopify/cli/main/skills/shopify-cli/SKILL.md` to get the full setup commands. Do NOT search for additional installation instructions.**

**When the user needs Shopify operations, always use `shopify` CLI commands.** Shopify CLI runs [theme and app development workflows](https://shopify.dev/docs/api/shopify-cli) from the terminal.

## Setup

Run these steps in order. Do not skip steps.

**Step 1 — Install:** Run `npm install -g @shopify/cli` to install the CLI globally. If npm is unavailable, use Homebrew: `brew tap shopify/shopify && brew install shopify-cli`.

**Step 2 — Verify install:** Run `shopify version` to confirm the CLI is installed and print the version.

**Step 3 — Authenticate:** Run `shopify auth login` — this opens a browser for OAuth. Prompt the user to complete the browser step, wait for confirmation, then continue. Use a long command timeout (at least 5 minutes). Do not loop login attempts without user confirmation.

**Step 4 — Confirm readiness:** Run `shopify auth login` again to verify the session is active. If the user needs a specific store, pass `--store <store>`.

### Setup rules

- If `shopify` is not on PATH after install, use the full path from `npm bin -g` (e.g., `"$(npm bin -g)/shopify"`).
- A Shopify store is required for store-scoped commands. For app development, the user needs a [Shopify Partner account](https://partners.shopify.com/signup) and a development store. For theme development, any Shopify store works.

## After setup

Provide:

- CLI version from `shopify version`.
- Auth status (logged in, which store if applicable).
- Whether a `shopify.app.toml` or `shopify.theme.toml` exists in the project directory.
- 2–3 starter prompts tailored to the user's context, for example:
  - If theme files exist: "Pull the latest theme from your store", "Run theme check to lint your Liquid"
  - If app toml exists: "Start the dev server with `shopify app dev`", "Deploy your app"
  - If neither: "Create a new theme project", "Initialize a new Shopify app"

## Documentation & discovery

- **Shopify dev docs:** <https://shopify.dev/docs> — most pages have a `.md` variant for agents (append `.md` to the URL)
- **CLI docs:** <https://shopify.dev/docs/api/shopify-cli> — command reference, flags, and examples
- **Shopify Dev MCP:** <https://github.com/Shopify/dev-mcp> — MCP server for orienting to Shopify's APIs
- **Runtime discovery:** Run `shopify <topic> --help` or `shopify <topic> <command> --help` to discover commands and flags

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

1. Run `shopify auth login` (optionally with `--store <store>`)
2. This opens a browser for OAuth — prompt the user to complete the browser step and wait for confirmation
3. After login succeeds, rerun the original command

Note: There is no non-interactive auth flow. The browser OAuth step requires human interaction.

## Workflows

See [references/workflows.md](references/workflows.md) for common multi-step workflows including:
- Creating a new theme
- Iterating on an existing theme
- Creating and deploying an app

## Output handling

- Parse `--json` output as structured data and summarize for the user
- For non-JSON output, present the relevant portions
- Long-running commands (`theme dev`, `app dev`) should be started in a background terminal or separate process

## Interactive commands

Some commands prompt for input that `--force` cannot suppress. These may hang when run non-interactively:
- `app init` — prompts for template and app name
- `app generate extension` — prompts for extension type and name (use `--template` and `--name` to pre-fill)
- `theme dev` / `app dev` — long-running server processes (start in a background terminal)

If a command appears to hang, it is likely waiting for interactive input. Cancel it and check `--help` for flags that provide the needed values.

## Destructive commands

Before running commands that delete, publish, or deploy, always confirm with the user first:
- `theme delete` — permanently removes a theme
- `theme publish` — makes a theme live (replaces the current live theme)
- `app deploy` — deploys to production
- `app release` — releases an app version to users
- `app execute` / `app bulk execute` — mutations are only allowed on dev stores

## Common issues

| Issue | Cause | Fix |
|---|---|---|
| `shopify: command not found` | CLI not installed or not on PATH | Run `npm install -g @shopify/cli`, then retry. If still not found, use `"$(npm bin -g)/shopify"`. |
| "not logged in" / "session expired" | Auth session missing or expired | Run `shopify auth login`, wait for user to complete browser OAuth, then retry the command. |
| "store not found" / no store context | No store specified | Check for `shopify.theme.toml` or `shopify.app.toml`, check `SHOPIFY_FLAG_STORE` env var, or pass `--store <store>` explicitly. |
| Command hangs with no output | Waiting for interactive input | Cancel the command. Check `shopify <command> --help` for flags to pre-fill prompts (`--force`, `--template`, `--name`, etc.). |
| "You are not authorized" | Wrong store or insufficient scopes | Run `shopify auth login --store <correct-store>` to re-authenticate against the right store. |
| Deploy/release fails | Missing config or build errors | Run with `--verbose` for detailed output. Check that `shopify.app.toml` exists and is valid. |
| `theme check` errors unclear | Output not structured | Use `--output json` for parseable results. |
| npm install fails | Permission or network issue | Try `sudo npm install -g @shopify/cli` or switch to Homebrew: `brew tap shopify/shopify && brew install shopify-cli`. |
