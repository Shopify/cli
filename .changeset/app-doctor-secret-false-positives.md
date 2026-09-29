---
'@shopify/app': patch
---

The committed-secret check in `shopify app security` now only flags recognized Shopify token formats, ignoring other providers' key prefixes, secret-sounding variable names, and placeholders.
