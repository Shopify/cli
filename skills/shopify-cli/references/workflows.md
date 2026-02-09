# Shopify CLI Workflows

Common multi-step workflows for theme and app development.

## Create a new theme

```bash
shopify theme init my-theme
cd my-theme
shopify theme dev --store <store>
```

The `init` command clones the Skeleton starter theme. Use `--clone-url <url>` to start from a different repo, or `--latest` to pin to the latest release tag.

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

## Add an extension to an app

```bash
# Interactive — prompts for extension type and name
shopify app generate extension
```

Note: `app generate extension` is interactive. Use `--template <type>` and `--name <name>` to pre-fill values, but the CLI may still prompt for additional configuration.

## Build, deploy, and release an app

```bash
# Build the app
shopify app build

# Deploy to Shopify (creates a new version)
shopify app deploy --force

# Release a specific version to users
shopify app release --version <version>

# Check app info and configuration
shopify app info --json

# List deployed versions
shopify app versions list --json
```

## App function development

```bash
# Run a function locally
shopify app function run --path <function-dir>

# Generate function types
shopify app function typegen --path <function-dir>
```

## Check and push (theme quality gate)

```bash
shopify theme check --output json
# If no errors:
shopify theme push --force --json
```

## List and inspect themes

```bash
# List all themes
shopify theme list --json

# Get details about a specific theme
shopify theme info --theme <id-or-name> --json
```
