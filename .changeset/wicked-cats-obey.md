---
'@shopify/theme': patch
---

Fixed `shopify theme dev` to avoid emitting full page reload events when files are updated successfully, preventing conflicts with hot-reloading.
