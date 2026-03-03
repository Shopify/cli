---
'@shopify/cli-kit': patch
---

Fix hydrogen local dev plugin loader to correctly replace bundled hydrogen commands with external plugin commands by switching to a post-load strategy. Also removes the now-dead `customPriority` method from `ShopifyConfig` (it was non-functional since oclif v3.83.0 and had no callers); the public type declaration for `custom-oclif-loader.js` reflects this removal.
