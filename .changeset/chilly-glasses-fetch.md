---
'@shopify/app': patch
---

Fix crash "config2.map is not a function" when writing app configuration with unvalidated data (e.g., from third-party templates without `client_id`). Removes the Zod schema walker (`rewriteConfiguration`) that assumed config data matched schema types. Key ordering in the generated TOML now follows object insertion order rather than schema declaration order, which may cause a one-time key reorder in `shopify.app.toml` on the next `app link` or `app config pull`.
