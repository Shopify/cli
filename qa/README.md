# CLI Pre-release QA Flow — Guided Automation

Semi-automated script that walks through the full [QA checklist (v2)](https://docs.google.com/document/d/1XX6QnS6kKZTT1shcCZVcso74VWn-Ui4V2IASenHHi1E/edit) step-by-step.

## What it does

| Behavior | Examples |
|---|---|
| **Automates** CLI commands that need no interaction | `app init`, `generate extension`, `function build`, `function run`, `deploy`, `theme check`, `theme package`, `hydrogen build` |
| **Prompts you** when manual verification is needed | Dev console visual checks, hot reload, GraphiQL browser test |
| **Provides links & instructions** for what to look for | URLs, file paths to edit, expected behaviors |
| **Persists results** after every step | Partial runs are saved; resume or retry later |

## Quick start

```bash
# Full QA run
node qa/run-qa.mjs --store my-dev-store
```

## Step selection

Every step has a unique ID (e.g. `apps.init`, `themes.check`, `hydrogen.build`).

```bash
# List all steps and their status from the last run
node qa/run-qa.mjs --list

# Run only specific steps
node qa/run-qa.mjs --only apps.init
node qa/run-qa.mjs --only apps.init,apps.ext.admin_action,apps.deploy

# Prefix matching — run all steps in a section
node qa/run-qa.mjs --only apps
node qa/run-qa.mjs --only apps.ext            # all extension steps
node qa/run-qa.mjs --only apps,hydrogen        # apps + hydrogen

# Skip entire sections
node qa/run-qa.mjs --skip-themes --skip-hydrogen
```

## Retry failed steps

Results are saved to `~/Desktop/qa-results-YYYY-MM-DD.json` after **every step**, so even if you abort mid-run, progress is kept.

```bash
# Re-run only steps that failed (or were never run) in the last execution
node qa/run-qa.mjs --retry-failed

# Combine: retry failed, scoped to apps only
node qa/run-qa.mjs --retry-failed --only apps

# Use a custom results file
node qa/run-qa.mjs --retry-failed --results-file /path/to/results.json
```

## All options

```
--store <name>           Dev store name (for theme steps)
--nightly-version <v>    Expected CLI version to verify

Step selection:
  --list                 List all steps and their last-run status
  --only <ids>           Comma-separated step IDs or prefixes
  --retry-failed         Re-run only failed/never-run steps

Section skips:
  --skip-apps            Skip all Apps steps
  --skip-themes          Skip all Themes steps
  --skip-hydrogen        Skip all Hydrogen steps

Other:
  --results-file <path>  Custom results JSON path
  --help                 Show help
```

## Available steps

```
Apps
  apps.init                  Create app (shopify app init)
  apps.ext.admin_action      Generate admin_action extension
  apps.ext.theme_app         Generate theme_app_extension
  apps.ext.discount          Generate discount function extension
  apps.ext.flow_action       Generate flow_action extension
  apps.ext.random            Generate a random extension (your choice)
  apps.dev_console           Run app dev & verify dev console
  apps.graphql_cli           GraphQL via CLI command
  apps.graphiql              GraphiQL in browser
  apps.theme_ext             Theme app extension verification
  apps.dev_disconnect        Stop dev & verify disconnect
  apps.function_build        Function build
  apps.function_run          Function run
  apps.deploy                Deploy app (v1)
  apps.deploy_release        Verify deploy release
  apps.versions_list         Versions list
  apps.config_link_redeploy  Config link & redeploy to new app

Themes
  themes.init                Create theme
  themes.check               Theme check
  themes.package             Theme package
  themes.dev_hotreload       Theme dev + hot reload
  themes.push                Theme push
  themes.list                Theme list

Hydrogen
  hydrogen.init              Create Hydrogen app
  hydrogen.build             Hydrogen build
  hydrogen.dev               Hydrogen dev & verify storefront
```

## Cross-OS testing

Uses only `node:*` built-in modules — no dependencies. Same command on all platforms:

```bash
# macOS / Linux
node qa/run-qa.mjs --store my-dev-store

# Windows (PowerShell or cmd)
node qa\run-qa.mjs --store my-dev-store
```

## Output

Summary table at the end + persistent JSON file:

```
  Apps
    ✔  apps.init                  Create app (shopify app init)
    ✔  apps.ext.admin_action      Generate admin_action extension
    ✘  apps.ext.theme_app         Generate theme_app_extension  Command failed
    ⊘  themes.init                Create theme (skipped)

  Total: 26  |  Passed: 20  |  Failed: 2  |  Skipped: 4

  ⚠  Some steps failed. Review the failures above.
  ℹ  To retry only failed steps:  node qa/run-qa.mjs --retry-failed
```

## Prerequisites

1. Nightly CLI installed: `npm i -g @shopify/cli@nightly`
2. Verify version: `shopify version`
3. Node 22.2.0+
4. A Shopify dev store for theme/app testing
