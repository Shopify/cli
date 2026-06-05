---
'@shopify/app': patch
'@shopify/cli-kit': patch
---

Remove the `diff` dependency; inline an LCS-based line-diff helper for `app env pull`.
