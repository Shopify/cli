---
'@shopify/store': minor
'@shopify/cli-kit': patch
'@shopify/cli': minor
---

Add `shopify store list`, which prints every locally stored store-auth session — both standard PKCE-authenticated sessions (`shopify store auth`) and preview-store sessions (`shopify store create preview`) — as a table with `Store`, `Kind`, and `User` columns. Supports `--kind standard|preview` for filtering and `--json` for machine-readable output (intended for AI agent consumption alongside the M1 [Preview Store for AI Agent Surfaces](https://vault.shopify.io/gsd/proposals/60T12R) work).

Internally adds a `LocalStorage#entries()` enumerator to `@shopify/cli-kit` and a `listStoredStoreAppSessions()` helper to `@shopify/store` so the new command can resolve sessions across every stored shop without knowing the keys in advance.
