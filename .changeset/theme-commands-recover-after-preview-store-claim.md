---
'@shopify/cli-kit': patch
'@shopify/theme': patch
'@shopify/store': patch
---

Fix theme and `store` commands failing with an unhelpful error on a preview store after it has been claimed; they now prompt to run `store auth` to re-authenticate
