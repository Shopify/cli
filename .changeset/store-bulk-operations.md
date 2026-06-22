---
'@shopify/cli': minor
'@shopify/store': minor
'@shopify/cli-kit': patch
'@shopify/app': patch
---

Add `shopify store bulk execute`, `shopify store bulk status`, and `shopify store bulk cancel` so you can run Admin API bulk operations against a store using stored auth (`shopify store auth`), without needing an app. The shared bulk-operation primitives now live in `@shopify/cli-kit` and are reused by both the `app` and `store` commands.
