---
'@shopify/cli-kit': patch
'@shopify/cli': patch
---

Auto-upgrade installs the exact version it checked instead of `@shopify/cli@latest`, so a stale version cache can no longer upgrade you to a new major version.
