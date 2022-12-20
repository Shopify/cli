---
'@shopify/cli-kit': patch
---

- Refresh token if possible, fallback to full login when it's not possible
- Parallelize access token refreshes
