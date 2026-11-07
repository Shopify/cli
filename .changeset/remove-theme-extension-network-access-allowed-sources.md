---
'@shopify/app': patch
---

Remove `[extensions.capabilities.network_access] allowed_sources` from theme app extensions; declare network origins with `[network_access] allowed_sources` in `shopify.app.toml` instead.
