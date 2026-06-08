# Local development against services

Most contributions run against production Shopify services. When developing against a local services stack, the CLI changes behavior based on the service environment.

## Service environment

- `SHOPIFY_SERVICE_ENV=local`
- `SHOPIFY_CLI_NEVER_USE_PARTNERS_API=1`

In local mode the CLI maps a store's `{store}.my.shop.dev` host to `admin.shop.dev/store/{store}` — see `packages/cli-kit/src/public/node/context/fqdn.ts`.

## Running the CLI

See [Get started](./get-started.md) for building and running the CLI (`pnpm shopify <command>`) and the available scripts.

## Before opening a PR

Derive the minimal pre-submit checks for your diff (see the `cli-pre-submit-ci` agent skill), or run `pnpm pre-ci` for full local CI parity. After changing commands, flags, or GraphQL queries, run `pnpm codegen` and commit the regenerated files.
