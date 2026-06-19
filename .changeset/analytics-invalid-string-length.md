---
'@shopify/cli-kit': patch
---

Bound the length of individual strings recorded in command analytics so serializing the collected data can no longer throw `RangeError: Invalid string length`
