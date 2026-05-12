---
'@shopify/app': patch
---

Surface local proxy errors during `app dev` instead of silently 500ing on unmatched paths, destroying unmatched websocket upgrades, or crashing the process if the proxy fails to bind.
