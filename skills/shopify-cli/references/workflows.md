# Shopify CLI Workflows

Common multi-step workflows for theme and app development.

## Create a new theme

```bash
# Scaffold from the Skeleton starter theme
shopify theme init my-theme
cd my-theme
# Start dev server for live preview
shopify theme dev --store <store>
```

Use `--clone-url <url>` to start from a different repo, or `--latest` to pin to the latest release tag.

## Iterate on an existing theme

```bash
# Pull the latest version of a theme to work on locally
shopify theme pull --theme <id-or-name> --force

# Or pull the live theme
shopify theme pull --live --force

# Start the dev server for live preview while editing
shopify theme dev --store <store>

# Make edits to Liquid, CSS, JSON files as needed...

# Check for errors before pushing
shopify theme check --output json

# Push changes back to the store
shopify theme push --force --json
```

Use `--development` / `-d` with push/pull to target the development theme specifically. Use `--only` and `--ignore` to limit which files are synced (e.g. `--only "sections/*"` or `--ignore "config/settings_data.json"`).

## Create a new app

```bash
# Interactive — prompts for template and name
shopify app init
cd <app-directory>

# Start local dev server (long-running — run in separate terminal)
shopify app dev
```

Note: `app init` is interactive and will prompt for a template and app name. It cannot be fully automated with flags.

## Build, deploy, and release an app

```bash
# Build the app
shopify app build

# Deploy to Shopify (creates a new version)
shopify app deploy --allow-updates

# Release a specific version to users
shopify app release --version <version>
```
