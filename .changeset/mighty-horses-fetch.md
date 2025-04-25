---
'@shopify/cli-kit': patch
---

Increase network timeout for theme API requests to prevent failures during long operations. This utilizes the internal request behaviour mechanism for theme-related Admin API calls, setting a longer timeout (90s) specifically for potentially slow actions like asset uploads/downloads.
