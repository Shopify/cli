---
'@shopify/cli-kit': patch
---

Theme commands and the Admin API version check report an HTTP 5xx as a Shopify-side error with its request ID, and theme commands no longer forget the stored theme on one.
