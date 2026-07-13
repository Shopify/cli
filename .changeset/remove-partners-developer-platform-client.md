---
'@shopify/app': patch
---

Remove the Partners API developer platform client from app commands. App Management is now the only developer platform client used by `app dev`, `deploy`, and related commands, so local development no longer needs the Partners dev service (`SHOPIFY_CLI_NEVER_USE_PARTNERS_API` is no longer required). The Partners-era legacy extension migrations that ran during `deploy` are also removed, since they only ever worked against the Partners API.
