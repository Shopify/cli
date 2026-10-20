---
'@shopify/app': patch
'@shopify/cli': patch
---

Keep `shopify app security check` agent verification static-only: agents prove findings by reading code, without running app code or making network calls
