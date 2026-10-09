---
'@shopify/theme': patch
---

`shopify theme pull` no longer runs Git in the target directory to detect uncommitted changes, so it never reads settings from a repository that happens to live in that directory
