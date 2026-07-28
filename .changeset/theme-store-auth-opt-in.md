---
'@shopify/theme': patch
---

Fix `theme dev` and other theme commands adopting `store auth` sessions with insufficient scopes; only `theme pull` and `theme push` reuse them now.
