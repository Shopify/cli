---
'@shopify/app': patch
---

Fix `uid` being written outside the `[[extensions]]` block in single-entry array-of-tables TOMLs (the shape produced by `shopify app init` templates).
