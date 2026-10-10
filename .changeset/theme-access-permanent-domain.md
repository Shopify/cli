---
'@shopify/cli-kit': patch
'@shopify/theme': patch
---

Theme Access passwords now work when `--store` is a store domain other than its permanent `.myshopify.com` domain (for example a renamed `.myshopify.com` domain): the CLI looks up the permanent domain and uses it. When a Theme Access password is rejected, the error now explains how to find the permanent domain.
