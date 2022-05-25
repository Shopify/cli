---
'@shopify/create-hydrogen': patch
---

Support template names (via --template) in any of the following formats:

1. the full directory name (ie `template-hydrogen-demo-store`)
2. the hyphanized name (ie `demo-store`)
3. or the proper name (ie `Demo store`)

each value will be normalized and produce the same results.
