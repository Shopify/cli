---
'@shopify/theme': patch
---

`theme dev` now shows a clear error when `--port` is given an invalid value, instead of crashing. The port must be a number between 1 and 65535.
