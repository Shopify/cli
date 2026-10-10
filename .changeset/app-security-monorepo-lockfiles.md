---
'@shopify/app': patch
'@shopify/cli': patch
---

Skip lockfiles in every `shopify app security check` scan directory, so a monorepo root lockfile no longer leaves the secret check unresolved
