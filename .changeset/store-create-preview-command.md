---
'@shopify/store': minor
'@shopify/cli': minor
---

Add `shopify store create preview`, which mints a Preview Store via Core's preview-stores orchestrator (M1 of the [Preview Store for AI Agent Surfaces](https://vault.shopify.io/gsd/proposals/60T12R) initiative) and persists the returned admin API token as a `kind: 'preview'` stored session. After running it, `shopify store execute --store <permanent-domain>` works against the new store immediately, with no PKCE flow and no browser interaction.

The Core endpoint defaults to the local development rig (`https://app.shop.dev`) and the prototype basic-auth credentials. Override with `--core-url`, `--cli-username`, `--cli-secret` or the equivalent `SHOPIFY_FLAG_PREVIEW_STORE_*` environment variables when targeting other environments.
