---
'@shopify/app': patch
---

Surface local proxy errors during `app dev`: unmatched HTTP paths and websocket upgrades now log a warning instead of failing silently, the "Proxy server started" line only prints after the socket actually binds, and a fatal proxy error (failed bind, or a runtime error after bind) tears the dev session down instead of leaving the proxy dead with no further indication.
