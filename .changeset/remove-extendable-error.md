---
'@shopify/cli-kit': patch
---

Remove the `ExtendableError` export from `@shopify/cli-kit/node/error`; extend `Error` directly instead.
