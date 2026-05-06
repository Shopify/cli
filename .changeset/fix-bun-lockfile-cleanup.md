---
'@shopify/app': patch
'@shopify/cli-kit': patch
---

Handle modern Bun `bun.lock` files when cleaning up app templates so non-Bun projects do not keep stale Bun lockfiles or `.gitignore` entries.
