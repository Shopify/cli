---
'@shopify/app': patch
---

Fail UI extension `dev` and `deploy` early with a clear error pointing at the offending locale file when a `locales/*.json` file contains invalid UTF-8 byte sequences, instead of letting the upload reach the server and abort with a generic `INTERNAL_SERVER_ERROR`.
