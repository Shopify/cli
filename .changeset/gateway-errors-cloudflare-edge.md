---
'@shopify/cli-kit': patch
'@shopify/cli': patch
---

Treat HTTP 520 to 524 edge responses as gateway errors, like 502, 503 and 504
