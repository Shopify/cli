---
'@shopify/cli': patch
---

`store create dev` no longer fails with "Unable to determine store creation status." when its first status check comes back empty. It keeps checking until the store is ready or the 5-minute timeout passes.
