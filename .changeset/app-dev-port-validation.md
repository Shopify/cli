---
'@shopify/app': patch
---

`app dev` now shows a clear error when `--localhost-port`, `--theme-app-extension-port`, or `--graphiql-port` is given an invalid value. The port must be a number between 1 and 65535.
