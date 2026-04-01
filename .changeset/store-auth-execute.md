---
'@shopify/cli': minor
---

Add `shopify store auth` and `shopify store execute`

`shopify store auth` authenticates an app against a store using PKCE and stores online per-user auth for later store commands.

`shopify store execute` runs Admin API GraphQL against that stored auth, supports query and variables input similar to `shopify app execute`, and requires `--allow-mutations` for write operations.
