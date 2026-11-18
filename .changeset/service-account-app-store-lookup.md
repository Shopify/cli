---
'@shopify/cli-kit': patch
'@shopify/cli': patch
---

Fix the HTTP 401 that `app execute`, `app bulk execute` and other app commands that look up a store get with a service account token that has Dev store management access.
