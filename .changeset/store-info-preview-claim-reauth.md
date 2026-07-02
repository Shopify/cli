---
'@shopify/store': patch
---

Fix `store info` failing with an unhelpful error on a preview store after it has been claimed; it now prompts to run `store auth` to re-authenticate
