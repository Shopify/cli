# Sidekick CLI OAuth Setup

This document describes how to set up the `shopify sidekick` CLI command with real OAuth authentication in local development.

## Overview

The `shopify sidekick` command authenticates via OAuth token exchange through the Shopify Identity service. This requires configuration changes in three repos:

1. **cli** — New `sidekick` API type in the CLI session infrastructure
2. **identity** — Seed data to allow the CLI to exchange tokens for sidekick-server
3. **sidekick-server** — Authorize the CLI as an identity client

## Prerequisites

- Local dev environment with `identity`, `sidekick-server`, and `cli` repos
- A local dev store (e.g., `shop1`, `shop4`)

## Setup Steps

### 1. Identity — Seed Changes

The seed files (`allowed_token_exchange.yml` and `oauth_applications.yml`) have been updated, but you also need to manually create a `TokenExchangeConfiguration` record because `db:seed` may not create it automatically.

```bash
cd /path/to/identity
bin/rails db:seed
```

Then in the Rails console (`bin/rails c`):

```ruby
cli = OAuthApplication.find_by(name: 'shopify-cli-development')
sidekick = OAuthApplication.find_by(name: 'sidekick-server-development')
provider = OAuthProvider.find_by(name: 'merchant')

TokenExchangeConfiguration.find_or_create_by!(
  oauth_application: cli,
  target_oauth_application: sidekick,
  oauth_provider: provider
)
```

Verify it worked:

```ruby
cli.token_exchange_targets.include?(sidekick)
# => true
```

### 2. Sidekick-Server — Restart

After pulling the `development.yml` changes, restart sidekick-server to pick up the new authorized client:

```bash
cd /path/to/sidekick-server
/opt/dev/bin/dev s
```

### 3. CLI — Run the Command

```bash
cd /path/to/cli
SHOPIFY_SERVICE_ENV=local pnpm shopify sidekick --store <store-name> "your message"
```

The `SHOPIFY_SERVICE_ENV=local` flag routes identity requests to your local identity service.

## Dev Mode (JWT Bypass)

For quick testing without OAuth, you can still use a manually-generated JWT:

```bash
SIDEKICK_TOKEN=<jwt> SIDEKICK_API_ENDPOINT=https://sidekick-server.shop.dev pnpm shopify sidekick "your message"
```

## Troubleshooting

### `invalid_target` error
The identity service can't find the token exchange configuration. Re-run the Rails console steps above.

### `invalid_request` error
The identity token doesn't include sidekick scopes. Log out (`shopify auth logout`) and re-authenticate to get a fresh token with the correct scopes.

### `401` from sidekick-server
The sidekick-server doesn't recognize the CLI as an authorized client. Ensure `development.yml` includes `"shopify-cli-development"` in `identity_authorization.authorized_clients` and restart the server.

## Production TODO

- [ ] Look up production sidekick-server client ID from Identity application registry and add to `identity.ts`
- [ ] Set up production `TokenExchangeConfiguration` (or equivalent deployment config)
- [ ] Verify production identity has the `sidekick.message` scope available for CLI exchange
