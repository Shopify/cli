# Local development

How to set up and run Shopify CLI from a checkout. For the pre-submit workflow and lint/codegen guidance, see [`../AGENTS.md`](../AGENTS.md).

## Setup

```bash
dev up      # installs the pinned Node + pnpm, dependencies, GraphQL schemas, and Playwright
```

`dev up` pins the same Node and pnpm versions CI uses (`dev.yml` ↔ `tests-pr.yml`, enforced by `pnpm check-ci-gates`), so your local runtime matches CI.

## Running the CLI

```bash
pnpm shopify <command>      # builds the cli, then runs it (e.g. pnpm shopify app dev)
dev shopify <command>       # same, via the dev command
```

`pnpm shopify` rebuilds the `cli` package first, so it reflects your latest changes.

## Local service environment

When developing against local services rather than production:

```bash
SHOPIFY_SERVICE_ENV=local
SHOPIFY_CLI_NEVER_USE_PARTNERS_API=1
```

- **Admin URLs**: in local mode the CLI maps `{store}.my.shop.dev` to `admin.shop.dev/store/{store}` — see `packages/cli-kit/src/public/node/context/fqdn.ts`.
- **Organization**: use organization ID `1` for local development.

## Theme check

The `theme check` command wraps [`@shopify/theme-check-node`](https://github.com/Shopify/theme-tools). Entry point: `packages/theme/src/cli/commands/theme/check.ts`.

## Before opening a PR

- Run `pnpm pre-ci` (see [`../AGENTS.md`](../AGENTS.md)).
- After changing commands, flags, or GraphQL queries, run `pnpm codegen` and commit the regenerated files.
- For changesets and bump types, see [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
