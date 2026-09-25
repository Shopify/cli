---
'@shopify/theme': patch
---

Fix theme commands on preview stores requiring login. Every theme command reuses a stored preview store session again, not only `theme pull` and `theme push`.
