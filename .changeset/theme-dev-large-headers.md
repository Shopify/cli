---
'@shopify/theme': patch
---

Fix `theme dev` rendering every page as a 502 on stores whose storefront responses carry large `Set-Cookie` header blocks, by pinning a 128 KiB header-size cap on the dev server and its storefront fetch instead of inheriting Node's defaults.
