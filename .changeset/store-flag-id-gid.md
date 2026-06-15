---
'@shopify/store': minor
---

`shopify store` commands now accept a numeric store ID or a Shop GID (`gid://shopify/Shop/<id>`) for `--store`, in addition to the myshopify.com domain. IDs and GIDs are resolved to the store's domain via the Business Platform. The `--store` value now also trims surrounding whitespace.
