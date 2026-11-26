---
'@shopify/app': minor
'@shopify/cli': minor
---

Commands that authenticate as the app, such as `app execute`, the bulk operation commands and `app dev`, read the app's client secret from `SHOPIFY_CLI_APP_CLIENT_SECRET` when it's set. Older CLI versions ignore this variable, so upgrade before you set it.
