---
'@shopify/store': patch
---

Cache the store's Admin API version list for a day, so `store execute` no longer sends a version lookup request on every call
