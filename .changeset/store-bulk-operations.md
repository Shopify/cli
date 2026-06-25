---
'@shopify/cli': minor
'@shopify/store': minor
---

Add `shopify store bulk execute`, `shopify store bulk status`, and `shopify store bulk cancel` so you can run Admin API bulk operations against a store using stored auth (`shopify store auth`), without needing an app. Mutations are disabled by default; pass `--allow-mutations` to run them.
